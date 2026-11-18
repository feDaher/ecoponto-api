import type { CollectionPoint } from "../entities/CollectionPoint";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";
export class ListPendingCollectionPointsUseCase {
  constructor(private readonly points: ICollectionPointRepository) {}
  execute(): Promise<CollectionPoint[]> {
    return this.points.listPending();
  }
}
