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

  req.user = {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    role: user.role,
  };
  res.locals.requestParams = { ...req.params };

  next();
}
