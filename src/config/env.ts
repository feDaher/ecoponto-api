import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3333),
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
