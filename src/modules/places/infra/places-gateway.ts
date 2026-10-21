import { env } from "../../../config/env";
import type { IPlacesGateway } from "../domain/gateways/IPlacesGateway";
import { PlacesQuotaGuard, type PlacesDailyLimits } from "../domain/services/PlacesQuotaGuard";
import { GooglePlacesClient } from "./http/GooglePlacesClient";
import { PrismaPlacesUsageRepository } from "./repositories/PrismaPlacesUsageRepository";

export const placesDailyLimits: PlacesDailyLimits = {
  AUTOCOMPLETE: env.PLACES_AUTOCOMPLETE_DAILY_LIMIT,
  PLACE_DETAILS: env.PLACES_DETAILS_DAILY_LIMIT,
};

export const placesUsageRepository = new PrismaPlacesUsageRepository();

// Every Google Places call in the app (address search and collection point address
// verification) must go through this gateway so it counts toward the daily limit.
export const placesGateway: IPlacesGateway = new PlacesQuotaGuard(
  new GooglePlacesClient(env.GOOGLE_MAPS_API_KEY),
  placesUsageRepository,
  placesDailyLimits,
);
