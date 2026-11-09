import { AppError } from "../../../../shared/errors/AppError";
import { ContentStatus } from "../../../../generated/prisma/enums";
import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
import { slugify } from "../entities/EducationalContent";
import type {
  CreateEducationalContentData,
  IEducationalContentRepository,
} from "../repositories/IEducationalContentRepository";

export type CreateEducationalContentInput = Omit<
  CreateEducationalContentData,
  "slug" | "publishedAt"
> & { slug?: string };

export class CreateEducationalContentUseCase {
  constructor(
    private readonly educationalContentRepository: IEducationalContentRepository,
    private readonly wasteCategoryRepository: IWasteCategoryRepository,
  ) {}

  async execute(input: CreateEducationalContentInput) {
    const category = await this.wasteCategoryRepository.findById(input.categoryId);
    if (!category || !category.active) {
      throw new AppError("Category not found", 404);
    }

    const slug = slugify(input.slug ?? input.title);
    if (!slug) {
      throw new AppError("Slug must contain letters or digits", 422);
    }
    if (await this.educationalContentRepository.findBySlug(slug)) {
      throw new AppError("Slug already in use", 409);
    }

    const published = input.status === ContentStatus.PUBLISHED;
    if (input.featured && !published) {
      throw new AppError("Only published content can be featured", 422);
    }

    return this.educationalContentRepository.create({
      ...input,
      slug,
      publishedAt: published ? new Date() : null,
    });
  }
}
