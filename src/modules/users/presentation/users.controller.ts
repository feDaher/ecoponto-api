import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError";
import { PrismaUserRepository } from "../../auth/infra/repositories/PrismaUserRepository";
import { FirebaseUserManager } from "../../auth/infra/repositories/FirebaseUserManager";
import { BlockUserUseCase } from "../domain/use-cases/BlockUserUseCase";
import { UnblockUserUseCase } from "../domain/use-cases/UnblockUserUseCase";
import { UpdateUserRoleUseCase } from "../domain/use-cases/UpdateUserRoleUseCase";
import type { Role } from "../../../generated/prisma/enums";
import { ListUsersUseCase } from "../domain/use-cases/ListUsersUseCase";

const userRepository = new PrismaUserRepository();
const firebaseUserManager = new FirebaseUserManager();

const blockUserUseCase = new BlockUserUseCase(userRepository, firebaseUserManager);

const unblockUserUseCase = new UnblockUserUseCase(userRepository, firebaseUserManager);

const updateUserRoleUseCase = new UpdateUserRoleUseCase(userRepository);

const listUsersUseCase = new ListUsersUseCase(userRepository);

export async function blockUser(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const user = await blockUserUseCase.execute(req.user.id, req.params.id);

  res.status(200).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
  });
}

export async function unblockUser(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const user = await unblockUserUseCase.execute(req.user.id, req.params.id);

  res.status(200).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
  });
}

export async function updateUserRole(
  req: Request<{ id: string }, unknown, { role: Role }>,
  res: Response,
) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const user = await updateUserRoleUseCase.execute(req.user.id, req.params.id, req.body.role);

  res.status(200).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
  });
}

export async function listUsers(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const users = await listUsersUseCase.execute();

  const formattedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isBlocked: user.isBlocked,
  }));

  res.status(200).json(formattedUsers);
}
