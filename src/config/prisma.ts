import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

const databaseUrl = new URL(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),

  // Configuração da POOL
  connectionLimit: 10, // limita a pool em 10 conexões
  acquireTimeout: 10_000, // limita a espera em ms para adquirir uma conexão
  connectTimeout: 5_000, // limita o tempo de estabelecimento de conexão
  idleTimeout: 300, // tempo de inatividade
});

export const prisma = new PrismaClient({ adapter });
