import type {
  IAuditLogRepository,
  ListAuditLogsParams,
} from "../../domain/repositories/IAuditLogRepository";

export class ListAuditLogsUseCase {
  constructor(private readonly auditLogRepository: IAuditLogRepository) {}
  async execute(params: ListAuditLogsParams) {
    const logs = await this.auditLogRepository.findMany(params);
    const hasNextPage = logs.length > params.limit;
    const items = logs.slice(0, params.limit);
    const lastItem = items.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(
            JSON.stringify({
              createdAt: lastItem.createdAt.toISOString(),
              id: lastItem.id,
            }),
          ).toString("base64url")
        : null;

    return {
      items,
      nextCursor,
    };
  }
}
