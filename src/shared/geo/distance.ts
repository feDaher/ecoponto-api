export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_KM;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceInKm(from: GeoPoint, to: GeoPoint) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundingBox(center: GeoPoint, radiusKm: number): GeoBounds {
  const latitudeDelta = radiusKm / KM_PER_DEGREE;
  const longitudeScale = Math.cos(toRadians(center.latitude));
  const longitudeDelta = longitudeScale > 1e-6 ? radiusKm / (KM_PER_DEGREE * longitudeScale) : 180;

  return {
    minLatitude: center.latitude - latitudeDelta,
    maxLatitude: center.latitude + latitudeDelta,
    minLongitude: center.longitude - longitudeDelta,
    maxLongitude: center.longitude + longitudeDelta,
  };
}
