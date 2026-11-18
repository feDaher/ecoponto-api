import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors/AppError";

// Client errors raised by express.json() (body-parser): they carry a 4xx `status`, a `type`
// and `expose: true`. Fixed messages, so parser internals never reach the client.
const BODY_PARSER_MESSAGES: Record<string, string> = {
  "entity.parse.failed": "Malformed JSON body",
  "entity.too.large": "Request body too large",
  "encoding.unsupported": "Unsupported content encoding",
  "charset.unsupported": "Unsupported charset",
  "request.aborted": "Request aborted",
  "request.size.invalid": "Request size did not match content length",
};

function bodyParserError(err: unknown): { status: number; message: string } | undefined {
  if (typeof err !== "object" || err === null) return undefined;

  const { status, type, expose } = err as { status?: unknown; type?: unknown; expose?: unknown };
  if (expose !== true || typeof status !== "number" || status < 400 || status > 499)
    return undefined;

  const message = typeof type === "string" ? BODY_PARSER_MESSAGES[type] : undefined;
  return { status, message: message ?? "Invalid request" };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  const clientError = bodyParserError(err);
  if (clientError) {
    res.status(clientError.status).json({ message: clientError.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
