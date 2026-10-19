import { z } from "zod";

// Google accepts URL/filename-safe session tokens up to 36 chars (a UUID fits exactly).
const sessionTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,36}$/, "sessionToken inválido")
  .optional();

// Query strings arrive as text. z.coerce.number() would turn "" into 0, so only plain
// decimal numbers are accepted before converting.
function coordinateSchema(name: string, limit: number) {
  return z
    .string()
    .trim()
    .regex(/^-?\d{1,3}(\.\d{1,15})?$/, `${name} inválida`)
    .transform(Number)
    .pipe(
      z.number().min(-limit, `${name} fora do intervalo`).max(limit, `${name} fora do intervalo`),
    )
    .optional();
}

export const autocompleteQuerySchema = z
  .strictObject({
    input: z
      .string()
      .trim()
      .min(3, "Digite pelo menos 3 caracteres")
      .max(200, "Busca muito longa")
      .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), "Busca contém caracteres inválidos"),
    sessionToken: sessionTokenSchema,
    latitude: coordinateSchema("latitude", 90),
    longitude: coordinateSchema("longitude", 180),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    path: ["latitude"],
    message: "latitude e longitude devem ser informadas juntas",
  });

export const placeDetailsParamsSchema = z.strictObject({
  // Google place ids are URL-safe base64-like strings; anything else never reaches Google.
  placeId: z.string().regex(/^[A-Za-z0-9_-]{1,512}$/, "placeId inválido"),
});

export const placeDetailsQuerySchema = z.strictObject({
  sessionToken: sessionTokenSchema,
});

export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;
export type PlaceDetailsParams = z.infer<typeof placeDetailsParamsSchema>;
export type PlaceDetailsQuery = z.infer<typeof placeDetailsQuerySchema>;
