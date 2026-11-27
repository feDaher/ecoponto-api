import { z } from "zod";
import { AuditAction } from "../domain/entities/AuditEntry";
import type { ListAuditLogsParams } from "../domain/repositories/IAuditLogRepository";
import { decodeAuditLogCursor } from "../domain/rules/audit-log-cursor";

const MAX_PERIOD_DAYS = 90;
const MAX_PERIOD_MS = MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export const listAuditLogsQuerySchema = z
  .strictObject({
    action: z
      .enum([AuditAction.ACCESS_DENIED, AuditAction.RESOURCE_CHANGED, AuditAction.AUDIT_LOG_VIEWED])
      .optional(),
    userId: z.uuid().optional(),
    route: z.string().trim().min(1).max(191).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z
      .string()
      .min(1)
      .max(512)
      .transform((value, ctx) => {
        const cursor = decodeAuditLogCursor(value);
        if (!cursor) {
          ctx.addIssue({ code: "custom", message: "Invalid audit log cursor" });
          return z.NEVER;
        }
        return cursor;
      })
      .optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((data, ctx) => {
    // O limite de 90 dias só vale se o período for fechado: aceitar só `from` (ou só `to`)
    // abriria uma janela sem limite. Os dois vêm juntos ou nenhum.
    if ((data.from === undefined) !== (data.to === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: [data.from === undefined ? "from" : "to"],
        message: "from and to must be sent together",
      });
      return;
    }

    if (!data.from || !data.to) return;

    const from = new Date(data.from);
    const to = new Date(data.to);

    if (from > to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be greater than or equal to from",
      });
    }

    if (to.getTime() - from.getTime() > MAX_PERIOD_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Date range cannot exceed ${MAX_PERIOD_DAYS} days`,
      });
    }
  });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export function toListAuditLogsParams(query: ListAuditLogsQuery): ListAuditLogsParams {
  return {
    filters: {
      action: query.action,
      userId: query.userId,
      route: query.route,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    },
    limit: query.limit,
    cursor: query.cursor,
  };
}
