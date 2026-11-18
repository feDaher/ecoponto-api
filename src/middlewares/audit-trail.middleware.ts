import type { NextFunction, Request, Response } from "express";
import { AuditAction } from "../modules/audit/domain/entities/AuditEntry";
import type { IAuditLogRepository } from "../modules/audit/domain/repositories/IAuditLogRepository";
import { PrismaAuditLogRepository } from "../modules/audit/infra/repositories/PrismaAuditLogRepository";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const RESOURCE_ID_PARAMS = ["id", "collectionPointId", "categoryId"] as const;

/**
 * Leituras não são auditadas por padrão. Uma rota cuja leitura precisa ser registrada
 * (ex.: consultar a própria trilha de auditoria, exigência da LGPD) declara a ação com
 * `auditRead(...)`, que só vira registro se a resposta for 2xx.
 */
export function auditRead(action: AuditAction) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.auditReadAction = action;
    next();
  };
}

function resolveAction(
  method: string,
  statusCode: number,
  readAction: AuditAction | undefined,
): AuditAction | null {
  if (statusCode === 403) {
    return AuditAction.ACCESS_DENIED;
  }
  if (readAction && statusCode >= 200 && statusCode < 300) {
    return readAction;
  }
  if (MUTATING_METHODS.has(method) && statusCode < 400) {
    return AuditAction.RESOURCE_CHANGED;
  }

  return null;
}

function resolveResourceId(params: Record<string, string | string[]> | undefined) {
  for (const name of RESOURCE_ID_PARAMS) {
    const value = params?.[name];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

export function createAuditTrail(repository: IAuditLogRepository) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      const action = req.user
        ? resolveAction(req.method, res.statusCode, res.locals.auditReadAction)
        : null;

      if (!req.user || !action) {
        return;
      }

      const route = req.route ? `${req.baseUrl}${req.route.path}` : null;

      repository
        .record({
          userId: req.user.id,
          action,
          method: req.method,
          route,
          resourceId: resolveResourceId(res.locals.requestParams),
          statusCode: res.statusCode,
        })
        .catch((error: unknown) => {
          console.error("[audit-trail] failed to record entry", {
            action,
            route,
            error: error instanceof Error ? error.message : "unknown error",
          });
        });
    });

    next();
  };
}

export const auditTrail = createAuditTrail(new PrismaAuditLogRepository());
