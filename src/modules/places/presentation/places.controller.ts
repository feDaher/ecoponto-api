import type { Request, Response } from "express";
import { env } from "../../../config/env";
import { AutocompletePlacesUseCase } from "../domain/use-cases/AutocompletePlacesUseCase";
import { GetPlaceDetailsUseCase } from "../domain/use-cases/GetPlaceDetailsUseCase";
import { GooglePlacesClient } from "../infra/http/GooglePlacesClient";
import type { AutocompleteQuery, PlaceDetailsParams, PlaceDetailsQuery } from "./places.validators";

const placesGateway = new GooglePlacesClient(env.GOOGLE_MAPS_API_KEY);
const autocompletePlacesUseCase = new AutocompletePlacesUseCase(placesGateway);
const getPlaceDetailsUseCase = new GetPlaceDetailsUseCase(placesGateway);

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
