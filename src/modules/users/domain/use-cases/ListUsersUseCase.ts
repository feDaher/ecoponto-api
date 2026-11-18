import type { IUserRepository } from "../../../auth/domain/repositories/IUserRepository";

export class ListUsersUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute() {
    const users = await this.userRepository.findMany();

    return users;
  }
}
