import type { Request, Response } from "express";
import { firebaseAuth } from "../../../config/firebase";
import { AppError } from "../../../shared/errors/AppError";
import { ChangePasswordUseCase } from "../domain/use-cases/ChangePasswordUseCase";
import { LoginUserUseCase } from "../domain/use-cases/LoginUserUseCase";
import { RefreshSessionUseCase } from "../domain/use-cases/RefreshSessionUseCase";
import { RegisterUserUseCase } from "../domain/use-cases/RegisterUserUseCase";
import { FirebaseAuthRestClient } from "../infra/http/FirebaseAuthRestClient";
import { FirebaseUserManager } from "../infra/repositories/FirebaseUserManager";
import { PrismaUserRepository } from "../infra/repositories/PrismaUserRepository";
import type { ChangePasswordBody } from "./auth.validators";
import { toUserResponse } from "./user.presenter";

const userRepository = new PrismaUserRepository();
const firebaseAuthRestClient = new FirebaseAuthRestClient();
const registerUserUseCase = new RegisterUserUseCase(userRepository, firebaseAuth);
const loginUserUseCase = new LoginUserUseCase(userRepository, firebaseAuthRestClient);
const refreshSessionUseCase = new RefreshSessionUseCase(userRepository, firebaseAuthRestClient);
const changePasswordUseCase = new ChangePasswordUseCase(
  userRepository,
  firebaseAuthRestClient,
  new FirebaseUserManager(),
);

export async function register(req: Request, res: Response) {
  const user = await registerUserUseCase.execute(req.body);
  res.status(201).json(toUserResponse(user));
}

export async function login(req: Request, res: Response) {
  const result = await loginUserUseCase.execute(req.body);
  res.status(200).json({ ...result, user: toUserResponse(result.user) });
}

export async function refresh(req: Request, res: Response) {
  const result = await refreshSessionUseCase.execute(req.body);
  res.status(200).json({ ...result, user: toUserResponse(result.user) });
}

export function me(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  res.status(200).json(req.user);
}

export async function changePassword(
  req: Request<unknown, unknown, ChangePasswordBody>,
  res: Response,
) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const result = await changePasswordUseCase.execute({
    firebaseUid: req.user.firebaseUid,
    email: req.user.email,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  res.status(200).json({ ...result, user: toUserResponse(result.user) });
}
