import { prisma } from "../../../../config/prisma";
import type {
  CreateOperatingHoursData,
  IOperatingHoursRepository,
  UpdateOperatingHoursData,
} from "../../domain/repositories/IOperatingHoursRepository";

export class PrismaOperatingHoursRepository implements IOperatingHoursRepository {
  create(data: CreateOperatingHoursData) {
    return prisma.operatingHours.create({ data });
  }

  findById(id: string) {
    return prisma.operatingHours.findUnique({ where: { id } });
  }

  findByCollectionPointId(collectionPointId: string) {
    return prisma.operatingHours.findMany({ where: { collectionPointId } });
  }

  update(id: string, data: UpdateOperatingHoursData) {
    return prisma.operatingHours.update({ where: { id }, data });
  }

  async delete(id: string) {
    await prisma.operatingHours.delete({ where: { id } });
  }

  async markOutdatedBefore(date: Date) {
    const result = await prisma.operatingHours.updateMany({
      where: { isOutdated: false, lastConfirmedAt: { lt: date } },
      data: { isOutdated: true },
    });

    return result.count;
  }
}
