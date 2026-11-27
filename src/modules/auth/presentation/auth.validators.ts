import { z } from "zod";
import { Role } from "../../../generated/prisma/enums";

// Prisma maps String to VARCHAR(191) on MySQL: longer values would fail as a 500 on insert.
const MAX_TEXT = 191;

// Firebase stores emails lowercased; normalizing here keeps the local User row in sync.
const email = z.string().trim().toLowerCase().max(MAX_TEXT).pipe(z.email());

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(MAX_TEXT),
  email,
  password: z.string().min(6).max(128),
  phone: z.string().trim().min(8).max(20),
  city: z.string().trim().min(1).max(MAX_TEXT),
  role: z.enum([Role.CITIZEN, Role.COLLECTOR]).default(Role.CITIZEN),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(6).max(128),
});

// Firebase refresh tokens are opaque strings of a few hundred chars; the cap only stops abuse.
export const refreshSchema = z.strictObject({
  refreshToken: z.string().trim().min(1).max(4096),
});

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z
      .string({ error: "Informe a senha atual" })
      .min(1, "Informe a senha atual")
      .max(128, "A senha atual pode ter no máximo 128 caracteres"),
    newPassword: z
      .string({ error: "Informe a nova senha" })
      .min(8, "A nova senha deve ter pelo menos 8 caracteres")
      .max(128, "A nova senha pode ter no máximo 128 caracteres")
      .regex(/\p{L}/u, "A nova senha deve ter pelo menos uma letra")
      .regex(/\d/, "A nova senha deve ter pelo menos um número"),
  })
  .refine((body) => body.newPassword !== body.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha deve ser diferente da senha atual",
  });

export type ChangePasswordBody = z.output<typeof changePasswordSchema>;
