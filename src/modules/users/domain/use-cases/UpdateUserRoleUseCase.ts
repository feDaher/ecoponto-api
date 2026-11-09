import type { IUserRepository } from "../../../auth/domain/repositories/IUserRepository";
import { AppError } from "../../../../shared/errors/AppError";
import type { Role } from "../../../../generated/prisma/enums";

export class UpdateUserRoleUseCase {
  constructor(private readonly userRepository: IUserRepository) {}
  async execute(adminId: string, targetUserId: string, newRole: Role) {
    if (adminId === targetUserId) {
      throw new AppError("You cannot change your own role", 400);
    }

    const user = await this.userRepository.findById(targetUserId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return this.userRepository.updateRole(user.id, newRole);
  }
}
