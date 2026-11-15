import type { Request, Response } from "express";
import { PrismaAuditLogRepository } from "../infra/repositories/PrismaAuditLogRepository";
import { ListAuditLogsUseCase } from "../application/use-cases/ListAuditLogsUseCase";
import {
  toListAuditLogsParams,
  type ListAuditLogsQuery,
} from "./validators/listAuditLogsValidator";

const auditLogRepository = new PrismaAuditLogRepository();

const listAuditLogsUseCase = new ListAuditLogsUseCase(auditLogRepository);

export async function listAuditLogs(req: Request, res: Response) {
  const query = req.query as unknown as ListAuditLogsQuery;

  const params = toListAuditLogsParams(query);

  const result = await listAuditLogsUseCase.execute(params);

  res.status(200).json(result);
}
