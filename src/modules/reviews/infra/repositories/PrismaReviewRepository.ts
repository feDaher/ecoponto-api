import { prisma } from "../../../../config/prisma";
import { CollectionPointStatus } from "../../../../generated/prisma/enums";
import type { Prisma } from "../../../../generated/prisma/client";
import {
  ReviewVisibility,
  toPublicAuthorName,
  type ModerationReview,
  type NewReview,
  type Page,
  type PageRequest,
  type PublicReview,
} from "../../domain/entities/Review";
import type {
  IReviewRepository,
  ModerationFilters,
} from "../../domain/repositories/IReviewRepository";

const moderationSelect = {
  id: true,
  rating: true,
  comment: true,
  isHidden: true,
  createdAt: true,
  updatedAt: true,
  citizen: { select: { id: true, name: true } },
  collectionPoint: { select: { id: true, name: true } },
} satisfies Prisma.ReviewSelect;

type ModerationRow = Prisma.ReviewGetPayload<{ select: typeof moderationSelect }>;

function toModerationReview({ citizen, ...row }: ModerationRow): ModerationReview {
  return { ...row, author: citizen };
}

const publicSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  citizen: { select: { name: true } },
} satisfies Prisma.ReviewSelect;

type PublicRow = Prisma.ReviewGetPayload<{ select: typeof publicSelect }>;

function toPublicReview({ citizen, ...row }: PublicRow): PublicReview {
  return { ...row, authorName: toPublicAuthorName(citizen.name) };
}

export class PrismaReviewRepository implements IReviewRepository {
  async isCollectionPointPublic(collectionPointId: string) {
    const point = await prisma.collectionPoint.findFirst({
      where: { id: collectionPointId, status: CollectionPointStatus.APPROVED },
      select: { id: true },
    });
    return point !== null;
  }

  async findVisibleByCollectionPoint(
    collectionPointId: string,
    { limit, offset }: PageRequest,
  ): Promise<Page<PublicReview>> {
    const where = { collectionPointId, isHidden: false } satisfies Prisma.ReviewWhereInput;

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
        select: publicSelect,
      }),
      prisma.review.count({ where }),
    ]);

    return { items: rows.map(toPublicReview), total };
  }

  async findOwnReviewId(citizenId: string, collectionPointId: string) {
    const review = await prisma.review.findFirst({
      where: { citizenId, collectionPointId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return review?.id ?? null;
  }

  async create({ citizenId, collectionPointId, rating, comment }: NewReview) {
    const row = await prisma.review.create({
      data: { citizenId, collectionPointId, rating, comment },
      select: publicSelect,
    });
    return toPublicReview(row);
  }

  async updateContent(id: string, { rating, comment }: Pick<NewReview, "rating" | "comment">) {
    // `isHidden` fica como está: editar uma avaliação oculta não pode desfazer a moderação.
    const row = await prisma.review.update({
      where: { id },
      data: { rating, comment },
      select: publicSelect,
    });
    return toPublicReview(row);
  }

  async findForModeration(
    { visibility, collectionPointId }: ModerationFilters,
    { limit, offset }: PageRequest,
  ): Promise<Page<ModerationReview>> {
    const where: Prisma.ReviewWhereInput = {
      ...(collectionPointId !== undefined && { collectionPointId }),
      ...(visibility !== ReviewVisibility.ALL && {
        isHidden: visibility === ReviewVisibility.HIDDEN,
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
        select: moderationSelect,
      }),
      prisma.review.count({ where }),
    ]);

    return { items: rows.map(toModerationReview), total };
  }

  async exists(id: string) {
    const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
    return review !== null;
  }

  async setHidden(id: string, isHidden: boolean) {
    const row = await prisma.review.update({
      where: { id },
      data: { isHidden },
      select: moderationSelect,
    });
    return toModerationReview(row);
  }

  async delete(id: string) {
    // deleteMany não lança P2025 se outro admin apagou no meio do caminho: o resultado é o mesmo.
    await prisma.review.deleteMany({ where: { id } });
  }
}
