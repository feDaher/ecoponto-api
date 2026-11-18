import type { CollectionPointLocationSource } from "../entities/CollectionPoint";

export interface ICollectionPointLocationResolver {
  execute(input: { latitude?: number; longitude?: number; placeId?: string }): Promise<{
    latitude: number;
    longitude: number;
    source: CollectionPointLocationSource;
    placeId: string | null;
  }>;
}
