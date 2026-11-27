import { prisma } from "../../../../config/prisma";
import type {
  IPlacesUsageRepository,
  PlacesSku,
  PlacesUsage,
} from "../../domain/repositories/IPlacesUsageRepository";

export class PrismaPlacesUsageRepository implements IPlacesUsageRepository {
  async tryConsume(sku: PlacesSku, day: string, limit: number): Promise<boolean> {
    // INSERT IGNORE: concurrent first calls of the day must not fail on the primary key.
    await prisma.placesApiUsage.createMany({ data: [{ sku, day }], skipDuplicates: true });

    // Single conditional UPDATE, atomic in InnoDB: two requests can never both take the
    // last slot, even across several API instances.
    const { count } = await prisma.placesApiUsage.updateMany({
      where: { sku, day, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });

    return count === 1;
  }

  async findByDay(day: string): Promise<PlacesUsage[]> {
    const rows = await prisma.placesApiUsage.findMany({
      where: { day },
      select: { sku: true, count: true },
    });
    return rows.map((row) => ({ sku: row.sku as PlacesSku, count: row.count }));
  }
}
