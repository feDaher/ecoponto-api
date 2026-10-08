import { z } from "zod";

const weekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export const collectionPointSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    city: z.string().trim().min(1),
    address: z.string().trim().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    whatsappContact: z.string().trim().min(8).optional(),
    showWhatsappContact: z.boolean().default(false),
    wasteCategories: z
      .array(
        z.enum([
          "PLASTIC",
          "PAPER",
          "METALS",
          "GLASS",
          "COOKING_OIL",
          "ELECTRONICS",
          "BATTERIES",
          "CELL_PHONES",
          "COMPUTERS",
          "PRINTERS",
          "TELEVISIONS",
        ]),
      )
      .min(1),
    operatingHours: z
      .array(
        z.object({
          weekday: z.enum(weekdays),
          openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .min(1),
  })
  .superRefine((value, context) => {
    if (value.showWhatsappContact && !value.whatsappContact) {
      context.addIssue({
        code: "custom",
        path: ["whatsappContact"],
        message: "Um número de WhatsApp é necessário quando a exibição pública está ativada",
      });
    }
  });

export const reviewSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "REJECTED" && !value.rejectionReason) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Uma razão de rejeição é necessária quando rejeitando um ponto",
      });
    }
    if (value.status === "APPROVED" && value.rejectionReason) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "A razão de rejeição só é válida quando rejeitando um ponto",
      });
    }
  });
