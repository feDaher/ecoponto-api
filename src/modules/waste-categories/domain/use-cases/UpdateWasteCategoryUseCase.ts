import { AppError } from "../../../../shared/errors/AppError";
import type { IWasteCategoryRepository } from "../repositories/IWasteCategoryRepository";
import type { WasteClass } from "../../../../generated/prisma/enums";

export interface UpdateWasteCategoryInput {
  id: string;
  name: string;
  label?: string | null;
  wasteClass?: WasteClass | null;
}

export class UpdateWasteCategoryUseCase {
  constructor(private readonly wasteCategoryRepository: IWasteCategoryRepository) {}

  async execute({ id, name, label, wasteClass }: UpdateWasteCategoryInput) {
    const category = await this.wasteCategoryRepository.findById(id);

    if (!category) {
      throw new AppError("Waste category not found", 404);
    }

    const sameName = await this.wasteCategoryRepository.findByName(name);

    if (sameName && sameName.id !== id) {
      throw new AppError("Waste category already exists", 409);
    }

    return this.wasteCategoryRepository.update(id, { name, label, wasteClass });
  }
}
