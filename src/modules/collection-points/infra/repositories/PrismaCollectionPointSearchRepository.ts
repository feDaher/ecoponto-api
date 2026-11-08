import { prisma } from "../../../../config/prisma";
import { Prisma } from "../../../../generated/prisma/client";
import { CollectionPointStatus } from "../../../../generated/prisma/enums";
import { boundingBox, EARTH_RADIUS_KM } from "../../../../shared/geo/distance";
import type {
  CollectionPointSearchCriteria,
  CollectionPointSearchPage,
  ICollectionPointSearchRepository,
  SearchedCollectionPoint,
} from "../../domain/repositories/ICollectionPointSearchRepository";

const publicOmit = { rejectionReason: true, reviewedById: true, reviewedAt: true } as const;

interface RankedRow {
  id: string;
  distanceKm: number | string | null;
}

interface CategoryLinkRow {
  pointId: string;
  name: string;
}

interface CountRow {
  total: bigint | number | string;
}

function distanceExpression(latitude: number, longitude: number) {
  return Prisma.sql`(${2 * EARTH_RADIUS_KM} * ASIN(LEAST(1, SQRT(
    POW(SIN(RADIANS(latitude - ${latitude}) / 2), 2) +
    COS(RADIANS(${latitude})) * COS(RADIANS(latitude)) *
    POW(SIN(RADIANS(longitude - ${longitude}) / 2), 2)
  ))))`;
}

function buildConditions({ city, wasteTypes, origin, radiusKm }: CollectionPointSearchCriteria) {
  const conditions = [Prisma.sql`status = ${CollectionPointStatus.APPROVED}`];

  if (city) {
    conditions.push(Prisma.sql`city = ${city}`);
  }

  if (wasteTypes?.length) {
    // MATERIALIZATION builds the set of matching point ids once; without the hint MySQL picks a
    // weedout plan that rescans every approved point once per requested category.
    conditions.push(Prisma.sql`id IN (
      SELECT /*+ SEMIJOIN(MATERIALIZATION) */ pc.pointId FROM PointCategory pc
      JOIN WasteCategory wc ON wc.id = pc.categoryId
      WHERE wc.active = TRUE AND wc.name IN (${Prisma.join(wasteTypes)})
    )`);
  }

  if (origin && radiusKm !== undefined) {
    const bounds = boundingBox(origin, radiusKm);
    conditions.push(
      Prisma.sql`latitude BETWEEN ${bounds.minLatitude} AND ${bounds.maxLatitude}`,
      Prisma.sql`longitude BETWEEN ${bounds.minLongitude} AND ${bounds.maxLongitude}`,
      Prisma.sql`${distanceExpression(origin.latitude, origin.longitude)} <= ${radiusKm}`,
    );
  }

  return Prisma.join(conditions, " AND ");
}

export class PrismaCollectionPointSearchRepository implements ICollectionPointSearchRepository {
  async findApproved(criteria: CollectionPointSearchCriteria): Promise<CollectionPointSearchPage> {
    const { origin, limit } = criteria;
    const where = buildConditions(criteria);

    const distance = origin
      ? distanceExpression(origin.latitude, origin.longitude)
      : Prisma.sql`NULL`;
    const orderBy = origin ? Prisma.sql`distanceKm, name` : Prisma.sql`name`;

    const ranked = await prisma.$queryRaw<RankedRow[]>(
      Prisma.sql`SELECT id, ${distance} AS distanceKm FROM CollectionPoint WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit}`,
    );

    if (ranked.length === 0) {
      return { items: [], total: 0 };
    }

    const ids = ranked.map((row) => row.id);
    const [total, rows, links] = await Promise.all([
      ranked.length < limit ? ranked.length : this.countMatching(where),
      prisma.collectionPoint.findMany({ where: { id: { in: ids } }, omit: publicOmit }),
      prisma.$queryRaw<CategoryLinkRow[]>(
        Prisma.sql`SELECT pc.pointId, wc.name FROM PointCategory pc JOIN WasteCategory wc ON wc.id = pc.categoryId WHERE pc.pointId IN (${Prisma.join(ids)})`,
      ),
    ]);

    const categoriesByPoint = new Map<string, string[]>();
    for (const { pointId, name } of links) {
      categoriesByPoint.set(pointId, [...(categoriesByPoint.get(pointId) ?? []), name]);
    }

    const pointsById = new Map(
      rows.map((point) => [
        point.id,
        { ...point, wasteCategories: (categoriesByPoint.get(point.id) ?? []).sort() },
      ]),
    );

    const items = ranked.flatMap((row): SearchedCollectionPoint[] => {
      const point = pointsById.get(row.id);
      return point
        ? [{ point, distanceKm: row.distanceKm === null ? null : Number(row.distanceKm) }]
        : [];
    });

    return { items, total };
  }

  private async countMatching(where: Prisma.Sql) {
    const [row] = await prisma.$queryRaw<CountRow[]>(
      Prisma.sql`SELECT COUNT(*) AS total FROM CollectionPoint WHERE ${where}`,
    );
    return Number(row?.total ?? 0);
  }
}
