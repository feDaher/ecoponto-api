import { prisma, prismaRead } from "../../../../config/prisma";
import { AppError } from "../../../../shared/errors/AppError";
import { ContentFormat, ContentStatus } from "../../../../generated/prisma/enums";
import type { Prisma } from "../../../../generated/prisma/client";
import type {
  ContentPage,
  ContentSort,
  CreateEducationalContentData,
  EducationalContentStats,
  IEducationalContentRepository,
  ManagedContentFilter,
  PublishedContentFilter,
  UpdateEducationalContentData,
} from "../../domain/repositories/IEducationalContentRepository";

const ORDER_BY: Record<ContentSort, Prisma.EducationalContentOrderByWithRelationInput[]> = {
  recent: [{ updatedAt: "desc" }, { id: "asc" }],
  views: [{ viewCount: "desc" }, { id: "asc" }],
  title: [{ title: "asc" }, { id: "asc" }],
};

export class PrismaEducationalContentRepository implements IEducationalContentRepository {
  async create(data: CreateEducationalContentData) {
    try {
      if (!data.featured) {
        return await prisma.educationalContent.create({ data });
      }
      return await prisma.$transaction(async (tx) => {
        await tx.educationalContent.updateMany({
          where: { featured: true },
          data: { featured: false },
        });
        return tx.educationalContent.create({ data });
      });
    } catch (error) {
      throw toSlugConflict(error);
    }
  }

  findById(id: string) {
    return prisma.educationalContent.findUnique({ where: { id } });
  }

  findBySlug(slug: string) {
    return prisma.educationalContent.findUnique({ where: { slug } });
  }

  findPublished(filter: PublishedContentFilter) {
    return prisma.educationalContent.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        categoryId: filter.categoryId,
        format: filter.format,
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    });
  }

  findPublishedById(id: string) {
    return prisma.educationalContent.findFirst({
      where: { id, status: ContentStatus.PUBLISHED },
    });
  }

  findFeatured() {
    return prisma.educationalContent.findFirst({
      where: { featured: true, status: ContentStatus.PUBLISHED },
    });
  }

  async findManaged(filter: ManagedContentFilter): Promise<ContentPage> {
    const where: Prisma.EducationalContentWhereInput = {
      categoryId: filter.categoryId,
      format: filter.format,
      status: filter.status,
      level: filter.level,
      ...(filter.search && {
        OR: [{ title: { contains: filter.search } }, { slug: { contains: filter.search } }],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.educationalContent.findMany({
        where,
        orderBy: ORDER_BY[filter.sort],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.educationalContent.count({ where }),
    ]);

    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }

  async getStats(monthStart: Date): Promise<EducationalContentStats> {
    const [total, published, drafts, pendingReview, addedThisMonth, views, formats] =
      await Promise.all([
        prismaRead.educationalContent.count(),
        prismaRead.educationalContent.count({ where: { status: ContentStatus.PUBLISHED } }),
        prismaRead.educationalContent.count({ where: { status: ContentStatus.DRAFT } }),
        prismaRead.educationalContent.count({ where: { status: ContentStatus.PENDING_REVIEW } }),
        prismaRead.educationalContent.count({ where: { createdAt: { gte: monthStart } } }),
        prismaRead.educationalContent.aggregate({ _sum: { viewCount: true } }),
        prismaRead.educationalContent.groupBy({ by: ["format"], _count: { _all: true } }),
      ]);

    const byFormat = Object.fromEntries(
      Object.values(ContentFormat).map((format) => [format, 0]),
    ) as Record<ContentFormat, number>;
    for (const group of formats) {
      byFormat[group.format] = group._count._all;
    }

    return {
      total,
      published,
      drafts,
      pendingReview,
      addedThisMonth,
      totalViews: views._sum.viewCount ?? 0,
      byFormat,
    };
  }

  async update(id: string, data: UpdateEducationalContentData) {
    try {
      if (!data.featured) {
        return await prisma.educationalContent.update({ where: { id }, data });
      }
      return await prisma.$transaction(async (tx) => {
        await tx.educationalContent.updateMany({
          where: { featured: true, id: { not: id } },
          data: { featured: false },
        });
        return tx.educationalContent.update({ where: { id }, data });
      });
    } catch (error) {
      throw toSlugConflict(error);
    }
  }

  async incrementViews(id: string) {
    await prisma.educationalContent.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  async delete(id: string) {
    await prisma.educationalContent.delete({ where: { id } });
  }
}

function toSlugConflict(error: unknown) {
  const uniqueViolation =
    typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  return uniqueViolation ? new AppError("Slug already in use", 409) : error;
}
