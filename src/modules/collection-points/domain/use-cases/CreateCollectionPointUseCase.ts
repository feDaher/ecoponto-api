import type { CollectionPoint, CollectionPointDraft } from "../entities/CollectionPoint";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";
import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
import { ensureActiveWasteCategories } from "../policies/ensureActiveWasteCategories";
import type { ICollectionPointLocationResolver } from "../gateways/ICollectionPointLocationResolver";
export interface CreateCollectionPointInput extends CollectionPointDraft {
  collectorId: string;
}
export class CreateCollectionPointUseCase {
  constructor(
    private readonly points: ICollectionPointRepository,
    private readonly categories: IWasteCategoryRepository,
    private readonly location: ICollectionPointLocationResolver,
  ) {}
  async execute(input: CreateCollectionPointInput): Promise<CollectionPoint> {
    const categoryIds = await ensureActiveWasteCategories(this.categories, input.wasteCategories);
    const resolved = await this.location.execute({
      latitude: input.latitude,
      longitude: input.longitude,
      placeId: input.placeId,
    });
    const { wasteCategories: _wasteCategories, ...pointData } = input;
    const { source, ...resolvedData } = resolved;
    return this.points.create({
      ...pointData,
      ...resolvedData,
      locationSource: source,
      categoryIds,
    });
  }
}
