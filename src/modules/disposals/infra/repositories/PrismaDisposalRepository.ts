import { prisma } from "../../../../config/prisma";
import type { Prisma } from "../../../../generated/prisma/client";
import { DisposalStatus } from "../../../../generated/prisma/enums";
import type { Disposal, DisposalSummary } from "../../domain/entities/Disposal";
import type {
  CreateDisposalData,
  DisposalFilters,
  IDisposalRepository,
  ListDisposalsParams,
} from "../../domain/repositories/IDisposalRepository";

const baseInclude = {
  collectionPoint: {
    select: { id: true, name: true, city: true, address: true, collectorId: true },
  },
  category: { select: { id: true, name: true } },
} as const;

// Only the name of the citizen, never email/phone (data minimization).
const withCitizen = {
  ...baseInclude,
  citizen: { select: { id: true, name: true } },
} as const;

type DisposalRow = Omit<Disposal, "weightKg" | "citizen"> & {
  weightKg: { toString(): string };
  citizen?: { id: string; name: string };
};

const toEntity = ({ weightKg, ...row }: DisposalRow): Disposal => ({
  ...row,
  weightKg: Number(weightKg.toString()),
});

function disposedAtRange({ from, to }: Pick<DisposalFilters, "from" | "to">) {
  return from || to ? { gte: from, lte: to } : undefined;
}

export class PrismaDisposalRepository implements IDisposalRepository {
  findPoint(id: string) {
    return prisma.collectionPoint.findUnique({
      where: { id },
      select: { id: true, collectorId: true, status: true },
    });
  }

  // The accepted categories still live in two places (see CLAUDE.md): the JSON column used by the
  // public search and the normalized PointCategory table. Accept a match in either one.
  async pointAcceptsCategory(pointId: string, categoryName: string) {
    const [link, jsonMatch] = await Promise.all([
      prisma.pointCategory.findFirst({
        where: { pointId, category: { name: categoryName } },
        select: { pointId: true },
      }),
      prisma.collectionPoint.findFirst({
        where: { id: pointId, wasteCategories: { array_contains: [categoryName] } },
        select: { id: true },
      }),
    ]);

    return Boolean(link || jsonMatch);
  }

  async create(data: CreateDisposalData) {
    const row = await prisma.disposalRecord.create({ data, include: baseInclude });
    return toEntity(row);
  }

  async findById(id: string) {
    const row = await prisma.disposalRecord.findUnique({ where: { id }, include: withCitizen });
    return row ? toEntity(row) : null;
  }

  async findMany({ citizenId, collectorId, filters, page, pageSize }: ListDisposalsParams) {
    const { status, categoryId, collectionPointId, from, to } = filters;

    const where: Prisma.DisposalRecordWhereInput = {
      ...(citizenId ? { citizenId } : {}),
      ...(collectorId ? { collectionPoint: { collectorId } } : {}),
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(collectionPointId ? { collectionPointId } : {}),
      ...(from || to ? { disposedAt: disposedAtRange({ from, to }) } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.disposalRecord.findMany({
        where,
        include: collectorId ? withCitizen : baseInclude,
        orderBy: [{ disposedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.disposalRecord.count({ where }),
    ]);

    return {
      items: rows.map(toEntity),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async transitionFromPending(id: string, data: { status: DisposalStatus; pointsEarned: number }) {
    const result = await prisma.disposalRecord.updateMany({
      where: { id, status: DisposalStatus.PENDING },
      data,
    });

    return result.count > 0;
  }

  async summarizeConfirmedByCitizen(
    citizenId: string,
    range: { from?: Date; to?: Date },
  ): Promise<DisposalSummary> {
    // Primary client on purpose: the citizen may have just logged a disposal (no replica lag).
    const groups = await prisma.disposalRecord.groupBy({
      by: ["categoryId"],
      where: {
        citizenId,
        status: DisposalStatus.CONFIRMED,
        ...(range.from || range.to ? { disposedAt: disposedAtRange(range) } : {}),
      },
      _sum: { weightKg: true, pointsEarned: true },
      _count: { _all: true },
    });

    const categories = await prisma.wasteCategory.findMany({
      where: { id: { in: groups.map((group) => group.categoryId) } },
      select: { id: true, name: true },
    });
    const names = new Map(categories.map((category) => [category.id, category.name]));

    const byCategory = groups
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: names.get(group.categoryId) ?? "UNKNOWN",
        disposals: group._count._all,
        weightKg: Math.round(Number(group._sum.weightKg?.toString() ?? 0) * 1000) / 1000,
        points: group._sum.pointsEarned ?? 0,
      }))
      .sort((a, b) => b.weightKg - a.weightKg);

    return {
      totalDisposals: byCategory.reduce((sum, item) => sum + item.disposals, 0),
      totalWeightKg:
        Math.round(byCategory.reduce((sum, item) => sum + item.weightKg, 0) * 1000) / 1000,
      totalPoints: byCategory.reduce((sum, item) => sum + item.points, 0),
      byCategory,
    };
  }
}
