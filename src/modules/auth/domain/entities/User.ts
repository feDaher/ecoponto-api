import type { Role } from "../../../../generated/prisma/enums";

export interface User {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: Role;
  isBlocked: boolean;
  nickname: string | null;
  notifyCollectionAlerts: boolean;
  notifyMonthlyReports: boolean;
  allowCooperativeContact: boolean;
  cooperativeContactConsentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  collectionAlerts: boolean;
  monthlyReports: boolean;
  cooperativeContact: boolean;
}

export function toUserPreferences(user: User): UserPreferences {
  return {
    collectionAlerts: user.notifyCollectionAlerts,
    monthlyReports: user.notifyMonthlyReports,
    cooperativeContact: user.allowCooperativeContact,
  };
}
