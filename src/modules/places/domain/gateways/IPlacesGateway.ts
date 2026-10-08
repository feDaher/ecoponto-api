import type { Coordinates, PlaceDetails, PlaceSuggestion } from "../entities/Place";

export interface AutocompleteParams {
  input: string;
  sessionToken?: string;
  bias: Coordinates;
}

export interface PlaceDetailsParams {
  placeId: string;
  sessionToken?: string;
}

export interface IPlacesGateway {
  autocomplete(params: AutocompleteParams): Promise<PlaceSuggestion[]>;
  getDetails(params: PlaceDetailsParams): Promise<PlaceDetails>;
}
