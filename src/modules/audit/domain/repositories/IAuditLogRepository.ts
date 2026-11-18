import type { AuditEntry } from "../entities/AuditEntry";

export interface ListAuditLogsFilters {
  action?: string;
  userId?: string;
  route?: string;
  from?: Date;
  to?: Date;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  method: string | null;
  route: string | null;
  resourceId: string | null;
  statusCode: number | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface ListAuditLogsParams {
  filters: ListAuditLogsFilters;
  limit: number;
  cursor?: {
    createdAt: Date;
    id: string;
  };
}

export interface IAuditLogRepository {
  record(entry: AuditEntry): Promise<void>;
  findMany(params: ListAuditLogsParams): Promise<AuditLogRecord[]>;
}
