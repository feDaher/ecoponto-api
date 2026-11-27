import { z } from "zod";

export const updatePointCategoriesSchema = z.strictObject({
  wasteCategories: z
    .array(z.string().trim().min(1).max(191))
    .min(1, "Informe ao menos uma categoria")
    .max(50, "No máximo 50 categorias")
    .refine((list) => new Set(list).size === list.length, {
      message: "Categorias repetidas",
    }),
});

export const reviewPointCategorySchema = z
  .strictObject({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((d) => d.status !== "REJECTED" || !!d.rejectionReason, {
    message: "Informe o motivo da rejeição",
    path: ["rejectionReason"],
  });
