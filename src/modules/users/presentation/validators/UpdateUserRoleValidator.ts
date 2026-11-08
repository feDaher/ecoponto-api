import { z } from "zod";
import { Role } from "../../../../generated/prisma/enums";

export const updateUserRoleSchema = z.strictObject({
  role: z.enum(Role),
});
