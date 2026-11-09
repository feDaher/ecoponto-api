import type {
  CollectionPoint,
  CollectionPointDraft,
  CollectionPointLocationSource,
  CollectionPointStatus,
} from "../entities/CollectionPoint";
export interface CollectionPointSearchFilters {
  city?: string;
  wasteType?: string;
}
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
}
export interface ReviewCollectionPointData {
  status: Extract<CollectionPointStatus, "APPROVED" | "REJECTED">;
  rejectionReason: string | null;
  reviewedById: string;
  reviewedAt: Date;
}
export interface ICollectionPointRepository {
  create(data: CreateCollectionPointData): Promise<CollectionPoint>;
  update(id: string, data: CollectionPointWriteData): Promise<CollectionPoint>;
  review(id: string, data: ReviewCollectionPointData): Promise<CollectionPoint>;
  findPublic(filters: CollectionPointSearchFilters): Promise<CollectionPoint[]>;
  findApprovedById(id: string): Promise<CollectionPoint | null>;
  findById(id: string): Promise<CollectionPoint | null>;
  listMine(collectorId: string): Promise<CollectionPoint[]>;
  listPending(): Promise<CollectionPoint[]>;
}
