// Ponto de entrada do container de deploy: prepara o banco e só então sobe a API.
//
// 1. Se DB_BOOTSTRAP_FROM_SCHEMA=true e o banco estiver vazio, cria a estrutura final direto do
//    schema.prisma e marca todas as migrations como aplicadas. Necessário no TiDB, que não
//    aceita o JSON_TABLE das migrations da BE-16 e da BE-17 (elas só copiam dados antigos, que
//    não existem num banco novo).
// 2. Aplica as migrations pendentes (prisma migrate deploy).
// 3. Inicia o servidor neste mesmo processo, para receber o SIGTERM do Render.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mariadb from "mariadb";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

function runPrisma(...args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[deploy] "prisma ${args.slice(0, 2).join(" ")}" falhou; a API não vai subir.`);
    process.exit(result.status ?? 1);
  }
}

// O TiDB Starter dorme quando fica parado e leva alguns segundos para acordar: o padrão do
// driver (1 s) não basta, então a primeira conexão espera mais e tenta de novo.
const CONNECT_TIMEOUT_MS = 30_000;
const CONNECT_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5_000;

async function connectWithRetry() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.protocol = "mariadb:";
  if (!url.searchParams.has("connectTimeout")) {
    url.searchParams.set("connectTimeout", String(CONNECT_TIMEOUT_MS));
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await mariadb.createConnection(url.toString());
    } catch (error) {
      if (attempt >= CONNECT_ATTEMPTS) throw error;
      console.warn(
        `[deploy] Banco ainda indisponível (tentativa ${attempt}/${CONNECT_ATTEMPTS}): ${error.code ?? error.message}. Nova tentativa em ${RETRY_DELAY_MS / 1000} s.`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

async function readDatabaseState() {
  const connection = await connectWithRetry();
  try {
    const [row] = await connection.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(table_name = '_prisma_migrations'), 0) AS history
         FROM information_schema.tables
        WHERE table_schema = DATABASE()`,
    );
    return { tables: Number(row.total), hasHistory: Number(row.history) > 0 };
  } finally {
    await connection.end();
  }
}

function bootstrapFromSchema() {
  const schemaFile = join(tmpdir(), "ecoponto-schema.sql");
  console.log("[deploy] Banco vazio: criando a estrutura a partir do schema.prisma.");
  runPrisma(
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
    "--output",
    schemaFile,
  );
  runPrisma("db", "execute", "--file", schemaFile);

  const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  console.log(`[deploy] Marcando ${migrations.length} migrations como aplicadas.`);
  for (const migration of migrations) {
    runPrisma("migrate", "resolve", "--applied", migration);
  }
}

const state = await readDatabaseState();

if (!state.hasHistory && process.env.DB_BOOTSTRAP_FROM_SCHEMA === "true") {
  if (state.tables > 0) {
    console.error(
      "[deploy] O banco tem tabelas, mas não tem histórico do Prisma (_prisma_migrations). " +
        "Confira o banco manualmente antes de subir; nada foi alterado.",
    );
    process.exit(1);
  }
  bootstrapFromSchema();
}

runPrisma("migrate", "deploy");

await import("../../dist/server.js");
