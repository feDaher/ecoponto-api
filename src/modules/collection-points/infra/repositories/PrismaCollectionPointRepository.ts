import { prisma } from "../../../../config/prisma";
import { CollectionPointStatus, LocationSource } from "../../../../generated/prisma/enums";
import type { Prisma } from "../../../../generated/prisma/client";
import type { CollectionPoint } from "../../domain/entities/CollectionPoint";
import type {
  CollectionPointSearchFilters,
  CollectionPointWriteData,
  CreateCollectionPointData,
  ICollectionPointRepository,
  ReviewCollectionPointData,
} from "../../domain/repositories/ICollectionPointRepository";

const pointWithCategories = {
  categories: { include: { category: { select: { name: true } } } },
} as const;
const pointWithCollector = {
  collector: { select: { id: true, name: true, email: true } },
} as const;
const publicOmit = { rejectionReason: true, reviewedById: true, reviewedAt: true } as const;
type PointRow = Prisma.CollectionPointGetPayload<{ include: typeof pointWithCategories }>;
type PendingPointRow = Prisma.CollectionPointGetPayload<{
  include: typeof pointWithCategories & typeof pointWithCollector;
}>;

function toEntity<T extends PointRow>(row: T): CollectionPoint {
  const { categories, ...pointData } = row;
  return {
    ...pointData,
    latitude: String(pointData.latitude),
    longitude: String(pointData.longitude),
    wasteCategories: (categories ?? []).map(({ category }) => category.name).sort(),
  } as unknown as CollectionPoint;
}

function asJson(value: CollectionPointWriteData["operatingHours"]): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
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
        locationSource:
          data.locationSource === "GPS_COORDINATES"
            ? LocationSource.GPS_COORDINATES
            : LocationSource.VERIFIED_ADDRESS,
        placeId: data.placeId,
        whatsappContact: data.whatsappContact,
        showWhatsappContact: data.showWhatsappContact,
        operatingHours: asJson(data.operatingHours),
        categories: { create: data.categoryIds.map((id) => ({ category: { connect: { id } } })) },
      },
      include: pointWithCategories,
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
        locationSource:
          data.locationSource === "GPS_COORDINATES"
            ? LocationSource.GPS_COORDINATES
            : LocationSource.VERIFIED_ADDRESS,
        placeId: data.placeId,
        whatsappContact: data.whatsappContact,
        showWhatsappContact: data.showWhatsappContact,
        operatingHours: asJson(data.operatingHours),
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
        hoursConfirmedAt: new Date(),
        isOutdated: false,
      },
      include: pointWithCategories,
    });
    return toEntity(point);
  }

  async review(id: string, data: ReviewCollectionPointData) {
    const point = await prisma.collectionPoint.update({
      where: { id },
      data: {
        status:
          data.status === "APPROVED"
            ? CollectionPointStatus.APPROVED
            : CollectionPointStatus.REJECTED,
        rejectionReason: data.rejectionReason,
        reviewedById: data.reviewedById,
        reviewedAt: data.reviewedAt,
      },
      include: pointWithCategories,
    });
    return toEntity(point);
  }

  async findPublic(filters: CollectionPointSearchFilters) {
    const points = await prisma.collectionPoint.findMany({
      where: {
        status: CollectionPointStatus.APPROVED,
        ...(filters.city ? { city: { equals: filters.city } } : {}),
        ...(filters.wasteType
          ? {
              categories: { some: { category: { is: { name: filters.wasteType, active: true } } } },
            }
          : {}),
      },
      include: pointWithCategories,
      omit: publicOmit,
      orderBy: { name: "asc" },
    });
    return points.map((point) => toEntity(point as unknown as PointRow));
  }

  async findApprovedById(id: string) {
    const point = await prisma.collectionPoint.findFirst({
      where: { id, status: CollectionPointStatus.APPROVED },
      omit: publicOmit,
      include: pointWithCategories,
    });
    return point ? toEntity(point as unknown as PointRow) : null;
  }

  async findById(id: string) {
    const point = await prisma.collectionPoint.findUnique({
      where: { id },
      include: pointWithCategories,
    });
    return point ? toEntity(point) : null;
  }

  async listMine(collectorId: string) {
    const points = await prisma.collectionPoint.findMany({
      where: { collectorId },
      orderBy: { updatedAt: "desc" },
      include: pointWithCategories,
    });
    return points.map(toEntity);
  }

  async listPending() {
    const points = await prisma.collectionPoint.findMany({
      where: { status: CollectionPointStatus.PENDING },
      include: { ...pointWithCategories, ...pointWithCollector },
      orderBy: { createdAt: "asc" },
    });
    return points.map((point) => toEntity(point as PendingPointRow));
  }
}
