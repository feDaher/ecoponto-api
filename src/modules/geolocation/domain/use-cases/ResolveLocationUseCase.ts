import { LocationSource } from "../../../../generated/prisma/enums";
import { AppError } from "../../../../shared/errors/AppError";
import { distanceInKm, type GeoPoint } from "../../../../shared/geo/distance";
import type { IPlacesGateway } from "../../../places/domain/gateways/IPlacesGateway";
import type { ResolvedLocation } from "../entities/ResolvedLocation";
import { MAX_DISTANCE_FROM_ADDRESS_KM, isWithinBrazil } from "../rules/location-rules";

export interface ResolveLocationInput {
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export const LocationErrors = {
  MISSING: "Provide valid GPS coordinates or a verifiable address (placeId)",
  INCOMPLETE_COORDINATES: "Latitude and longitude must be provided together",
  OUTSIDE_SERVICE_AREA: "Coordinates must be a valid location within Brazil",
  ADDRESS_NOT_FOUND: "The selected address could not be verified",
  ADDRESS_OUTSIDE_SERVICE_AREA: "The selected address is outside Brazil",
  COORDINATES_MISMATCH: `Coordinates are more than ${MAX_DISTANCE_FROM_ADDRESS_KM} km away from the selected address`,
} as const;

const invalidLocation = (message: string) => new AppError(message, 422);

export class ResolveLocationUseCase {
  constructor(private readonly placesGateway: IPlacesGateway) {}

  async execute({ latitude, longitude, placeId }: ResolveLocationInput): Promise<ResolvedLocation> {
    const coordinates = this.readCoordinates(latitude, longitude);

    if (placeId) {
      return this.resolveVerifiedAddress(placeId, coordinates);
    }

    if (coordinates) {
      return { ...coordinates, source: LocationSource.GPS_COORDINATES, placeId: null };
    }

    throw invalidLocation(LocationErrors.MISSING);
  }

  private readCoordinates(latitude?: number, longitude?: number): GeoPoint | null {
    if (latitude === undefined && longitude === undefined) {
      return null;
    }

    if (latitude === undefined || longitude === undefined) {
      throw invalidLocation(LocationErrors.INCOMPLETE_COORDINATES);
    }

    const coordinates = { latitude, longitude };

    if (!isWithinBrazil(coordinates)) {
      throw invalidLocation(LocationErrors.OUTSIDE_SERVICE_AREA);
    }

    return coordinates;
  }

  private async resolveVerifiedAddress(
    placeId: string,
    coordinates: GeoPoint | null,
  ): Promise<ResolvedLocation> {
    const place = await this.lookUpPlace(placeId);

    if (!isWithinBrazil(place)) {
      throw invalidLocation(LocationErrors.ADDRESS_OUTSIDE_SERVICE_AREA);
    }

    if (coordinates && distanceInKm(place, coordinates) > MAX_DISTANCE_FROM_ADDRESS_KM) {
      throw invalidLocation(LocationErrors.COORDINATES_MISMATCH);
    }

    const { latitude, longitude } = coordinates ?? place;

    return { latitude, longitude, source: LocationSource.VERIFIED_ADDRESS, placeId };
  }

  private async lookUpPlace(placeId: string) {
    try {
      return await this.placesGateway.getDetails({ placeId });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        throw invalidLocation(LocationErrors.ADDRESS_NOT_FOUND);
      }

      throw error;
    }
  }
}
