import type { Role } from "../../../../generated/prisma/enums";
import type { User } from "../entities/User";

export interface CreateUserData {
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: Role;
}

export interface IUserRepository {
  create(data: CreateUserData): Promise<User>;
  findByFirebaseUid(firebaseUid: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findMany(): Promise<User[]>;
}
