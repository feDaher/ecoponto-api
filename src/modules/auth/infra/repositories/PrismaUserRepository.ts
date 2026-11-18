import { prisma } from "../../../../config/prisma";
import type { CreateUserData, IUserRepository } from "../../domain/repositories/IUserRepository";
import type { Role } from "../../../../generated/prisma/enums";

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
}
