import { z } from "zod";

export const createWasteCategorySchema = z.object({
  name: z.string().trim().min(1).max(191),
});

export const updateWasteCategorySchema = z.object({
  name: z.string().trim().min(1).max(191),
});
