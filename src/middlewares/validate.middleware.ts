import type { NextFunction, Request, Response } from "express";
import type { ZodType, z } from "zod";
import { AppError } from "../shared/errors/AppError";

export function validate<T extends ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new AppError(`Validation error: ${result.error.issues.map((issue) => issue.message).join(", ")}`, 400));
      return;
    }

    req.body = result.data as z.infer<T>;
    next();
  };
}
