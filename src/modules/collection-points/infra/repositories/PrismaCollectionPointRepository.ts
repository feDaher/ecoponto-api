import { prisma } from "../../../../config/prisma";
import {
  CollectionPointStatus,
  PointCategoryApprovalStatus,
  PointCategoryDecision,
} from "../../../../generated/prisma/enums";
import type { Prisma } from "../../../../generated/prisma/client";
import { toTime } from "../../../../shared/time/time-of-day";
import type {
  CollectionPoint,
  CollectionPointCooperativeDetails,
} from "../../domain/entities/CollectionPoint";
import { PointCategory } from "../../domain/entities/PointCategory";
import type {
  UpdateCollectionPointMaterialSettings,
  CollectionPointWriteData,
  CreateCollectionPointData,
  ICollectionPointRepository,
  ApplyCategoryChangesData,
  PointCategoryReviewData,
  ReviewCollectionPointData,
} from "../../domain/repositories/ICollectionPointRepository";
import { activeHoursInclude, formatHours } from "./operating-hours.include";

const pointWithCategories = {
  categories: { include: { category: { select: { name: true } } } },
} as const;
// Public responses list only categories that are approved by an administrator (BE-21)
// and currently receiving (BE-19).
const pointWithAcceptingCategories = {
  categories: {
    where: { isAccepting: true, approvalStatus: PointCategoryApprovalStatus.APPROVED },
    include: { category: { select: { name: true } } },
  },
} as const;
const pointWithDetails = { ...pointWithCategories, ...activeHoursInclude };
const publicPointWithDetails = { ...pointWithAcceptingCategories, ...activeHoursInclude };
const pointWithCollector = {
  collector: { select: { id: true, name: true, email: true } },
} as const;
const CATEGORY_REVIEW_HISTORY_LIMIT = 100;
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

