import { prisma } from "../../../../config/prisma";
import type { AuditEntry } from "../../domain/entities/AuditEntry";
import type { IAuditLogRepository } from "../../domain/repositories/IAuditLogRepository";

export class PrismaAuditLogRepository implements IAuditLogRepository {
  async record(entry: AuditEntry) {
    await prisma.auditLog.create({ data: entry });
  }
}
