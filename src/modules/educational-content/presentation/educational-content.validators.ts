import { z } from "zod";

export const createEducationalContentSchema = z.object({
  categoryId: z.string().min(1).optional(),
  title: z.string().min(1),
  content: z.string().min(1),
});

export const updateEducationalContentSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined || data.content !== undefined || data.categoryId !== undefined,
    {
      message: "At least one field must be provided",
    },
  );
