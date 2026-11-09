import type { CollectionPoint } from "../entities/CollectionPoint";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";
export class ListMyCollectionPointsUseCase {
  constructor(private readonly points: ICollectionPointRepository) {}
  execute(collectorId: string): Promise<CollectionPoint[]> {
    return this.points.listMine(collectorId);
  }
}
