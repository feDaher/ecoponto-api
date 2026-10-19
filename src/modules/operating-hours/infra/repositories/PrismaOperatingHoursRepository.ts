import { prisma } from "../../../../config/prisma";
import type { OperatingHours } from "../../domain/entities/OperatingHours";
import type {
  CreateOperatingHoursData,
  IOperatingHoursRepository,
  UpdateOperatingHoursData,
} from "../../domain/repositories/IOperatingHoursRepository";

type OperatingHoursRow = Omit<OperatingHours, "openTime" | "closeTime"> & {
  openTime: Date;
  closeTime: Date;
};

const toTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);
const fromTime = (value: Date) => value.toISOString().slice(11, 16);

const toEntity = ({
  id,
  collectionPointId,
  weekday,
  openTime,
  closeTime,
  isActive,
}: OperatingHoursRow): OperatingHours => ({
  id,
  collectionPointId,
  weekday,
  openTime: fromTime(openTime),
  closeTime: fromTime(closeTime),
  isActive,
});

export class PrismaOperatingHoursRepository implements IOperatingHoursRepository {
  async create({ openTime, closeTime, ...data }: CreateOperatingHoursData) {
    const row = await prisma.operatingHours.create({
      data: { ...data, openTime: toTime(openTime), closeTime: toTime(closeTime) },
    });
    return toEntity(row);
  }

  async findById(id: string) {
    const row = await prisma.operatingHours.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByCollectionPointId(collectionPointId: string) {
    const rows = await prisma.operatingHours.findMany({
      where: { collectionPointId, isActive: true },
      orderBy: [{ weekday: "asc" }, { openTime: "asc" }],
    });
    return rows.map(toEntity);
  }

  async update(id: string, { openTime, closeTime, ...data }: UpdateOperatingHoursData) {
    const row = await prisma.operatingHours.update({
      where: { id },
      data: {
        ...data,
        ...(openTime ? { openTime: toTime(openTime) } : {}),
        ...(closeTime ? { closeTime: toTime(closeTime) } : {}),
      },
    });
    return toEntity(row);
  }

  async delete(id: string) {
    await prisma.operatingHours.delete({ where: { id } });
  }

  async findCollectionPointOwnerId(collectionPointId: string) {
    const point = await prisma.collectionPoint.findUnique({
      where: { id: collectionPointId },
      select: { collectorId: true },
    });
    return point?.collectorId ?? null;
  }

  async confirmHours(collectionPointId: string) {
    await prisma.collectionPoint.update({
      where: { id: collectionPointId },
      data: { hoursConfirmedAt: new Date(), isOutdated: false },
    });
  }

  async flagPointsNotConfirmedSince(date: Date) {
    const result = await prisma.collectionPoint.updateMany({
      where: { isOutdated: false, hoursConfirmedAt: { lt: date } },
      data: { isOutdated: true },
    });
    return result.count;
  }
}
