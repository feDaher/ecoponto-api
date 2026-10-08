export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PlaceSuggestion {
  placeId: string;
  title: string;
  subtitle: string;
}

export interface PlaceDetails extends Coordinates {
  label: string;
  viewport?: {
    southWest: Coordinates;
    northEast: Coordinates;
  };
}
