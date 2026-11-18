import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // Read-only replica for report/dashboard queries. Empty or unset → reads use DATABASE_URL.
  DATABASE_REPLICA_URL: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  PORT: z.coerce.number().int().positive().default(3333),
  DB_POOL_LIMIT: z.coerce.number().int().positive().default(20),
  DB_POOL_ACQUIRE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DB_POOL_IDLE_TIMEOUT_S: z.coerce.number().int().positive().default(300),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  // Express "trust proxy". Unset/empty → off (local dev, direct connections). Behind a reverse
  // proxy set it to the number of proxy hops (usually 1) or to the proxy IPs/subnets, comma
  // separated, so the rate limiters see the client IP instead of the proxy's. "true" is
  // rejected: it lets any client spoof X-Forwarded-For and dodge the limiters.
  TRUST_PROXY: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value || value === "false") return false;
      if (/^\d+$/.test(value)) return Number(value);
      if (value === "true") {
        ctx.addIssue({ code: "custom", message: 'use a hop count (e.g. "1") or proxy IPs' });
        return z.NEVER;
      }
      return value;
    }),
  // Allowed browser origins, comma separated (e.g. "https://app.ecoponto.com.br").
  // Unset/empty → any origin, which is safe here because auth uses Bearer tokens, not cookies.
  CORS_ORIGINS: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
        : undefined,
    ),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_API_KEY: z.string().min(1),
  // Server-side key for Places API (New). Optional so the API still boots without it;
  // the /places routes answer 503 until it is set. Never expose it to the web/mobile apps.
  GOOGLE_MAPS_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
