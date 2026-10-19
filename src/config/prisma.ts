import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

function createPrismaClient(connectionUrl: string) {
  const databaseUrl = new URL(connectionUrl);

  const adapter = new PrismaMariaDb({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),

    // MySQL 8.4 usa caching_sha2_password: no primeiro login sem TLS o driver precisa
    // buscar a chave pública do servidor. Só habilitado fora de produção (em produção, use TLS).
    allowPublicKeyRetrieval: process.env.NODE_ENV !== "production",

    // Configuração da POOL
    connectionLimit: 10, // limita a pool em 10 conexões
    acquireTimeout: 10_000, // limita a espera em ms para adquirir uma conexão
    connectTimeout: 5_000, // limita o tempo de estabelecimento de conexão
    idleTimeout: 300, // tempo de inatividade
  });

  return new PrismaClient({ adapter });
}

// Primário (master): toda escrita e leitura transacional.
export const prisma = createPrismaClient(env.DATABASE_URL);

// Réplica somente leitura: use apenas em consultas pesadas de relatório/dashboard.
// Sem DATABASE_REPLICA_URL (ex.: ambiente sem réplica), as leituras caem no primário.
export const prismaRead = env.DATABASE_REPLICA_URL
  ? createPrismaClient(env.DATABASE_REPLICA_URL)
  : prisma;
