import type { IWasteCategoryRepository } from "../repositories/IWasteCategoryRepository";

export class ListWasteCategoriesUseCase {
  constructor(private readonly wasteCategoryRepository: IWasteCategoryRepository) {}

  execute() {
    return this.wasteCategoryRepository.findMany();
  }
}
