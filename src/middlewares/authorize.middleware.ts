import type { NextFunction, Request, Response } from "express";
import type { Role } from "../generated/prisma/enums";
import { AppError } from "../shared/errors/AppError";

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError("You do not have permission to access this resource", 403));
      return;
    }

    next();
  };
}
