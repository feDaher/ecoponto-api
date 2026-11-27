import type { IUserRepository } from "../../../auth/domain/repositories/IUserRepository";
import type { IFirebaseUserManager } from "../../../auth/domain/repositories/IFirebaseUserManager";
import { Role } from "../../../../generated/prisma/enums";
import { AppError } from "../../../../shared/errors/AppError";

export const ANONYMIZED_NAME = "Usuário removido";

export const anonymizedEmail = (userId: string) => `removido-${userId}@anonimo.ecoponto.invalid`;

export class DeleteOwnAccountUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly firebaseUserManager: IFirebaseUserManager,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }

    let firebaseDeleted = false;
    let firebaseFailed = false;

    try {
      const result = await this.userRepository.anonymize(
        user.id,
        {
          name: ANONYMIZED_NAME,
          email: anonymizedEmail(user.id),
          phone: "",
          city: "",
          nickname: null,
          allowCooperativeContact: false,
          cooperativeContactConsentAt: null,
        },
        {
          keepAnotherActiveAdmin: user.role === Role.ADMIN,
          beforeCommit: async () => {
            try {
              await this.firebaseUserManager.deleteUser(user.firebaseUid);
              firebaseDeleted = true;
            } catch (error) {
              firebaseFailed = true;
              throw error;
            }
          },
        },
      );

      if (result === "LAST_ACTIVE_ADMIN") {
        throw new AppError(
          "Você é o último administrador ativo. Promova outro administrador antes de excluir sua conta.",
          409,
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (firebaseFailed) {
        console.error("[users/me] Firebase deletion failed; anonymization rolled back", {
          userId: user.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new AppError("Não foi possível excluir a conta agora. Tente novamente.", 502);
      }

      if (firebaseDeleted) {
        console.error("[users/me] Firebase account deleted but anonymization did not commit", {
          userId: user.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      throw error;
    }
  }
}
