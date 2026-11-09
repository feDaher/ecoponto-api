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
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    placeId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,512}$/, "placeId must contain only letters, digits, _ or -")
      .optional(),
    whatsappContact: z.string().trim().min(8).optional(),
    showWhatsappContact: z.boolean().default(false),
    wasteCategories: z
      .array(z.string().trim().min(1).max(191))
      .min(1)
      .refine((categories) => new Set(categories).size === categories.length, {
        message: "As categorias de resíduos não podem se repetir.",
      }),
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

export type CollectionPointInput = z.infer<typeof collectionPointSchema>;

const ignoredRepeatedQuery = (value: unknown) => (typeof value === "string" ? value : undefined);
const queryText = z.preprocess(ignoredRepeatedQuery, z.string().trim().optional());
const queryNumber = z.preprocess(
  (value) => (typeof value === "string" ? Number(value) : undefined),
  z.number({ error: "Latitude, longitude ou raio inválido." }).optional(),
);

export const collectionPointSearchSchema = z
  .object({
    city: queryText,
    wasteType: queryText,
    latitude: queryNumber,
    longitude: queryNumber,
    radius: queryNumber,
  })
  .superRefine((query, context) => {
    if (query.radius !== undefined && query.radius <= 0) {
      context.addIssue({
        code: "custom",
        path: ["radius"],
        message: "Latitude, longitude ou raio inválido.",
      });
      return;
    }
    if (
      (query.latitude === undefined) !== (query.longitude === undefined) ||
      (query.radius !== undefined &&
        (query.latitude === undefined || query.longitude === undefined))
    ) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Informe latitude e longitude juntas; o raio exige ambas.",
      });
      return;
    }
    if (
      (query.latitude !== undefined && (query.latitude < -90 || query.latitude > 90)) ||
      (query.longitude !== undefined && (query.longitude < -180 || query.longitude > 180))
    ) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Coordenadas fora dos limites válidos.",
      });
    }
  });

export type CollectionPointSearchQuery = z.infer<typeof collectionPointSearchSchema>;

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
