import type { Request, Response } from "express";
import { AutocompletePlacesUseCase } from "../domain/use-cases/AutocompletePlacesUseCase";
import { GetPlaceDetailsUseCase } from "../domain/use-cases/GetPlaceDetailsUseCase";
import { GetPlacesUsageUseCase } from "../domain/use-cases/GetPlacesUsageUseCase";
import { placesDailyLimits, placesGateway, placesUsageRepository } from "../infra/places-gateway";
import type { AutocompleteQuery, PlaceDetailsParams, PlaceDetailsQuery } from "./places.validators";

const autocompletePlacesUseCase = new AutocompletePlacesUseCase(placesGateway);
const getPlaceDetailsUseCase = new GetPlaceDetailsUseCase(placesGateway);
const getPlacesUsageUseCase = new GetPlacesUsageUseCase(placesUsageRepository, placesDailyLimits);

// The validate middleware has already replaced req.query/req.params with the parsed values.
export async function autocomplete(req: Request, res: Response) {
  const query = req.query as unknown as AutocompleteQuery;
  const suggestions = await autocompletePlacesUseCase.execute(query);

  // Google's terms do not allow caching Places content.
  res.set("Cache-Control", "no-store").status(200).json(suggestions);
}

export async function details(req: Request, res: Response) {
  const { placeId } = req.params as unknown as PlaceDetailsParams;
  const { sessionToken } = req.query as unknown as PlaceDetailsQuery;
  const place = await getPlaceDetailsUseCase.execute({ placeId, sessionToken });

  res.set("Cache-Control", "no-store").status(200).json(place);
}

export async function usage(_req: Request, res: Response) {
  const report = await getPlacesUsageUseCase.execute();
  res.status(200).json(report);
}
