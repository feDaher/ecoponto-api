import type { IUserRepository } from "../../../auth/domain/repositories/IUserRepository";
import type { IFirebaseUserManager } from "../../../auth/domain/repositories/IFirebaseUserManager";
import { AppError } from "../../../../shared/errors/AppError";

export class BlockUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly firebaseUserManager: IFirebaseUserManager,
  ) {}
  async execute(adminId: string, targetUserId: string) {
    if (adminId === targetUserId) {
      throw new AppError("You cannot block your own account", 400);
    }

    const user = await this.userRepository.findById(targetUserId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    await this.firebaseUserManager.setDisabled(user.firebaseUid, true);

    try {
      return await this.userRepository.updateBlockedStatus(user.id, true);
    } catch (error) {
      console.error("[BE-10] Database synchronization failed after Firebase block", {
        adminId,
        targetUserId: user.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new AppError("User block incomplete. Please retry the operation.", 500);
    }
  }
}
