import { z } from "zod";
import { Role } from "../../../generated/prisma/enums";

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
  phone: z.string().min(8),
  city: z.string().min(1),
  role: z.enum([Role.CITIZEN, Role.COLLECTOR]).default(Role.CITIZEN),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});
