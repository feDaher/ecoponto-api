import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../shared/errors/AppError";

type RequestSource = "body" | "query" | "params";

export function validate<T extends ZodType>(schema: T, source: RequestSource = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        new AppError(
          `Validation error: ${result.error.issues.map((issue) => issue.message).join(", ")}`,
          400,
        ),
      );
      return;
    }

    // Express 5 exposes req.query as a getter, so it cannot be reassigned directly.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
