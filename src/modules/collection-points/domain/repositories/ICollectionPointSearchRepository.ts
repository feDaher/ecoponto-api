import type { CollectionPoint } from "../../../../generated/prisma/client";
import type { GeoPoint } from "../../../../shared/geo/distance";
import type { CollectionPointHour } from "../entities/CollectionPoint";

export type PublicOperatingHour = CollectionPointHour;

export type PublicCollectionPoint = Omit<
  CollectionPoint,
  "rejectionReason" | "reviewedById" | "reviewedAt"
> & { wasteCategories: string[] };

export type SearchResultCollectionPoint = PublicCollectionPoint & {
  hours: PublicOperatingHour[];
};

export interface CollectionPointSearchCriteria {
  city?: string;
  wasteTypes?: readonly string[];
  origin?: GeoPoint;
  radiusKm?: number;
  limit: number;
}

export interface SearchedCollectionPoint {
  point: SearchResultCollectionPoint;
  distanceKm: number | null;
}

export interface CollectionPointSearchPage {
  items: SearchedCollectionPoint[];
  total: number;
}

export interface ICollectionPointSearchRepository {
  findApproved(criteria: CollectionPointSearchCriteria): Promise<CollectionPointSearchPage>;
}
