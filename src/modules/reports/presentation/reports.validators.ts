import { z } from "zod";
import { DisposalStatus } from "../../../generated/prisma/enums";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be formatted as YYYY-MM-DD");

export const reportQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  categoryId: z.uuid().optional(),
  region: z.string().trim().min(1).max(191).optional(),
  status: z
    .enum([DisposalStatus.PENDING, DisposalStatus.CONFIRMED, DisposalStatus.CANCELLED])
    .optional(),
  search: z.string().trim().min(1).max(191).optional(),
});

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(5),
};

export const manifestQuerySchema = reportQuerySchema.extend(paginationShape);

export const exportQuerySchema = reportQuerySchema.extend({
  scope: z.enum(["general", "category", "geospatial", "manifests"]),
  format: z.enum(["csv", "pdf", "geojson", "kml"]),
  ...paginationShape,
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export type ExportQuery = z.infer<typeof exportQuerySchema>;
