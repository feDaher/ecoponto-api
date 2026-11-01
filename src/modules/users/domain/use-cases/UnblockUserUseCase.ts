import type { IUserRepository } from "../../../auth/domain/repositories/IUserRepository";
import type { IFirebaseUserManager } from "../../../auth/domain/repositories/IFirebaseUserManager";
import { AppError } from "../../../../shared/errors/AppError";

export class UnblockUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly firebaseUserManager: IFirebaseUserManager,
  ) {}
  async execute(adminId: string, targetUserId: string) {
    const user = await this.userRepository.findById(targetUserId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updatedUser = await this.userRepository.updateBlockedStatus(user.id, false);
    try {
      await this.firebaseUserManager.setDisabled(user.firebaseUid, false);
    } catch (error) {
      console.error("[BE-10] Firebase synchronization failed after MySQL unblock", {
        adminId,
        targetUserId: user.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new AppError("User unblock incomplete. Please retry the operation.", 500);
    }

    return updatedUser;
  }
}
