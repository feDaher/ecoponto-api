import type { PointCategory } from "../entities/PointCategory";

import type {
  CollectionPoint,
  CollectionPointDraft,
  CollectionPointLocationSource,
  CollectionPointOperatingHours,
  CollectionPointStatus,
} from "../entities/CollectionPoint";
export interface CollectionPointWriteData extends Omit<
  CollectionPointDraft,
  "latitude" | "longitude" | "placeId" | "wasteCategories"
> {
  collectorId: string;
  latitude: number;
  longitude: number;
  locationSource: CollectionPointLocationSource;
  placeId: string | null;
  categoryIds: string[];
  operatingHours?: CollectionPointOperatingHours[];
}
export interface CreateCollectionPointData extends CollectionPointWriteData {
  operatingHours: CollectionPointOperatingHours[];
}
export interface ReviewCollectionPointData {
  status: Extract<CollectionPointStatus, "APPROVED" | "REJECTED">;
  rejectionReason: string | null;
  reviewedById: string;
  reviewedAt: Date;
}
export type CollectionPointSummary = Pick<CollectionPoint, "id" | "collectorId" | "status">;
export interface CollectionPointMaterialSettings {
  pointId: string;
  categoryId: string;
  capacityKg: number | null;
  isAccepting: boolean;
}
export interface UpdateCollectionPointMaterialSettings {
  capacityKg?: number | null;
  isAccepting?: boolean;
}
export interface ApplyCategoryChangesData {
  removeIds: string[];
  addIds: string[];
  /** Set when an ADMIN adds categories: they are created APPROVED and logged as their decision. */
  approvedById?: string;
}
export type PointCategoryDecision = "APPROVED" | "REJECTED";
export interface PointCategoryReviewData {
  decision: PointCategoryDecision;
  reason: string | null;
  reviewedById: string;
}
export interface PointCategoryReviewRecord {
  id: string;
  categoryId: string;
  categoryName: string;
  decision: PointCategoryDecision;
  reason: string | null;
  reviewedAt: Date;
  reviewedBy: { id: string; name: string } | null;
}
export interface PendingPointCategory {
  pointId: string;
  pointName: string;
  categoryId: string;
  categoryName: string;
}
export interface ICollectionPointRepository {
  create(data: CreateCollectionPointData): Promise<CollectionPoint>;
  update(id: string, data: CollectionPointWriteData): Promise<CollectionPoint>;
  review(id: string, data: ReviewCollectionPointData): Promise<CollectionPoint>;
  findApprovedById(id: string): Promise<CollectionPoint | null>;
  findSummaryById(id: string): Promise<CollectionPointSummary | null>;
  updateMaterialSettings(
    pointId: string,
    categoryId: string,
    settings: UpdateCollectionPointMaterialSettings,
  ): Promise<CollectionPointMaterialSettings | null>;
  listMine(collectorId: string): Promise<CollectionPoint[]>;
  listPending(): Promise<CollectionPoint[]>;
  findActiveCategoriesByNames(names: string[]): Promise<{ id: string; name: string }[]>;
  findCategoriesByPointId(pointId: string): Promise<PointCategory[]>;
  applyCategoryChanges(pointId: string, data: ApplyCategoryChangesData): Promise<void>;
  listPendingCategories(): Promise<PendingPointCategory[]>;
  reviewCategory(
    pointId: string,
    categoryId: string,
    review: PointCategoryReviewData,
  ): Promise<boolean>;
  listCategoryReviews(pointId: string): Promise<PointCategoryReviewRecord[]>;
}
