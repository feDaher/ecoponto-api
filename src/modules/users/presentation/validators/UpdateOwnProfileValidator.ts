import { z } from "zod";

const MAX_TEXT = 191;
const MAX_NICKNAME = 60;
const PERSON_TEXT = /^[\p{L}\s'.-]+$/u;
const PHONE_MASK = /^[\d\s().-]*$/;

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

const countWords = (value: string) => value.split(" ").filter((word) => /\p{L}/u.test(word)).length;

export const updateOwnProfileSchema = z.strictObject({
  name: z
    .string()
    .transform(collapseSpaces)
    .pipe(
      z
        .string()
        .min(1, "Informe o nome")
        .max(MAX_TEXT, "O nome pode ter no máximo 191 caracteres")
        .regex(PERSON_TEXT, "O nome deve conter apenas letras, espaços e os caracteres ' . -")
        .refine((name) => countWords(name) >= 2, "Informe nome e sobrenome"),
    ),
  phone: z
    .string()
    .trim()
    .regex(PHONE_MASK, "Telefone inválido")
    .transform((phone) => phone.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{10,11}$/, "O telefone deve ter DDD + número (10 ou 11 dígitos)")),
  city: z
    .string()
    .transform(collapseSpaces)
    .pipe(
      z
        .string()
        .min(2, "Informe a cidade")
        .max(MAX_TEXT, "A cidade pode ter no máximo 191 caracteres")
        .regex(PERSON_TEXT, "A cidade deve conter apenas letras, espaços e os caracteres ' . -"),
    ),
  nickname: z
    .string({ error: "O apelido deve ser um texto" })
    .transform(collapseSpaces)
    .pipe(
      z.union([
        z.literal(""),
        z
          .string()
          .max(MAX_NICKNAME, "O apelido pode ter no máximo 60 caracteres")
          .regex(PERSON_TEXT, "O apelido deve conter apenas letras, espaços e os caracteres ' . -"),
      ]),
    )
    .transform((nickname) => (nickname === "" ? null : nickname))
    .nullable()
    .optional(),
  preferences: z
    .strictObject({
      collectionAlerts: z
        .boolean({ error: "Os alertas de coleta devem ser verdadeiro ou falso" })
        .optional(),
      monthlyReports: z
        .boolean({ error: "O relatório mensal deve ser verdadeiro ou falso" })
        .optional(),
      cooperativeContact: z
        .boolean({ error: "O contato de cooperativas deve ser verdadeiro ou falso" })
        .optional(),
    })
    .optional(),
});

export type UpdateOwnProfileInput = z.output<typeof updateOwnProfileSchema>;
