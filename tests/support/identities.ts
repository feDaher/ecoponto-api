import { Role } from "../../src/generated/prisma/enums";
import { firebaseAuth } from "./firebase-mock";
import { prisma } from "./prisma-mock";

export const ROLES = [Role.CITIZEN, Role.COLLECTOR, Role.ADMIN] as const;

export const users = {
  [Role.CITIZEN]: {
    id: "user-citizen",
    firebaseUid: "uid-citizen",
    email: "citizen@test.dev",
    role: Role.CITIZEN,
  },
  [Role.COLLECTOR]: {
    id: "user-collector",
    firebaseUid: "uid-collector",
    email: "collector@test.dev",
    role: Role.COLLECTOR,
  },
  [Role.ADMIN]: {
    id: "user-admin",
    firebaseUid: "uid-admin",
    email: "admin@test.dev",
    role: Role.ADMIN,
  },
};

export const UNREGISTERED_TOKEN = "token-unregistered";
export const REVOKED_TOKEN = "token-revoked";

export const tokenFor = (role: Role) => `token-${role}`;
export const bearer = (role: Role) => ({ Authorization: `Bearer ${tokenFor(role)}` });

export function installIdentities() {
  const byUid = new Map(Object.values(users).map((user) => [user.firebaseUid, user]));

  firebaseAuth.verifyIdToken.mockImplementation(async (token: string) => {
    if (token === UNREGISTERED_TOKEN) return { uid: "uid-unknown" };
    const role = ROLES.find((candidate) => token === tokenFor(candidate));
    if (role) return { uid: users[role].firebaseUid };
    const code = token === REVOKED_TOKEN ? "auth/id-token-revoked" : "auth/argument-error";
    throw Object.assign(new Error("invalid token"), { code });
  });

  prisma.user.findUnique.mockImplementation(
    async ({ where }: { where: { firebaseUid?: string } }) =>
      (where.firebaseUid && byUid.get(where.firebaseUid)) || null,
  );
}
