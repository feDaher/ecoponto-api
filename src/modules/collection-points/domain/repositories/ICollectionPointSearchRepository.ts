import type { CollectionPoint } from "../../../../generated/prisma/client";
import type { GeoPoint } from "../../../../shared/geo/distance";

export type PublicCollectionPoint = Omit<
  CollectionPoint,
  "rejectionReason" | "reviewedById" | "reviewedAt"
> & { wasteCategories: string[] };

export interface CollectionPointSearchCriteria {
  city?: string;
  wasteTypes?: readonly string[];
  origin?: GeoPoint;
  radiusKm?: number;
  limit: number;
}

export interface SearchedCollectionPoint {
  point: PublicCollectionPoint;
  distanceKm: number | null;
}

export interface CollectionPointSearchPage {
  items: SearchedCollectionPoint[];
  total: number;
}

export interface ICollectionPointSearchRepository {
  findApproved(criteria: CollectionPointSearchCriteria): Promise<CollectionPointSearchPage>;
}
