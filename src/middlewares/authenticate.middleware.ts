import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../config/firebase";
import { prisma } from "../config/prisma";
import { AppError } from "../shared/errors/AppError";

const BEARER_TOKEN = /^Bearer\s+(\S+)$/i;

function isFirebaseAuthError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("auth/")
  );
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const match = BEARER_TOKEN.exec(req.headers.authorization ?? "");

  if (!match) {
    next(new AppError("Missing or invalid Authorization header", 401));
    return;
  }

  let uid: string;

  try {
    ({ uid } = await firebaseAuth.verifyIdToken(match[1], true));
  } catch (error) {
    if (isFirebaseAuthError(error)) {
      next(new AppError("Invalid or expired token", 401));
      return;
    }

    throw error;
  }

  const user = await prisma.user.findUnique({ where: { firebaseUid: uid } });

  if (!user) {
    next(new AppError("User is not registered", 401));
    return;
  }

  if (user.isBlocked) {
    next(new AppError("User account is blocked", 403));
    return;
  }

  // The profile fields come from the row already loaded above, so `GET /auth/me` can return the
  // whole profile (RB01: name, phone and city) without a second query.
  req.user = {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone,
    city: user.city,
    createdAt: user.createdAt,
  };
  res.locals.requestParams = { ...req.params };

  next();
}
