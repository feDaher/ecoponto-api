import { prismaRead } from "../../../../config/prisma";
import type { Prisma } from "../../../../generated/prisma/client";
import { CollectionPointStatus, DisposalStatus } from "../../../../generated/prisma/enums";
import type { DisposalRaw, ReportFilter } from "../../domain/entities/Report";
import type {
  CategoryAggregate,
  CategoryOption,
  DisposalQueryOptions,
  IReportRepository,
  PointAggregate,
  PointDetail,
} from "../../domain/repositories/IReportRepository";
import { toUtcRange } from "../../domain/rules/period-rules";

export class PrismaReportRepository implements IReportRepository {
  private buildWhere(
    filter: ReportFilter,
    categoryIds?: string[],
  ): Prisma.DisposalRecordWhereInput {
    const { gte, lt } = toUtcRange(filter.from, filter.to);

    return {
      AND: [
        { disposedAt: { gte, lt } },
        { status: filter.status ?? DisposalStatus.CONFIRMED },
        ...(filter.categoryId ? [{ categoryId: filter.categoryId }] : []),
        ...(categoryIds ? [{ categoryId: { in: categoryIds } }] : []),
        ...(filter.region
          ? [{ collectionPoint: { is: { city: { contains: filter.region } } } }]
          : []),
      ],
    };
  }

  async listCategories(): Promise<CategoryOption[]> {
    const categories = await prismaRead.wasteCategory.findMany({
      select: { id: true, name: true },
    });

    return categories
      .map((category) => ({ id: category.id, name: category.name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async listRegions(): Promise<string[]> {
    const points = await prismaRead.collectionPoint.findMany({
      distinct: ["city"],
      select: { city: true },
    });

    return points.map((point) => point.city);
  }

  async findDisposals(
    filter: ReportFilter,
    options?: DisposalQueryOptions,
  ): Promise<DisposalRaw[]> {
    const rows = await prismaRead.disposalRecord.findMany({
      where: this.buildWhere(filter, options?.categoryIds),
      include: {
        category: true,
        collectionPoint: { include: { geolocation: true } },
      },
      orderBy: { disposedAt: "desc" },
      ...(options?.skip !== undefined ? { skip: options.skip } : {}),
      ...(options?.take !== undefined ? { take: options.take } : {}),
    });

    return rows.map((row) => ({
      id: row.id,
      disposedAt: row.disposedAt,
      weightKg: Number(row.weightKg),
      pointsEarned: row.pointsEarned,
      status: row.status,
      collectionId: row.collectionId,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      collectionPointId: row.collectionPointId,
      collectionPointName: row.collectionPoint.name,
      collectionPointAddress: row.collectionPoint.address,
      collectionPointCity: row.collectionPoint.city,
      neighborhood: row.collectionPoint.geolocation?.neighborhood ?? null,
      latitude: Number(row.collectionPoint.latitude),
      longitude: Number(row.collectionPoint.longitude),
    }));
  }

  async countDisposals(filter: ReportFilter, categoryIds?: string[]): Promise<number> {
    return prismaRead.disposalRecord.count({
      where: this.buildWhere(filter, categoryIds),
    });
  }

  async sumByCategory(filter: ReportFilter, categoryIds?: string[]): Promise<CategoryAggregate[]> {
    const groups = await prismaRead.disposalRecord.groupBy({
      by: ["categoryId"],
      where: this.buildWhere(filter, categoryIds),
      _sum: { weightKg: true, pointsEarned: true },
      _count: { _all: true },
    });

    if (!Array.isArray(groups)) return [];

    return groups.map((group) => ({
      categoryId: group.categoryId,
      disposals: group._count._all,
      weightKg: Number(group._sum.weightKg ?? 0),
      points: group._sum.pointsEarned ?? 0,
    }));
  }

  async sumByPoint(filter: ReportFilter, categoryIds?: string[]): Promise<PointAggregate[]> {
    const groups = await prismaRead.disposalRecord.groupBy({
      by: ["collectionPointId"],
      where: this.buildWhere(filter, categoryIds),
      _sum: { weightKg: true },
      _count: { _all: true },
    });

    if (!Array.isArray(groups)) return [];

    return groups.map((group) => ({
      collectionPointId: group.collectionPointId,
      disposals: group._count._all,
      weightKg: Number(group._sum.weightKg ?? 0),
    }));
  }

  async findPointsByIds(ids: string[]): Promise<PointDetail[]> {
    if (ids.length === 0) return [];

    const points = await prismaRead.collectionPoint.findMany({
      where: { id: { in: ids } },
      include: { geolocation: true },
    });

    return points.map((point) => ({
      id: point.id,
      name: point.name,
      address: point.address,
      city: point.city,
      neighborhood: point.geolocation?.neighborhood ?? null,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }));
  }

  async countActivePoints(): Promise<number> {
    return prismaRead.collectionPoint.count({
      where: { status: CollectionPointStatus.APPROVED },
    });
  }
}
