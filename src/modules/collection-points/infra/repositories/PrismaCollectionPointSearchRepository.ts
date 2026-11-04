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
    const anyOf = wasteTypes.map(
      (wasteType) => Prisma.sql`JSON_CONTAINS(wasteCategories, ${JSON.stringify(wasteType)})`,
    );
    conditions.push(Prisma.sql`(${Prisma.join(anyOf, " OR ")})`);
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

    const total = ranked.length < limit ? ranked.length : await this.countMatching(where);

    if (ranked.length === 0) {
      return { items: [], total };
    }

    const rows = await prisma.collectionPoint.findMany({
      where: { id: { in: ranked.map((row) => row.id) } },
      omit: publicOmit,
    });
    const pointsById = new Map(rows.map((point) => [point.id, point]));

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
