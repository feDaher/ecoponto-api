import type { AuditEntry } from "../entities/AuditEntry";

export interface IAuditLogRepository {
  record(entry: AuditEntry): Promise<void>;
}
