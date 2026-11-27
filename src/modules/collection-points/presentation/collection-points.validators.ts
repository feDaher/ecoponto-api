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
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

function IsValidCnpj(value: string) {
  const cnpj = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

  const CalculateDigit = (base: string, weights: number[]) => {
    const sum = [...base].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index],
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = CalculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = CalculateDigit(
    `${cnpj.slice(0, 12)}${firstDigit}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
}

const CooperativeConfigurationSchema = z.object({
  cooperativeName: z.string().trim().min(1).max(191),
  cnpj: z
    .string()
    .max(18)
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .refine(IsValidCnpj, "Informe um CNPJ válido."),
  street: z.string().trim().min(1).max(150),
  streetNumber: z.string().trim().min(1).max(20),
  neighborhood: z.string().trim().min(1).max(191),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(states, "Informe a sigla de um estado brasileiro.")),
  postalCode: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => /^\d{8}$/.test(value), "Informe um CEP válido."),
  email: z.string().trim().email().max(254),
});

const collectionPointFields = z.object({
  name: z.string().trim().min(1).max(191),
  description: z.string().trim().max(2000).optional(),
  city: z.string().trim().min(1).max(191),
  address: z.string().trim().min(1).max(191),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  placeId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,512}$/, "placeId must contain only letters, digits, _ or -")
    .optional(),
  whatsappContact: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .regex(/^\+?[0-9\s().-]+$/, "Informe um telefone válido.")
    .refine((value) => value.replace(/\D/g, "").length >= 8, "Informe um telefone válido.")
    .optional(),
  showWhatsappContact: z.boolean().default(false),
  wasteCategories: z
    .array(z.string().trim().min(1).max(191))
    .min(1)
    .refine((categories) => new Set(categories).size === categories.length, {
      message: "As categorias de resíduos não podem se repetir.",
    }),
  cooperative: CooperativeConfigurationSchema.optional(),
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

const operatingHoursSchema = z
  .array(
    z
      .object({
        weekday: z.enum(weekdays),
        openTime: timeOfDay,
        closeTime: timeOfDay,
      })
      .refine((hour) => hour.openTime < hour.closeTime, {
        path: ["closeTime"],
        message: "O horário de fechamento deve ser depois do horário de abertura",
      }),
  )
  .min(1)
  .max(28)
  .superRefine((hours, context) => {
    const ordered = [...hours].sort(
      (left, right) =>
        weekdays.indexOf(left.weekday) - weekdays.indexOf(right.weekday) ||
        left.openTime.localeCompare(right.openTime),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (previous.weekday === current.weekday && current.openTime < previous.closeTime) {
        context.addIssue({
          code: "custom",
          path: [hours.indexOf(current), "openTime"],
          message: "Os horários do mesmo dia não podem se sobrepor.",
        });
      }
    }
  });

// POST: horários obrigatórios
export const collectionPointSchema = collectionPointFields
  .extend({
    operatingHours: operatingHoursSchema,
  })
  .superRefine(whatsappRule);

// PUT: horários opcionais para salvar toda a configuração do ponto de forma conjunta.
export const collectionPointUpdateSchema = collectionPointFields
  .extend({
    operatingHours: operatingHoursSchema.optional(),
  })
  .superRefine(whatsappRule);

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

export const updateCollectionPointMaterialSettingsSchema = z
  .strictObject({
    capacityKg: z
      .number()
      .positive()
      .max(100_000)
      .refine((capacity) => Number(capacity.toFixed(3)) === capacity, {
        message: "capacityKg aceita no máximo três casas decimais",
      })
      .nullable()
      .optional(),
    isAccepting: z.boolean().optional(),
  })
  .refine((settings) => settings.capacityKg !== undefined || settings.isAccepting !== undefined, {
    message: "Informe capacityKg, isAccepting ou ambos",
  });

export type UpdateCollectionPointMaterialSettingsBody = z.infer<
  typeof updateCollectionPointMaterialSettingsSchema
>;
