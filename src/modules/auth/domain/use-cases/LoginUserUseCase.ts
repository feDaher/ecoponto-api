import { AppError } from "../../../../shared/errors/AppError";
import type { FirebaseAuthRestClient } from "../../infra/http/FirebaseAuthRestClient";
import type { IUserRepository } from "../repositories/IUserRepository";

export interface LoginUserInput {
  email: string;
  password: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly firebaseAuthRestClient: FirebaseAuthRestClient,
  ) {}

  async execute({ email, password }: LoginUserInput) {
    const result = await this.firebaseAuthRestClient.signInWithPassword(email, password);

    const user = await this.userRepository.findByFirebaseUid(result.localId);

    if (!user) {
      throw new AppError("User is not registered", 401);
    }

    return {
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user,
    };
  }
}
