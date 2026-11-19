import type { Role } from "../../generated/prisma/enums";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        firebaseUid: string;
        email: string;
        role: Role;
        // Profile fields, only read by `GET /auth/me` (guards rely on the four above).
        name?: string;
        phone?: string;
        city?: string;
        createdAt?: Date;
      };
    }

    interface Locals {
      requestParams?: Record<string, string | string[]>;
      auditResourceId?: string;
    }
  }
}

export {};
