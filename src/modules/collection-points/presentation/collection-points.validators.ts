import { z } from "zod";

export const wasteTypes = [
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
] as const;

const weekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const collectionPointFields = z.object({
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
});

const whatsappRule = (
  value: { showWhatsappContact: boolean; whatsappContact?: string },
  context: z.RefinementCtx,
) => {
  if (value.showWhatsappContact && !value.whatsappContact) {
    context.addIssue({
      code: "custom",
      path: ["whatsappContact"],
      message: "Um número de WhatsApp é necessário quando a exibição pública está ativada",
    });
  }
};

// POST: horários obrigatórios
export const collectionPointSchema = collectionPointFields
  .extend({
    operatingHours: z
      .array(
        z.object({
          weekday: z.enum(weekdays),
          openTime: timeOfDay,
          closeTime: timeOfDay,
        }),
      )
      .min(1),
  })
  .superRefine(whatsappRule);

// PUT: sem horários (alterados só pelas rotas /operating-hours)
export const collectionPointUpdateSchema = collectionPointFields.superRefine(whatsappRule);

export type CollectionPointInput = z.infer<typeof collectionPointSchema>;
export type CollectionPointUpdateInput = z.infer<typeof collectionPointUpdateSchema>;

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

const SEARCH_DEFAULT_LIMIT = 100;
const SEARCH_MAX_LIMIT = 500;
const SEARCH_MAX_RADIUS_KM = 100;

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

function optionalQuery<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankToUndefined, schema.optional());
}

function decimalQuery(name: string) {
  return z
    .string()
    .trim()
    .regex(/^-?\d{1,3}(\.\d{1,15})?$/, `${name} inválida`)
    .transform(Number);
}

const wasteTypeListSchema = z
  .string()
  .transform((value) => [...new Set(value.split(",").map((item) => item.trim()))])
  .pipe(
    z
      .array(
        z
          .string()
          .regex(/^[A-Za-z0-9_]{1,191}$/, "Tipo de resíduo inválido")
          .min(1),
      )
      .min(1)
      .max(20, "Informe no máximo 20 tipos de resíduo"),
  );

export const searchCollectionPointsQuerySchema = z
  .object({
    city: optionalQuery(z.string().trim().min(1).max(100, "Cidade muito longa")),
    wasteType: optionalQuery(wasteTypeListSchema),
    latitude: optionalQuery(
      decimalQuery("latitude").pipe(
        z.number().min(-90, "latitude fora do intervalo").max(90, "latitude fora do intervalo"),
      ),
    ),
    longitude: optionalQuery(
      decimalQuery("longitude").pipe(
        z.number().min(-180, "longitude fora do intervalo").max(180, "longitude fora do intervalo"),
      ),
    ),
    radius: optionalQuery(
      z
        .string()
        .trim()
        .regex(/^\d{1,3}(\.\d{1,3})?$/, "raio inválido")
        .transform(Number)
        .pipe(
          z
            .number()
            .positive("raio deve ser maior que zero")
            .max(SEARCH_MAX_RADIUS_KM, `raio máximo de ${SEARCH_MAX_RADIUS_KM} km`),
        ),
    ),
    limit: optionalQuery(
      z
        .string()
        .trim()
        .regex(/^\d{1,4}$/, "limit inválido")
        .transform(Number)
        .pipe(
          z
            .number()
            .int()
            .min(1, "limit deve ser maior que zero")
            .max(SEARCH_MAX_LIMIT, `limit máximo de ${SEARCH_MAX_LIMIT}`),
        ),
    ).transform((value) => value ?? SEARCH_DEFAULT_LIMIT),
  })
  .superRefine((value, context) => {
    const hasLatitude = value.latitude !== undefined;
    const hasLongitude = value.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Informe latitude e longitude juntas",
      });
    }

    if (value.radius !== undefined && !(hasLatitude && hasLongitude)) {
      context.addIssue({
        code: "custom",
        path: ["radius"],
        message: "O raio exige latitude e longitude",
      });
    }
  });

export type SearchCollectionPointsQuery = z.output<typeof searchCollectionPointsQuerySchema>;
