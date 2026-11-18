import { z } from "zod";

/** Posição da última linha de uma página: ordenação é `createdAt DESC, id DESC`. */
export interface AuditLogCursor {
  createdAt: Date;
  id: string;
}

const cursorPayloadSchema = z.strictObject({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export function encodeAuditLogCursor(cursor: AuditLogCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
  ).toString("base64url");
}

/** Decodifica o cursor opaco devolvido pela página anterior; `null` se for inválido. */
export function decodeAuditLogCursor(value: string): AuditLogCursor | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const bytes = Buffer.from(value, "base64url");
  // Rejeita entradas que o decoder "conserta" em silêncio (padding, bits sobrando).
  if (bytes.toString("base64url") !== value) {
    return null;
  }

  try {
    const parsed = cursorPayloadSchema.safeParse(JSON.parse(bytes.toString("utf8")));
    return parsed.success
      ? { createdAt: new Date(parsed.data.createdAt), id: parsed.data.id }
      : null;
  } catch {
    return null;
  }
}
