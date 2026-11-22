import { z } from "zod";

export const updatePointCategoriesSchema = z.strictObject({
  wasteCategories: z
    .array(z.string().trim().min(1))
    .min(1, "Informe ao menos uma categoria")
    .refine((list) => new Set(list).size === list.length, {
      message: "Categorias repetidas",
    }),
});

export const reviewPointCategorySchema = z
  .strictObject({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().min(1).optional(),
  })
  .refine((d) => d.status !== "REJECTED" || !!d.rejectionReason, {
    message: "Informe o motivo da rejeição",
    path: ["rejectionReason"],
  });
