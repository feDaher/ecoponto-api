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

export interface UpdateProfileData {
  name: string;
  phone: string;
  city: string;
  nickname?: string | null;
  notifyCollectionAlerts?: boolean;
  notifyMonthlyReports?: boolean;
  allowCooperativeContact?: boolean;
  cooperativeContactConsentAt?: Date | null;
}

export interface AnonymizedUserData {
  name: string;
  email: string;
  phone: string;
  city: string;
  nickname: null;
  allowCooperativeContact: false;
  cooperativeContactConsentAt: null;
}

export interface AnonymizeOptions {
  keepAnotherActiveAdmin: boolean;
  beforeCommit: () => Promise<void>;
}

export type AnonymizeResult = "ANONYMIZED" | "LAST_ACTIVE_ADMIN";

export interface IUserRepository {
  create(data: CreateUserData): Promise<User>;
  findByFirebaseUid(firebaseUid: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findMany(): Promise<User[]>;
  updateBlockedStatus(id: string, isBlocked: boolean): Promise<User>;
  updateRole(id: string, role: Role): Promise<User>;
  updateProfile(id: string, data: UpdateProfileData): Promise<User>;
  anonymize(
    id: string,
    data: AnonymizedUserData,
    options: AnonymizeOptions,
  ): Promise<AnonymizeResult>;
}
