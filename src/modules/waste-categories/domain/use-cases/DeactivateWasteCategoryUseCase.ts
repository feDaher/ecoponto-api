import { AppError } from "../../../../shared/errors/AppError";
import type { IWasteCategoryRepository } from "../repositories/IWasteCategoryRepository";

export interface DeactivateWasteCategoryInput {
  id: string;
}

export class DeactivateWasteCategoryUseCase {
  constructor(private readonly wasteCategoryRepository: IWasteCategoryRepository) {}

  async execute({ id }: DeactivateWasteCategoryInput) {
    const category = await this.wasteCategoryRepository.findById(id);

    if (!category) {
      throw new AppError("Waste category not found", 404);
    }

    await this.wasteCategoryRepository.deactivate(id);
  }
}
