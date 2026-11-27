import { prisma } from "../../../../config/prisma";
import { CollectionPointStatus } from "../../../../generated/prisma/enums";
import type { Prisma } from "../../../../generated/prisma/client";
import { toTime } from "../../../../shared/time/time-of-day";
import type {
  CollectionPoint,
  CollectionPointCooperativeDetails,
} from "../../domain/entities/CollectionPoint";
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

type ConfigurationRow = Prisma.CollectionPointConfigurationGetPayload<object>;
type CooperativeProfileRow = Prisma.CooperativeProfileGetPayload<object>;

function toCooperativeDetails(
  profile?: CooperativeProfileRow,
  configuration?: ConfigurationRow,
): CollectionPointCooperativeDetails | undefined {
  if (!profile && !configuration) return undefined;
  return {
    cooperativeName: profile?.cooperativeName ?? "",
    cnpj: profile?.cnpj ?? "",
    street: configuration?.street ?? "",
    streetNumber: configuration?.streetNumber ?? "",
    neighborhood: configuration?.neighborhood ?? "",
    state: configuration?.state ?? "",
    postalCode: configuration?.postalCode ?? "",
    email: profile?.email ?? "",
  };
}

function toProfileData(details: CollectionPointCooperativeDetails) {
  return {
    cooperativeName: details.cooperativeName,
    cnpj: details.cnpj,
    email: details.email,
  };
}

function toConfigurationData(details: CollectionPointCooperativeDetails) {
  return {
    street: details.street,
    streetNumber: details.streetNumber,
    neighborhood: details.neighborhood,
    state: details.state,
    postalCode: details.postalCode,
  };
}

function toEntity(row: PointRow, cooperative?: CollectionPointCooperativeDetails): CollectionPoint {
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
    ...(cooperative && { cooperative }),
    ...(row.collector && { collector: row.collector }),
  };
}

export class PrismaCollectionPointRepository implements ICollectionPointRepository {
  async create(data: CreateCollectionPointData) {
    const cooperative = data.cooperative;
    const pointData = {
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
    };

    if (!cooperative) {
      return toEntity(
        await prisma.collectionPoint.create({ data: pointData, include: pointWithDetails }),
      );
    }

    return prisma.$transaction(async (transaction) => {
      const point = await transaction.collectionPoint.create({
        data: pointData,
        include: pointWithDetails,
      });
      const configuration = await transaction.collectionPointConfiguration.create({
        data: {
          collectionPointId: point.id,
          ...toConfigurationData(cooperative),
        },
      });
      const profile = await transaction.cooperativeProfile.upsert({
        where: { collectorId: data.collectorId },
        create: {
          collectorId: data.collectorId,
          ...toProfileData(cooperative),
        },
        update: toProfileData(cooperative),
      });
      return toEntity(point, toCooperativeDetails(profile, configuration));
    });
  }

  async update(id: string, data: CollectionPointWriteData) {
    const cooperative = data.cooperative;
    const updateData = {
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
      ...(data.operatingHours && {
        hours: {
          deleteMany: {},
          create: data.operatingHours.map(({ weekday, openTime, closeTime }) => ({
            weekday,
            openTime: toTime(openTime),
            closeTime: toTime(closeTime),
          })),
        },
        hoursConfirmedAt: new Date(),
        isOutdated: false,
      }),
    };
    const updatePoint = (client: Pick<Prisma.TransactionClient, "collectionPoint">) =>
      client.collectionPoint.update({
        where: { id },
        data: updateData,
        include: pointWithDetails,
      });

    if (!cooperative && !data.operatingHours) {
      return toEntity(await updatePoint(prisma));
    }

    return prisma.$transaction(async (transaction) => {
      const point = await updatePoint(transaction);
      if (!cooperative) return toEntity(point);

      const configuration = await transaction.collectionPointConfiguration.upsert({
        where: { collectionPointId: id },
        create: {
          collectionPointId: id,
          ...toConfigurationData(cooperative),
        },
        update: toConfigurationData(cooperative),
      });
      const profile = await transaction.cooperativeProfile.upsert({
        where: { collectorId: data.collectorId },
        create: {
          collectorId: data.collectorId,
          ...toProfileData(cooperative),
        },
        update: toProfileData(cooperative),
      });
      return toEntity(point, toCooperativeDetails(profile, configuration));
    });
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
    const configurations = points.length
      ? await prisma.collectionPointConfiguration.findMany({
          where: { collectionPointId: { in: points.map(({ id }) => id) } },
        })
      : [];
    const profiles = points.length
      ? await prisma.cooperativeProfile.findMany({
          where: {
            collectorId: { in: [...new Set(points.map(({ collectorId }) => collectorId))] },
          },
        })
      : [];
    const configurationsByPoint = new Map(
      configurations.map((configuration) => [configuration.collectionPointId, configuration]),
    );
    const profilesByCollector = new Map(profiles.map((profile) => [profile.collectorId, profile]));
    return points.map((point) =>
      toEntity(
        point,
        toCooperativeDetails(
          profilesByCollector.get(point.collectorId),
          configurationsByPoint.get(point.id),
        ),
      ),
    );
  }

  async listPending() {
    const points = await prisma.collectionPoint.findMany({
      where: { status: CollectionPointStatus.PENDING },
      include: { ...pointWithDetails, ...pointWithCollector },
      orderBy: { createdAt: "asc" },
    });
    const configurations = points.length
      ? await prisma.collectionPointConfiguration.findMany({
          where: { collectionPointId: { in: points.map(({ id }) => id) } },
        })
      : [];
    const profiles = points.length
      ? await prisma.cooperativeProfile.findMany({
          where: {
            collectorId: { in: [...new Set(points.map(({ collectorId }) => collectorId))] },
          },
        })
      : [];
    const configurationsByPoint = new Map(
      configurations.map((configuration) => [configuration.collectionPointId, configuration]),
    );
    const profilesByCollector = new Map(profiles.map((profile) => [profile.collectorId, profile]));
    return points.map((point) =>
      toEntity(
        point,
        toCooperativeDetails(
          profilesByCollector.get(point.collectorId),
          configurationsByPoint.get(point.id),
        ),
      ),
    );
  }
}
