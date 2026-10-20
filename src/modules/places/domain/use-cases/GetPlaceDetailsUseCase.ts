import type { PlaceDetails } from "../entities/Place";
import type { IPlacesGateway, PlaceDetailsParams } from "../gateways/IPlacesGateway";

export class GetPlaceDetailsUseCase {
  constructor(private readonly placesGateway: IPlacesGateway) {}

  execute(params: PlaceDetailsParams): Promise<PlaceDetails> {
    return this.placesGateway.getDetails(params);
  }
}
