import { z } from "zod";
import { ReviewVisibility } from "../domain/entities/Review";

export const reviewIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const collectionPointIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
};

export const listCollectionPointReviewsQuerySchema = z.strictObject(pagination);

// Comentário em branco vira null: a avaliação pode ser só a nota.
export const publishReviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((value) => value || null),
});

export const listReviewsForModerationQuerySchema = z.strictObject({
  ...pagination,
  visibility: z
    .enum([ReviewVisibility.VISIBLE, ReviewVisibility.HIDDEN, ReviewVisibility.ALL])
    .default(ReviewVisibility.ALL),
  collectionPointId: z.uuid().optional(),
});

export type ListCollectionPointReviewsQuery = z.infer<typeof listCollectionPointReviewsQuerySchema>;
export type ListReviewsForModerationQuery = z.infer<typeof listReviewsForModerationQuerySchema>;
