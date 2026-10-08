import { AppError } from "../../../../shared/errors/AppError";
import type { IWasteCategoryRepository } from "../repositories/IWasteCategoryRepository";

export interface CreateWasteCategoryInput {
  name: string;
}

export class CreateWasteCategoryUseCase {
  constructor(private readonly wasteCategoryRepository: IWasteCategoryRepository) {}

  async execute({ name }: CreateWasteCategoryInput) {
    const existing = await this.wasteCategoryRepository.findByName(name);

    if (existing) {
      throw new AppError("Waste category already exists", 409);
    }

    return this.wasteCategoryRepository.create({ name });
  }
}
