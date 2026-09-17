import type { Request, Response } from "express";
import { firebaseAuth } from "../../../config/firebase";
import { AppError } from "../../../shared/errors/AppError";
import { LoginUserUseCase } from "../domain/use-cases/LoginUserUseCase";
import { RegisterUserUseCase } from "../domain/use-cases/RegisterUserUseCase";
import { FirebaseAuthRestClient } from "../infra/http/FirebaseAuthRestClient";
import { PrismaUserRepository } from "../infra/repositories/PrismaUserRepository";

const userRepository = new PrismaUserRepository();
const registerUserUseCase = new RegisterUserUseCase(userRepository, firebaseAuth);
const loginUserUseCase = new LoginUserUseCase(userRepository, new FirebaseAuthRestClient());

export async function register(req: Request, res: Response) {
  const user = await registerUserUseCase.execute(req.body);
  res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
  const result = await loginUserUseCase.execute(req.body);
  res.status(200).json(result);
}

export function me(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  res.status(200).json(req.user);
}
