import type {
  IUserRepository,
  UpdateProfileData,
} from "../../../auth/domain/repositories/IUserRepository";
import { AppError } from "../../../../shared/errors/AppError";

export class UpdateOwnProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string, data: UpdateProfileData) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }

    return this.userRepository.updateProfile(user.id, data);
  }
}
