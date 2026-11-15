import { z } from "zod";
import { AuditAction } from "../../domain/entities/AuditEntry";
import type { ListAuditLogsParams } from "../../domain/repositories/IAuditLogRepository";
import { AppError } from "../../../../shared/errors/AppError";

const auditLogCursorSchema = z.strictObject({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export function decodeAuditLogCursor(value: string) {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      return auditLogCursorSchema.safeParse(null);
    }
    const bytes = Buffer.from(value, "base64url");

    if (bytes.toString("base64url") !== value) {
      return auditLogCursorSchema.safeParse(null);
    }

    const decoded = bytes.toString("utf8");
    const parsed: unknown = JSON.parse(decoded);

    return auditLogCursorSchema.safeParse(parsed);
  } catch {
    return auditLogCursorSchema.safeParse(null);
  }
}

export const listAuditLogsQuerySchema = z
  .strictObject({
    action: z.enum([AuditAction.ACCESS_DENIED, AuditAction.RESOURCE_CHANGED]).optional(),

    userId: z.uuid().optional(),

    route: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z
      .string()
      .min(1)
      .max(512)
      .refine((value) => decodeAuditLogCursor(value).success, {
        message: "Invalid audit log cursor",
      })
      .optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.from || !data.to) return;

    const from = new Date(data.from);
    const to = new Date(data.to);

    const maxPeriodMs = 90 * 24 * 60 * 60 * 1000;

    if (from > to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be greater than or equal to from",
      });
    }

    if (to.getTime() - from.getTime() > maxPeriodMs) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "Date range cannot exceed 90 days",
      });
    }
  });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export function toListAuditLogsParams(query: ListAuditLogsQuery): ListAuditLogsParams {
  const decodedCursor = query.cursor ? decodeAuditLogCursor(query.cursor) : null;
  if (decodedCursor && !decodedCursor.success) {
    throw new AppError("Invalid audit log cursor", 400);
  }
  const cursor = decodedCursor?.success
    ? {
        createdAt: new Date(decodedCursor.data.createdAt),
        id: decodedCursor.data.id,
      }
    : undefined;
  return {
    filters: {
      action: query.action,
      userId: query.userId,
      route: query.route,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    },
    limit: query.limit,
    cursor,
  };
}
