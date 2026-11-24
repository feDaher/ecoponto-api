import { AppError } from "../../../../shared/errors/AppError";
import type { IWasteCategoryRepository } from "../repositories/IWasteCategoryRepository";
import type { WasteClass } from "../../../../generated/prisma/enums";

export interface CreateWasteCategoryInput {
  name: string;
  label?: string | null;
  wasteClass?: WasteClass | null;
}

export class CreateWasteCategoryUseCase {
  constructor(private readonly wasteCategoryRepository: IWasteCategoryRepository) {}

  async execute({ name, label, wasteClass }: CreateWasteCategoryInput) {
    const existing = await this.wasteCategoryRepository.findByName(name);

    if (existing) {
      throw new AppError("Waste category already exists", 409);
    }

    return this.wasteCategoryRepository.create({ name, label, wasteClass });
  }
}
