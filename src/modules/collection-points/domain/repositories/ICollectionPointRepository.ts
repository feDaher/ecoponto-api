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
  latitude: number;
  longitude: number;
  locationSource: CollectionPointLocationSource;
  placeId: string | null;
  categoryIds: string[];
}
export interface CreateCollectionPointData extends CollectionPointWriteData {
  collectorId: string;
  operatingHours: CollectionPointOperatingHours[];
}
export interface ReviewCollectionPointData {
  status: Extract<CollectionPointStatus, "APPROVED" | "REJECTED">;
  rejectionReason: string | null;
  reviewedById: string;
  reviewedAt: Date;
}
export type CollectionPointSummary = Pick<CollectionPoint, "id" | "collectorId" | "status">;

export interface ICollectionPointRepository {
  create(data: CreateCollectionPointData): Promise<CollectionPoint>;
  update(id: string, data: CollectionPointWriteData): Promise<CollectionPoint>;
  review(id: string, data: ReviewCollectionPointData): Promise<CollectionPoint>;
  findApprovedById(id: string): Promise<CollectionPoint | null>;
  findSummaryById(id: string): Promise<CollectionPointSummary | null>;
  listMine(collectorId: string): Promise<CollectionPoint[]>;
  listPending(): Promise<CollectionPoint[]>;
}
