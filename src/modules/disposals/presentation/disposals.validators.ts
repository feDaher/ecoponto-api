import { z } from "zod";
import { DisposalStatus } from "../../../generated/prisma/enums";
import { MAX_WEIGHT_KG } from "../domain/rules/points-rules";

const id = z.string().trim().min(1).max(191);

export const createDisposalSchema = z.strictObject({
  collectionPointId: id,
  categoryId: id,
  weightKg: z.number().min(0.001).max(MAX_WEIGHT_KG),
  disposedAt: z.coerce.date().optional(),
});

export const updateDisposalStatusSchema = z.strictObject({
  status: z.enum([DisposalStatus.CONFIRMED, DisposalStatus.CANCELLED]),
});

const dateRange = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};

const rangeIsValid = (data: { from?: Date; to?: Date }) =>
  !data.from || !data.to || data.from <= data.to;
const rangeMessage = { message: "'from' must be before or equal to 'to'" };

export const listDisposalsQuerySchema = z
  .strictObject({
    status: z.enum(DisposalStatus).optional(),
    categoryId: id.optional(),
    collectionPointId: id.optional(),
    ...dateRange,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(rangeIsValid, rangeMessage);

export const summaryQuerySchema = z.strictObject(dateRange).refine(rangeIsValid, rangeMessage);
