import { prisma } from "../../../../config/prisma";
import type { CreateUserData, IUserRepository } from "../../domain/repositories/IUserRepository";

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
}
