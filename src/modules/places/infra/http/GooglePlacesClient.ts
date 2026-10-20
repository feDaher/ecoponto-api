import { z } from "zod";
import { AppError } from "../../../../shared/errors/AppError";
import type { PlaceDetails, PlaceSuggestion } from "../../domain/entities/Place";
import type {
  AutocompleteParams,
  IPlacesGateway,
  PlaceDetailsParams,
} from "../../domain/gateways/IPlacesGateway";

const PLACES_API_URL = "https://places.googleapis.com/v1";
const REQUEST_TIMEOUT_MS = 5_000;
const LOCATION_BIAS_RADIUS_METERS = 30_000;
const LANGUAGE_CODE = "pt-BR";
const REGION_CODE = "br";

const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat",
].join(",");
const DETAILS_FIELD_MASK = "location,viewport,formattedAddress";

const UNAVAILABLE_MESSAGE = "Busca de endereços indisponível no momento";

// Google's responses are untrusted input too: validate the shape before using it.
const latLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const textSchema = z.object({ text: z.string() });

const autocompleteResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string().min(1),
            text: textSchema.optional(),
            structuredFormat: z
              .object({ mainText: textSchema, secondaryText: textSchema.optional() })
              .optional(),
          })
          .optional(),
      }),
    )
    .default([]),
});

const detailsResponseSchema = z.object({
  formattedAddress: z.string().default(""),
  location: latLngSchema,
  viewport: z.object({ low: latLngSchema, high: latLngSchema }).optional(),
});

interface RequestOptions {
  method: "GET" | "POST";
  fieldMask: string;
  body?: unknown;
  // Google answers 400/404 for an unknown or malformed place id.
  clientErrorAsNotFound?: boolean;
}

export class GooglePlacesClient implements IPlacesGateway {
  constructor(private readonly apiKey: string | undefined) {}

  async autocomplete({
    input,
    sessionToken,
    bias,
  }: AutocompleteParams): Promise<PlaceSuggestion[]> {
    const data = await this.request("/places:autocomplete", {
      method: "POST",
      fieldMask: AUTOCOMPLETE_FIELD_MASK,
      body: {
        input,
        sessionToken,
        languageCode: LANGUAGE_CODE,
        regionCode: REGION_CODE,
        includedRegionCodes: [REGION_CODE],
        locationBias: { circle: { center: bias, radius: LOCATION_BIAS_RADIUS_METERS } },
      },
    });

    const parsed = this.parse(autocompleteResponseSchema, data);

    return parsed.suggestions.flatMap(({ placePrediction }) => {
      if (!placePrediction) return [];

      const title = placePrediction.structuredFormat?.mainText.text ?? placePrediction.text?.text;
      if (!title) return [];

      return [
        {
          placeId: placePrediction.placeId,
          title,
          subtitle: placePrediction.structuredFormat?.secondaryText?.text ?? "",
        },
      ];
    });
  }

  async getDetails({ placeId, sessionToken }: PlaceDetailsParams): Promise<PlaceDetails> {
    const query = new URLSearchParams({ languageCode: LANGUAGE_CODE, regionCode: REGION_CODE });
    if (sessionToken) query.set("sessionToken", sessionToken);

    const data = await this.request(`/places/${encodeURIComponent(placeId)}?${query}`, {
      method: "GET",
      fieldMask: DETAILS_FIELD_MASK,
      clientErrorAsNotFound: true,
    });

    const { formattedAddress, location, viewport } = this.parse(detailsResponseSchema, data);

    return {
      label: formattedAddress,
      latitude: location.latitude,
      longitude: location.longitude,
      ...(viewport && { viewport: { southWest: viewport.low, northEast: viewport.high } }),
    };
  }

  private async request(path: string, options: RequestOptions): Promise<unknown> {
    if (!this.apiKey) {
      throw new AppError(UNAVAILABLE_MESSAGE, 503);
    }

    let response: Response;
    try {
      response = await fetch(`${PLACES_API_URL}${path}`, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          // Header instead of ?key= so the key never shows up in URLs or proxy logs.
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": options.fieldMask,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "error",
      });
    } catch (error) {
      console.error("[places] Google Places request failed:", (error as Error).name);
      throw new AppError(UNAVAILABLE_MESSAGE, 503);
    }

    if (!response.ok) {
      const googleStatus = await this.readErrorStatus(response);
      console.error(`[places] Google Places responded ${response.status} ${googleStatus}`);

      if (options.clientErrorAsNotFound && (response.status === 400 || response.status === 404)) {
        throw new AppError("Local não encontrado", 404);
      }
      throw new AppError(UNAVAILABLE_MESSAGE, response.status === 429 ? 503 : 502);
    }

    try {
      return await response.json();
    } catch {
      console.error("[places] Google Places returned a non-JSON body");
      throw new AppError(UNAVAILABLE_MESSAGE, 502);
    }
  }

  private parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
    const result = schema.safeParse(data);
    if (!result.success) {
      console.error("[places] Unexpected Google Places response shape");
      throw new AppError(UNAVAILABLE_MESSAGE, 502);
    }
    return result.data;
  }

  // Only the machine-readable status is logged; the message may echo request data.
  private async readErrorStatus(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { error?: { status?: unknown } };
      return typeof body.error?.status === "string" ? body.error.status : "UNKNOWN";
    } catch {
      return "UNKNOWN";
    }
  }
}
