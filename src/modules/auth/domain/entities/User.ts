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
  createdAt: Date;
  updatedAt: Date;
}
