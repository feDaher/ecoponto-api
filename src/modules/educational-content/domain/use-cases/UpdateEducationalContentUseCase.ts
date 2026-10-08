import { AppError } from "../../../../shared/errors/AppError";
import type {
  IEducationalContentRepository,
  UpdateEducationalContentData,
} from "../repositories/IEducationalContentRepository";
import type { IWasteCategoryRepository } from "../../../waste-category/domain/repositories/IWasteCategoryRepository";

export class UpdateEducationalContentUseCase {
  constructor(
    private readonly educationalContentRepository: IEducationalContentRepository,
    private readonly wasteCategoryRepository: IWasteCategoryRepository,
  ) {}

  async execute(id: string, data: UpdateEducationalContentData) {
    const content = await this.educationalContentRepository.findById(id);

    if (!content) {
      throw new AppError("Content not found", 404);
    }
    if (data.categoryId !== undefined) {
      const category = await this.wasteCategoryRepository.findById(data.categoryId);
      if (!category) {
        throw new AppError("Category not found", 404);
      }
    }

    const updatedContent = await this.educationalContentRepository.update(id, data);

    return updatedContent;
  }
}
