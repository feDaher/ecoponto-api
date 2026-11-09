import { distanceInKm } from "../../../../shared/geo/distance";
import type { CollectionPoint } from "../entities/CollectionPoint";
import type {
  CollectionPointSearchFilters,
  ICollectionPointRepository,
} from "../repositories/ICollectionPointRepository";
import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
import { ensureActiveWasteCategories } from "../policies/ensureActiveWasteCategories";
export interface ListPublicCollectionPointsInput extends CollectionPointSearchFilters {
  latitude?: number;
  longitude?: number;
  radius?: number;
}
export class ListPublicCollectionPointsUseCase {
  constructor(
    private readonly points: ICollectionPointRepository,
    private readonly categories: IWasteCategoryRepository,
  ) {}
  async execute(input: ListPublicCollectionPointsInput): Promise<CollectionPoint[]> {
    const city = input.city?.trim() || undefined;
    const wasteType = input.wasteType?.trim() || undefined;
    if (wasteType) await ensureActiveWasteCategories(this.categories, [wasteType]);
    const points = await this.points.findPublic({ city, wasteType });
    if (input.latitude === undefined || input.longitude === undefined || input.radius === undefined)
      return points;
    return points.filter((point) => {
      if (point.latitude == null || point.longitude == null) return false;
      return (
        distanceInKm(
          { latitude: input.latitude!, longitude: input.longitude! },
          { latitude: Number(point.latitude), longitude: Number(point.longitude) },
        ) <= input.radius!
      );
    });
  }
}
