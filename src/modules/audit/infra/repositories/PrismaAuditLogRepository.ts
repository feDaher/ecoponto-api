import { prisma } from "../../../../config/prisma";
import type { AuditEntry } from "../../domain/entities/AuditEntry";
import type {
  IAuditLogRepository,
  ListAuditLogsParams,
  AuditLogRecord,
} from "../../domain/repositories/IAuditLogRepository";

export class PrismaAuditLogRepository implements IAuditLogRepository {
  async record(entry: AuditEntry) {
    await prisma.auditLog.create({ data: entry });
  }
  async findMany(params: ListAuditLogsParams): Promise<AuditLogRecord[]> {
    const filters = {
      ...(params.filters.action !== undefined && {
        action: params.filters.action,
      }),
      ...(params.filters.userId !== undefined && {
        userId: params.filters.userId,
      }),
      ...(params.filters.route !== undefined && {
        route: params.filters.route,
      }),
      createdAt: {
        ...(params.filters.from !== undefined && {
          gte: params.filters.from,
        }),
        ...(params.filters.to !== undefined && {
          lte: params.filters.to,
        }),
      },
    };
    const cursorCondition = params.cursor
      ? {
          OR: [
            { createdAt: { lt: params.cursor.createdAt } },
            {
              createdAt: params.cursor.createdAt,
              id: { lt: params.cursor.id },
            },
          ],
        }
      : {};
    return prisma.auditLog.findMany({
      where: {
        AND: [filters, cursorCondition],
      },
      take: params.limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }
}
