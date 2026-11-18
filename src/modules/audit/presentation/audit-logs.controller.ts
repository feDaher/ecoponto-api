import type { Request, Response } from "express";
import { ListAuditLogsUseCase } from "../domain/use-cases/ListAuditLogsUseCase";
import { PrismaAuditLogRepository } from "../infra/repositories/PrismaAuditLogRepository";
import { toListAuditLogsParams, type ListAuditLogsQuery } from "./audit-logs.validators";

const listAuditLogsUseCase = new ListAuditLogsUseCase(new PrismaAuditLogRepository());

export async function listAuditLogs(req: Request, res: Response) {
  // `validate(..., "query")` já trocou `req.query` pelo valor parseado (cursor decodificado).
  const query = req.query as unknown as ListAuditLogsQuery;

  const result = await listAuditLogsUseCase.execute(toListAuditLogsParams(query));

  res.status(200).json(result);
}
