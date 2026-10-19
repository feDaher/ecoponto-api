import type { Role } from "../../generated/prisma/enums";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        firebaseUid: string;
        email: string;
        role: Role;
      };
    }

    interface Locals {
      requestParams?: Record<string, string | string[]>;
    }
  }
}

export {};
