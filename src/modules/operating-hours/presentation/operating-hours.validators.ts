import { z } from "zod";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm format (24h)");

const weekdaySchema = z.number().int().min(0).max(6);

export const createOperatingHoursSchema = z.object({
  weekday: weekdaySchema,
  openTime: timeSchema,
  closeTime: timeSchema,
});

export const updateOperatingHoursSchema = z
  .object({
    weekday: weekdaySchema.optional(),
    openTime: timeSchema.optional(),
    closeTime: timeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
