import { prisma } from "../../../../config/prisma";
import type {
  AnonymizedUserData,
  AnonymizeOptions,
  AnonymizeResult,
  CreateUserData,
  IUserRepository,
  UpdateProfileData,
} from "../../domain/repositories/IUserRepository";
import { Role } from "../../../../generated/prisma/enums";

const ANONYMIZE_TIMEOUT_MS = 15_000;

export class PrismaUserRepository implements IUserRepository {
  create(data: CreateUserData) {
    return prisma.user.create({ data });
  }

  findByFirebaseUid(firebaseUid: string) {
    return prisma.user.findUnique({ where: { firebaseUid } });
  }

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  findMany() {
    return prisma.user.findMany();
  }

  updateBlockedStatus(id: string, isBlocked: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isBlocked },
    });
  }

  updateRole(id: string, role: Role) {
    return prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  updateProfile(id: string, data: UpdateProfileData) {
    return prisma.user.update({
      where: { id },
      data: { name: data.name, phone: data.phone, city: data.city },
    });
  }

  anonymize(
    id: string,
    data: AnonymizedUserData,
    { keepAnotherActiveAdmin, beforeCommit }: AnonymizeOptions,
  ): Promise<AnonymizeResult> {
    return prisma.$transaction(
      async (tx) => {
        if (keepAnotherActiveAdmin) {
          const admins = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM User WHERE role = ${Role.ADMIN} AND isBlocked = FALSE FOR UPDATE`;
          if (!admins.some((admin) => admin.id !== id)) {
            return "LAST_ACTIVE_ADMIN";
          }
        }

        await tx.user.update({ where: { id }, data: { ...data, isBlocked: true } });
        await tx.cooperativeProfile.deleteMany({ where: { collectorId: id } });
        await beforeCommit();
        return "ANONYMIZED";
      },
      { timeout: ANONYMIZE_TIMEOUT_MS },
    );
  }
}
