import { AppError } from "../../../../shared/errors/AppError";
import { ContentStatus } from "../../../../generated/prisma/enums";
import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
import { slugify } from "../entities/EducationalContent";
import type {
  IEducationalContentRepository,
  UpdateEducationalContentData,
} from "../repositories/IEducationalContentRepository";

export type UpdateEducationalContentInput = Omit<UpdateEducationalContentData, "publishedAt">;

export class UpdateEducationalContentUseCase {
  constructor(
    private readonly educationalContentRepository: IEducationalContentRepository,
    private readonly wasteCategoryRepository: IWasteCategoryRepository,
  ) {}

  async execute(id: string, input: UpdateEducationalContentInput) {
    const content = await this.educationalContentRepository.findById(id);
    if (!content) {
      throw new AppError("Content not found", 404);
    }

    if (input.categoryId !== undefined) {
      const category = await this.wasteCategoryRepository.findById(input.categoryId);
      if (!category || !category.active) {
        throw new AppError("Category not found", 404);
      }
    }

    const data: UpdateEducationalContentData = { ...input };

    if (input.slug !== undefined) {
      data.slug = slugify(input.slug);
      if (!data.slug) {
        throw new AppError("Slug must contain letters or digits", 422);
      }
      const owner = await this.educationalContentRepository.findBySlug(data.slug);
      if (owner && owner.id !== id) {
        throw new AppError("Slug already in use", 409);
      }
    }

    const published = (input.status ?? content.status) === ContentStatus.PUBLISHED;
    if (input.featured && !published) {
      throw new AppError("Only published content can be featured", 422);
    }
    if (!published && content.featured) {
      data.featured = false;
    }
    if (published && !content.publishedAt) {
      data.publishedAt = new Date();
    }

    return this.educationalContentRepository.update(id, data);
  }
}
