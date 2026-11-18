import type { IAuditLogRepository, ListAuditLogsParams } from "../repositories/IAuditLogRepository";
import { encodeAuditLogCursor } from "../rules/audit-log-cursor";

export class ListAuditLogsUseCase {
  constructor(private readonly auditLogRepository: IAuditLogRepository) {}

  async execute(params: ListAuditLogsParams) {
    // O repositório traz `limit + 1` linhas: a sobra só indica que existe próxima página.
    const logs = await this.auditLogRepository.findMany(params);
    const hasNextPage = logs.length > params.limit;
    const items = logs.slice(0, params.limit);
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor: hasNextPage && lastItem ? encodeAuditLogCursor(lastItem) : null,
    };
  }
}
