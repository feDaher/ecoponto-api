import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";

export class ListPendingCategoriesUseCase {
  constructor(private readonly repository: ICollectionPointRepository) {}

  execute() {
    return this.repository.listPendingCategories();
  }
}
