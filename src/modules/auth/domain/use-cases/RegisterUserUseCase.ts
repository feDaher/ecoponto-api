import type { Auth } from "firebase-admin/auth";
import type { Role } from "../../../../generated/prisma/enums";
import { AppError } from "../../../../shared/errors/AppError";
import type { IUserRepository } from "../repositories/IUserRepository";

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  role: Role;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly firebaseAuth: Auth,
  ) {}

  async execute({ name, email, password, phone, city, role }: RegisterUserInput) {
    try {
      const firebaseUser = await this.firebaseAuth.createUser({
        email,
        password,
        displayName: name,
      });

      return await this.userRepository.create({
        firebaseUid: firebaseUser.uid,
        name,
        email,
        phone,
        city,
        role,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "auth/email-already-exists"
      ) {
        throw new AppError("Email already registered", 409);
      }

      throw error;
    }
  }
}
