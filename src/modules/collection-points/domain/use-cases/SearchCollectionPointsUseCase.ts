import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
import { ensureActiveWasteCategories } from "../policies/ensureActiveWasteCategories";
import type {
  CollectionPointSearchCriteria,
  CollectionPointSearchPage,
  ICollectionPointSearchRepository,
} from "../repositories/ICollectionPointSearchRepository";

export class SearchCollectionPointsUseCase {
  constructor(
    private readonly repository: ICollectionPointSearchRepository,
    private readonly categories: IWasteCategoryRepository,
  ) {}

  async execute(input: CollectionPointSearchCriteria): Promise<CollectionPointSearchPage> {
    const [, page] = await Promise.all([
      input.wasteTypes?.length
        ? ensureActiveWasteCategories(this.categories, [...input.wasteTypes])
        : undefined,
      this.repository.findApproved(input),
    ]);
    return page;
  }
}
