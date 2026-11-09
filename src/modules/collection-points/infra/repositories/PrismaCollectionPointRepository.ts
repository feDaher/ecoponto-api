import { prisma } from "../../../../config/prisma";
import { CollectionPointStatus } from "../../../../generated/prisma/enums";
import type { Prisma } from "../../../../generated/prisma/client";
import type {
  CollectionPoint,
  CollectionPointOperatingHours,
} from "../../domain/entities/CollectionPoint";
import type {
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
type PublicPointRow = Prisma.CollectionPointGetPayload<{
  include: typeof pointWithCategories;
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

function isOperatingHour(value: Prisma.JsonValue): value is Prisma.JsonObject & {
  weekday: string;
  openTime: string;
  closeTime: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.weekday === "string" &&
    typeof value.openTime === "string" &&
    typeof value.closeTime === "string"
  );
}

function toOperatingHours(value: Prisma.JsonValue): CollectionPointOperatingHours[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isOperatingHour)
    .map(({ weekday, openTime, closeTime }) => ({ weekday, openTime, closeTime }));
}

function toJsonHours(hours: CollectionPointOperatingHours[]): Prisma.InputJsonValue {
  return hours.map(({ weekday, openTime, closeTime }) => ({ weekday, openTime, closeTime }));
}

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
    operatingHours: toOperatingHours(row.operatingHours),
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
        operatingHours: toJsonHours(data.operatingHours),
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
        locationSource: data.locationSource,
        placeId: data.placeId,
        whatsappContact: data.whatsappContact,
        showWhatsappContact: data.showWhatsappContact,
        operatingHours: toJsonHours(data.operatingHours),
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
        status: data.status,
        rejectionReason: data.rejectionReason,
        reviewedById: data.reviewedById,
        reviewedAt: data.reviewedAt,
      },
      include: pointWithCategories,
    });
    return toEntity(point);
  }

  async findApprovedById(id: string) {
    const point = await prisma.collectionPoint.findFirst({
      where: { id, status: CollectionPointStatus.APPROVED },
      omit: publicOmit,
      include: pointWithCategories,
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
    return points.map(toEntity);
  }
}
