import type { Role } from "../../../../generated/prisma/enums";

export interface User {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}
