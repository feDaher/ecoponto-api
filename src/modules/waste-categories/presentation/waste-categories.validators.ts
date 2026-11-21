import { z } from "zod";

const wasteClassSchema = z.enum(["CLASS_I", "CLASS_IIA", "CLASS_IIB"]);

export const createWasteCategorySchema = z.object({
  name: z.string().trim().min(1).max(191),
  label: z.string().trim().min(1).max(191).optional().nullable(),
  wasteClass: wasteClassSchema.optional().nullable(),
});

export const updateWasteCategorySchema = z.object({
  name: z.string().trim().min(1).max(191),
  label: z.string().trim().min(1).max(191).optional().nullable(),
  wasteClass: wasteClassSchema.optional().nullable(),
});
