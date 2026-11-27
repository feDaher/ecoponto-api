import { AppError } from "../../../../shared/errors/AppError";
import type { FirebaseAuthRestClient } from "../../infra/http/FirebaseAuthRestClient";
import type { IFirebaseUserManager } from "../repositories/IFirebaseUserManager";
import type { IUserRepository } from "../repositories/IUserRepository";

export interface ChangePasswordInput {
  firebaseUid: string;
  email: string;
  currentPassword: string;
  newPassword: string;
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "unknown";
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly firebaseAuthRestClient: FirebaseAuthRestClient,
    private readonly firebaseUserManager: IFirebaseUserManager,
  ) {}

  async execute({ firebaseUid, email, currentPassword, newPassword }: ChangePasswordInput) {
    await this.confirmCurrentPassword(firebaseUid, email, currentPassword);

    try {
      await this.firebaseUserManager.updatePassword(firebaseUid, newPassword);
    } catch (error) {
      console.error(`[auth] password update failed: ${errorCode(error)}`);
      throw new AppError(
        "Não foi possível trocar a senha agora. Nenhuma alteração foi feita.",
        502,
      );
    }

    try {
      await this.firebaseUserManager.revokeSessions(firebaseUid);
    } catch (error) {
      console.error(
        `[auth] password changed but revoking old sessions failed: ${errorCode(error)}`,
      );
    }

    let session;
    try {
      session = await this.firebaseAuthRestClient.signInWithPassword(email, newPassword);
    } catch {
      throw new AppError("Senha alterada. Entre novamente com a nova senha.", 502);
    }

    const user = await this.userRepository.findByFirebaseUid(session.localId);

    if (!user) {
      throw new AppError("User is not registered", 401);
    }

    return {
      idToken: session.idToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      user,
    };
  }

  private async confirmCurrentPassword(firebaseUid: string, email: string, password: string) {
    try {
      const check = await this.firebaseAuthRestClient.signInWithPassword(email, password);
      if (check.localId !== firebaseUid) {
        throw new AppError("A senha atual está incorreta.", 422);
      }
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      if (error.statusCode === 401 || error.statusCode === 422) {
        throw new AppError("A senha atual está incorreta.", 422);
      }
      if (error.statusCode === 429) {
        throw new AppError(
          "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos.",
          429,
        );
      }
      throw new AppError(
        "Serviço de autenticação indisponível. Nenhuma alteração foi feita.",
        error.statusCode,
      );
    }
  }
}
