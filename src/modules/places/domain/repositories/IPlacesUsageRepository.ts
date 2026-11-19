export type PlacesSku = "AUTOCOMPLETE" | "PLACE_DETAILS";

export interface PlacesUsage {
  sku: PlacesSku;
  count: number;
}

export interface IPlacesUsageRepository {
  // Atomically adds one call to the day's counter, unless it already reached the limit.
  // Returns false (and counts nothing) when the limit is reached.
  tryConsume(sku: PlacesSku, day: string, limit: number): Promise<boolean>;
  findByDay(day: string): Promise<PlacesUsage[]>;
}
