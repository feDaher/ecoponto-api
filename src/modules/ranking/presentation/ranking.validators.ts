import { z } from "zod";

const city = z.string().trim().min(1).max(100).optional();

export const rankingQuerySchema = z.strictObject({
  city,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const myRankingQuerySchema = z.strictObject({ city });

export type RankingQuery = z.infer<typeof rankingQuerySchema>;
export type MyRankingQuery = z.infer<typeof myRankingQuerySchema>;
