import type { Coordinates, PlaceSuggestion } from "../entities/Place";
import type { IPlacesGateway } from "../gateways/IPlacesGateway";

// Approximate centre of Manhuaçu–MG, the city the product serves. Used to bias results
// when the client does not send its own location.
const DEFAULT_SEARCH_ORIGIN: Coordinates = { latitude: -20.2577, longitude: -42.0336 };

export interface AutocompletePlacesInput {
  input: string;
  sessionToken?: string;
  latitude?: number;
  longitude?: number;
}

export class AutocompletePlacesUseCase {
  constructor(private readonly placesGateway: IPlacesGateway) {}

  execute({
    input,
    sessionToken,
    latitude,
    longitude,
  }: AutocompletePlacesInput): Promise<PlaceSuggestion[]> {
    const bias =
      latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : DEFAULT_SEARCH_ORIGIN;

    return this.placesGateway.autocomplete({ input, sessionToken, bias });
  }
}
