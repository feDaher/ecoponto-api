import type { GeoPoint } from "../../../../shared/geo/distance";

export const BRAZIL_BOUNDS = {
  minLatitude: -33.76,
  maxLatitude: 5.28,
  minLongitude: -74.0,
  maxLongitude: -28.84,
} as const;

export const MAX_DISTANCE_FROM_ADDRESS_KM = 1;

export function isWithinBrazil({ latitude, longitude }: GeoPoint) {
  return (
    latitude >= BRAZIL_BOUNDS.minLatitude &&
    latitude <= BRAZIL_BOUNDS.maxLatitude &&
    longitude >= BRAZIL_BOUNDS.minLongitude &&
    longitude <= BRAZIL_BOUNDS.maxLongitude
  );
}
