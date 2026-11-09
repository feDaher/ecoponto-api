import { prisma } from "../../../../config/prisma";
import { CollectionPointStatus } from "../../../../generated/prisma/enums";
import type { Prisma } from "../../../../generated/prisma/client";
import { toTime } from "../../../../shared/time/time-of-day";
import type { CollectionPoint } from "../../domain/entities/CollectionPoint";
import type {
  CollectionPointWriteData,
  CreateCollectionPointData,
  ICollectionPointRepository,
  ReviewCollectionPointData,
} from "../../domain/repositories/ICollectionPointRepository";
import { activeHoursInclude, formatHours } from "./operating-hours.include";

const pointWithCategories = {
  categories: { include: { category: { select: { name: true } } } },
} as const;
const pointWithDetails = { ...pointWithCategories, ...activeHoursInclude };
const pointWithCollector = {
  collector: { select: { id: true, name: true, email: true } },
} as const;
const publicOmit = { rejectionReason: true, reviewedById: true, reviewedAt: true } as const;
type PublicPointRow = Prisma.CollectionPointGetPayload<{
  include: typeof pointWithDetails;
  omit: typeof publicOmit;
}>;

type PointRow = PublicPointRow &
  Partial<
    Pick<
      Prisma.CollectionPointGetPayload<object>,
      "rejectionReason" | "reviewedById" | "reviewedAt"
    >
  > & {
    collector?: { id: string; name: string; email: string };
  };

function toEntity(row: PointRow): CollectionPoint {
  return {
    id: row.id,
    collectorId: row.collectorId,
    name: row.name,
    description: row.description,
    city: row.city,
    address: row.address,
    latitude: row.latitude.toString(),
    longitude: row.longitude.toString(),
    locationSource: row.locationSource,
    placeId: row.placeId,
    whatsappContact: row.whatsappContact,
    showWhatsappContact: row.showWhatsappContact,
    hours: formatHours(row.hours),
    status: row.status,
    ...("rejectionReason" in row && {
      rejectionReason: row.rejectionReason,
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt,
    }),
    hoursConfirmedAt: row.hoursConfirmedAt,
    isOutdated: row.isOutdated,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    wasteCategories: row.categories.map(({ category }) => category.name).sort(),
    ...(row.collector && { collector: row.collector }),
  };
}

export class PrismaCollectionPointRepository implements ICollectionPointRepository {
  async create(data: CreateCollectionPointData) {
    const point = await prisma.collectionPoint.create({
      data: {
        collectorId: data.collectorId,
        name: data.name,
        description: data.description,
        city: data.city,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        locationSource: data.locationSource,
        placeId: data.placeId,
        whatsappContact: data.whatsappContact,
        showWhatsappContact: data.showWhatsappContact,
        categories: { create: data.categoryIds.map((id) => ({ category: { connect: { id } } })) },
        hours: {
          create: data.operatingHours.map(({ weekday, openTime, closeTime }) => ({
            weekday,
            openTime: toTime(openTime),
            closeTime: toTime(closeTime),
          })),
        },
      },
      include: pointWithDetails,
    });
    return toEntity(point);
  }

  async update(id: string, data: CollectionPointWriteData) {
    const point = await prisma.collectionPoint.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        city: data.city,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        locationSource: data.locationSource,
        placeId: data.placeId,
        whatsappContact: data.whatsappContact,
        showWhatsappContact: data.showWhatsappContact,
        categories: {
          deleteMany: {},
          create: data.categoryIds.map((categoryId) => ({
            category: { connect: { id: categoryId } },
          })),
        },
        status: CollectionPointStatus.PENDING,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
      include: pointWithDetails,
    });
    return toEntity(point);
  }

  async review(id: string, data: ReviewCollectionPointData) {
    const point = await prisma.collectionPoint.update({
      where: { id },
      data: {
        status: data.status,
        rejectionReason: data.rejectionReason,
        reviewedById: data.reviewedById,
        reviewedAt: data.reviewedAt,
      },
      include: pointWithDetails,
    });
    return toEntity(point);
  }

  async findApprovedById(id: string) {
    const point = await prisma.collectionPoint.findFirst({
      where: { id, status: CollectionPointStatus.APPROVED },
      omit: publicOmit,
      include: pointWithDetails,
    });
    return point ? toEntity(point) : null;
  }

  findSummaryById(id: string) {
    return prisma.collectionPoint.findUnique({
      where: { id },
      select: { id: true, collectorId: true, status: true },
    });
  }

  async listMine(collectorId: string) {
    const points = await prisma.collectionPoint.findMany({
      where: { collectorId },
      orderBy: { updatedAt: "desc" },
      include: pointWithDetails,
    });
    return points.map(toEntity);
  }

  async listPending() {
    const points = await prisma.collectionPoint.findMany({
      where: { status: CollectionPointStatus.PENDING },
      include: { ...pointWithDetails, ...pointWithCollector },
      orderBy: { createdAt: "asc" },
    });
    return points.map(toEntity);
  }
}
