import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "../generated/prisma/enums";
import { AppError } from "../shared/errors/AppError";

export const AUTHORIZED_ROLES = Symbol("authorizedRoles");

export type RoleGuard = RequestHandler & { readonly [AUTHORIZED_ROLES]: readonly Role[] };

export function authorize(...allowedRoles: Role[]): RoleGuard {
  if (allowedRoles.length === 0) {
    throw new Error("authorize() requires at least one role");
  }

  const roles: readonly Role[] = Object.freeze([...new Set(allowedRoles)]);

  const guard = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError("You do not have permission to access this resource", 403));
      return;
    }

    next();
  };

  return Object.assign(guard, { [AUTHORIZED_ROLES]: roles });
}

export function isRoleGuard(handler: unknown): handler is RoleGuard {
  return typeof handler === "function" && AUTHORIZED_ROLES in handler;
}
