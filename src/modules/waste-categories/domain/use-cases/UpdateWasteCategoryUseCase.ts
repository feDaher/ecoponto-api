import { AppError } from "../../../../shared/errors/AppError";
import type { IWasteCategoryRepository } from "../repositories/IWasteCategoryRepository";

export interface UpdateWasteCategoryInput {
  id: string;
  name: string;
}

export class UpdateWasteCategoryUseCase {
  constructor(private readonly wasteCategoryRepository: IWasteCategoryRepository) {}

  async execute({ id, name }: UpdateWasteCategoryInput) {
    const category = await this.wasteCategoryRepository.findById(id);

    if (!category) {
      throw new AppError("Waste category not found", 404);
    }

    const sameName = await this.wasteCategoryRepository.findByName(name);

    if (sameName && sameName.id !== id) {
      throw new AppError("Waste category already exists", 409);
    }

    return this.wasteCategoryRepository.update(id, { name });
  }
}
