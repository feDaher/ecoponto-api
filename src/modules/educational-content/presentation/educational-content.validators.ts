import { z } from "zod";

export const createEducationalContentSchema = z.object({
  categoryId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(191),
  content: z.string().trim().min(1),
});

export const updateEducationalContentSchema = z
  .object({
    categoryId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(191).optional(),
    content: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined || data.content !== undefined || data.categoryId !== undefined,
    {
      message: "At least one field must be provided",
    },
  );
