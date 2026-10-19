import { prisma } from "../../../../config/prisma";

import type { IWasteCategoryRepository } from "../../domain/repositories/IWasteCategoryRepository";

export class PrismaWasteCategoryRepository implements IWasteCategoryRepository {
  findById(id: string) {
    return prisma.wasteCategory.findUnique({ where: { id } });
  }
}