async function loadCooperativeDetails(points: { id: string; collectorId: string }[]) {
  if (points.length === 0) return () => undefined;

  const [configurations, profiles] = await Promise.all([
    prisma.collectionPointConfiguration.findMany({
      where: { collectionPointId: { in: points.map(({ id }) => id) } },
    }),
    prisma.cooperativeProfile.findMany({
      where: { collectorId: { in: [...new Set(points.map(({ collectorId }) => collectorId))] } },
    }),
  ]);
  const configurationsByPoint = new Map(
    configurations.map((configuration) => [configuration.collectionPointId, configuration]),
  );
  const profilesByCollector = new Map(profiles.map((profile) => [profile.collectorId, profile]));

  return (point: { id: string; collectorId: string }) =>
    toCooperativeDetails(
      profilesByCollector.get(point.collectorId),
      configurationsByPoint.get(point.id),
    );
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
        data: { collectionPointId: point.id, ...toConfigurationData(cooperative) },
      });
      const profile = await transaction.cooperativeProfile.upsert({
        where: { collectorId: data.collectorId },
        create: { collectorId: data.collectorId, ...toProfileData(cooperative) },
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
      // Diff the links instead of recreating them: categories kept on resubmission must keep
      // their reception settings (BE-19) instead of silently going back to the defaults.
      categories: {
        deleteMany: { categoryId: { notIn: data.categoryIds } },
        createMany: {
          data: data.categoryIds.map((categoryId) => ({ categoryId })),
          skipDuplicates: true,
        },
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
      client.collectionPoint.update({ where: { id }, data: updateData, include: pointWithDetails });

    if (!cooperative) {
      return toEntity(await updatePoint(prisma));
    }

    return prisma.$transaction(async (transaction) => {
      const point = await updatePoint(transaction);
      const configuration = await transaction.collectionPointConfiguration.upsert({
        where: { collectionPointId: id },
        create: { collectionPointId: id, ...toConfigurationData(cooperative) },
        update: toConfigurationData(cooperative),
      });
      const profile = await transaction.cooperativeProfile.upsert({
        where: { collectorId: data.collectorId },
        create: { collectorId: data.collectorId, ...toProfileData(cooperative) },
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
      include: publicPointWithDetails,
    });
    return point ? toEntity(point) : null;
  }

  findSummaryById(id: string) {
    return prisma.collectionPoint.findUnique({
      where: { id },
      select: { id: true, collectorId: true, status: true },
    });
  }

  async updateMaterialSettings(
    pointId: string,
    categoryId: string,
    settings: UpdateCollectionPointMaterialSettings,
  ) {
    const { count } = await prisma.pointCategory.updateMany({
      where: { pointId, categoryId },
      data: {
        ...(settings.capacityKg !== undefined && { capacityKg: settings.capacityKg }),
        ...(settings.isAccepting !== undefined && { isAccepting: settings.isAccepting }),
      },
    });

    if (count === 0) return null;

    const material = await prisma.pointCategory.findUnique({
      where: { pointId_categoryId: { pointId, categoryId } },
      select: { capacityKg: true, isAccepting: true },
    });

    if (!material) return null;

    return {
      pointId,
      categoryId,
      capacityKg: material.capacityKg?.toNumber() ?? null,
      isAccepting: material.isAccepting,
    };
  }

  async listMine(collectorId: string) {
    const points = await prisma.collectionPoint.findMany({
      where: { collectorId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: pointWithDetails,
    });
    const cooperativeOf = await loadCooperativeDetails(points);
    // The owner needs to tell approved categories from those still waiting for an admin (BE-21).
    return points.map((row) => ({
      ...toEntity(row, cooperativeOf(row)),
      categoryApprovals: row.categories
        .map((link) => ({
          categoryId: link.categoryId,
          name: link.category.name,
          approvalStatus: link.approvalStatus,
          isAccepting: link.isAccepting,
          capacityKg: link.capacityKg?.toNumber() ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }

  async listPending() {
    const points = await prisma.collectionPoint.findMany({
      where: { status: CollectionPointStatus.PENDING },
      include: { ...pointWithDetails, ...pointWithCollector },
      orderBy: { createdAt: "asc" },
    });
    const cooperativeOf = await loadCooperativeDetails(points);
    return points.map((point) => toEntity(point, cooperativeOf(point)));
  }

  async findActiveCategoriesByNames(names: string[]) {
    return prisma.wasteCategory.findMany({
      where: { name: { in: names }, active: true },
      select: { id: true, name: true },
    });
  }

  async findCategoriesByPointId(pointId: string) {
    const rows = await prisma.pointCategory.findMany({
      where: { pointId },
      include: { category: { select: { name: true } } },
    });
    return rows.map(
      (r) =>
        new PointCategory(
          r.pointId,
          r.categoryId,
          r.category.name,
          r.approvalStatus,
          r.isAccepting,
          r.capacityKg?.toNumber() ?? null,
        ),
    );
  }

  async applyCategoryChanges(
    pointId: string,
    { removeIds, addIds, approvedById }: ApplyCategoryChangesData,
  ) {
    const approvalStatus = approvedById
      ? PointCategoryApprovalStatus.APPROVED
      : PointCategoryApprovalStatus.PENDING;

    await prisma.$transaction([
      prisma.pointCategory.deleteMany({
        where: { pointId, categoryId: { in: removeIds } },
      }),
      prisma.pointCategory.createMany({
        data: addIds.map((categoryId) => ({ pointId, categoryId, approvalStatus })),
        skipDuplicates: true,
      }),
      ...(approvedById && addIds.length > 0
        ? [
            prisma.pointCategoryReview.createMany({
              data: addIds.map((categoryId) => ({
                pointId,
                categoryId,
                decision: PointCategoryDecision.APPROVED,
                reviewedById: approvedById,
              })),
            }),
          ]
        : []),
    ]);
  }

  async listPendingCategories() {
    const rows = await prisma.pointCategory.findMany({
      where: { approvalStatus: "PENDING" },
      include: {
        point: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      pointId: r.pointId,
      pointName: r.point.name,
      categoryId: r.categoryId,
      categoryName: r.category.name,
    }));
  }

  async reviewCategory(
    pointId: string,
    categoryId: string,
    { decision, reason, reviewedById }: PointCategoryReviewData,
  ) {
    return prisma.$transaction(async (tx) => {
      // Conditional on PENDING so concurrent reviews cannot both win (nor fail with a 500).
      const where = { pointId, categoryId, approvalStatus: PointCategoryApprovalStatus.PENDING };
      const { count } =
        decision === "APPROVED"
          ? await tx.pointCategory.updateMany({
              where,
              data: { approvalStatus: PointCategoryApprovalStatus.APPROVED },
            })
          : await tx.pointCategory.deleteMany({ where });
      if (count === 0) return false;

      await tx.pointCategoryReview.create({
        data: { pointId, categoryId, decision, reason, reviewedById },
      });
      return true;
    });
  }

  async listCategoryReviews(pointId: string) {
    const rows = await prisma.pointCategoryReview.findMany({
      where: { pointId },
      orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
      take: CATEGORY_REVIEW_HISTORY_LIMIT,
      include: {
        category: { select: { name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      decision: row.decision,
      reason: row.reason,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
    }));
  }
}
