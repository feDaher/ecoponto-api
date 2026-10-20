import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { buildConnectionUrl } from "./database-url";
import { env } from "./env";

const connectionOptions = {
  connectionLimit: env.DB_POOL_LIMIT,
  acquireTimeout: env.DB_POOL_ACQUIRE_TIMEOUT_MS,
  idleTimeout: env.DB_POOL_IDLE_TIMEOUT_S,
  connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
  // MySQL 8.4 uses caching_sha2_password: the first login after the server starts, without
  // TLS, needs the server's RSA public key. Dev only — in production use TLS instead.
  ...(process.env.NODE_ENV !== "production" && { allowPublicKeyRetrieval: true }),
};

function createPrismaClient(connectionUrl: string) {
  const adapter = new PrismaMariaDb(buildConnectionUrl(connectionUrl, connectionOptions));

  return new PrismaClient({ adapter });
}

type ReadMethod =
  | "findUnique"
  | "findUniqueOrThrow"
  | "findFirst"
  | "findFirstOrThrow"
  | "findMany"
  | "count"
  | "aggregate"
  | "groupBy";

type ModelName = {
  [K in keyof PrismaClient]: K extends `$${string}` | symbol ? never : K;
}[keyof PrismaClient];

/** Only the read methods of each model, plus raw SELECTs: writes don't compile. */
export type ReadOnlyPrismaClient = {
  [K in ModelName]: Pick<PrismaClient[K], Extract<keyof PrismaClient[K], ReadMethod>>;
} & Pick<PrismaClient, "$queryRaw" | "$disconnect">;

// Primary (master): every write and every transactional read.
export const prisma = createPrismaClient(env.DATABASE_URL);

// Read-only replica: use it ONLY for heavy report/dashboard queries, which tolerate a few
// seconds of replication lag. Without DATABASE_REPLICA_URL the reads fall back to the primary.
export const prismaRead: ReadOnlyPrismaClient = env.DATABASE_REPLICA_URL
  ? createPrismaClient(env.DATABASE_REPLICA_URL)
  : prisma;
