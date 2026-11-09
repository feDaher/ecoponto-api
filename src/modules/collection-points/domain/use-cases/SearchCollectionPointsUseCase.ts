import type {
  CollectionPointSearchCriteria,
  CollectionPointSearchPage,
  ICollectionPointSearchRepository,
} from "../repositories/ICollectionPointSearchRepository";

export class SearchCollectionPointsUseCase {
  constructor(private readonly repository: ICollectionPointSearchRepository) {}

  execute(input: CollectionPointSearchCriteria): Promise<CollectionPointSearchPage> {
    return this.repository.findApproved(input);
  }
}
