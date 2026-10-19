import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

const poolOptions = {
  connectionLimit: env.DB_POOL_LIMIT,
  acquireTimeout: env.DB_POOL_ACQUIRE_TIMEOUT_MS,
  idleTimeout: env.DB_POOL_IDLE_TIMEOUT_S,
  connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
};

const databaseUrl = new URL(env.DATABASE_URL);

for (const [option, value] of Object.entries(poolOptions)) {
  if (!databaseUrl.searchParams.has(option)) {
    databaseUrl.searchParams.set(option, String(value));
  }
}

const adapter = new PrismaMariaDb(databaseUrl.toString());

export const prisma = new PrismaClient({ adapter });
