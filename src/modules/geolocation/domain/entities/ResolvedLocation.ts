import type { LocationSource } from "../../../../generated/prisma/enums";

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  source: LocationSource;
  placeId: string | null;
}
