import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../config/firebase";
import { prisma } from "../config/prisma";
import { AppError } from "../shared/errors/AppError";

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Missing or invalid Authorization header", 401);
    }

    const idToken = authHeader.slice("Bearer ".length);
    const decoded = await firebaseAuth.verifyIdToken(idToken);

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (!user) {
      throw new AppError("User is not registered", 401);
    }

    req.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError("Invalid or expired token", 401));
  }
}
