import { prisma } from "../../../../config/prisma";
import type {
  CreateWasteCategoryData,
  IWasteCategoryRepository,
  UpdateWasteCategoryData,
} from "../../domain/repositories/IWasteCategoryRepository";

export class PrismaWasteCategoryRepository implements IWasteCategoryRepository {
  create(data: CreateWasteCategoryData) {
    return prisma.wasteCategory.create({ data });
  }

  findById(id: string) {
    return prisma.wasteCategory.findFirst({ where: { id, active: true } });
  }

  findByName(name: string) {
    return prisma.wasteCategory.findUnique({ where: { name } });
  }

  findMany() {
    return prisma.wasteCategory.findMany({ where: { active: true } });
  }

  update(id: string, data: UpdateWasteCategoryData) {
    return prisma.wasteCategory.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    await prisma.wasteCategory.update({ where: { id }, data: { active: false } });
  }
}
