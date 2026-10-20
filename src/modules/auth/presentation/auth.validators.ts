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
