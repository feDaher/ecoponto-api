import { Role } from "../../generated/prisma/enums";
import { AppError } from "../errors/AppError";

export interface Principal {
  id: string;
  role: Role;
}

export function isOwner(principal: Principal, ownerId: string) {
  return principal.id === ownerId;
}

export function isOwnerOrAdmin(principal: Principal, ownerId: string) {
  return principal.role === Role.ADMIN || isOwner(principal, ownerId);
}

export function assertOwner(
  principal: Principal,
  ownerId: string,
  message = "You can only manage your own resources",
) {
  if (!isOwner(principal, ownerId)) {
    throw new AppError(message, 403);
  }
}

export function assertOwnerOrAdmin(
  principal: Principal,
  ownerId: string,
  message = "You can only manage your own resources",
) {
  if (!isOwnerOrAdmin(principal, ownerId)) {
    throw new AppError(message, 403);
  }
}
