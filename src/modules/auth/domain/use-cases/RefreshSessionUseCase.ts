import { AppError } from "../../../../shared/errors/AppError";
import type { FirebaseAuthRestClient } from "../../infra/http/FirebaseAuthRestClient";
import type { IUserRepository } from "../repositories/IUserRepository";

export interface RefreshSessionInput {
  refreshToken: string;
}

/**
 * Renews the session of a logged-in client (Firebase ID tokens expire after one hour).
 *
 * Applies the same checks as login: a token whose account has no local `User` row, or whose
 * user was blocked meanwhile, does not get a new ID token.
 */
export class RefreshSessionUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly firebaseAuthRestClient: FirebaseAuthRestClient,
  ) {}

  async execute({ refreshToken }: RefreshSessionInput) {
    const result = await this.firebaseAuthRestClient.refreshIdToken(refreshToken);

    const user = await this.userRepository.findByFirebaseUid(result.localId);

    if (!user) {
      throw new AppError("User is not registered", 401);
    }

    if (user.isBlocked) {
      throw new AppError("User account is blocked", 403);
    }

    return {
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user,
    };
  }
}
