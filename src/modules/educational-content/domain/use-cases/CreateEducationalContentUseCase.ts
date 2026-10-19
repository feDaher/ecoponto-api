import type { IEducationalContentRepository } from "../repositories/IEducationalContentRepository";
import type { IWasteCategoryRepository } from "../../../waste-category/domain/repositories/IWasteCategoryRepository";
import { AppError } from "../../../../shared/errors/AppError";

export interface CreateEducationalContentInput {
  categoryId: string;
  title: string;
  content: string;
}

export class CreateEducationalContentUseCase {
  constructor(
    private readonly educationalContentRepository: IEducationalContentRepository,
    private readonly wasteCategoryRepository: IWasteCategoryRepository,
  ) {}
  async execute(categoryId: string, title: string, content: string) {
    const category = await this.wasteCategoryRepository.findById(categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }
    return this.educationalContentRepository.create({
      categoryId,
      title,
      content,
    });
  }
}
