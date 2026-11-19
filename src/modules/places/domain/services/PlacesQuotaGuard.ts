import { AppError } from "../../../../shared/errors/AppError";
import type { PlaceDetails, PlaceSuggestion } from "../entities/Place";
import type {
  AutocompleteParams,
  IPlacesGateway,
  PlaceDetailsParams,
} from "../gateways/IPlacesGateway";
import type { IPlacesUsageRepository, PlacesSku } from "../repositories/IPlacesUsageRepository";

// Days are counted in the product's time zone, so the quota resets at local midnight.
export const QUOTA_TIME_ZONE = "America/Sao_Paulo";

export const QUOTA_EXCEEDED_MESSAGE =
  "Limite diário da busca de endereços atingido. Tente novamente amanhã ou informe as coordenadas.";

export type PlacesDailyLimits = Record<PlacesSku, number>;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: QUOTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// en-CA formats as YYYY-MM-DD.
export function quotaDay(now: Date = new Date()): string {
  return dayFormatter.format(now);
}

/**
 * Wraps the Google gateway and refuses calls once the day's limit is reached, so the
 * monthly bill stays inside Google's free tier. The call is counted before reaching
 * Google (a failed call still counts), which errs on the side of spending less.
 */
export class PlacesQuotaGuard implements IPlacesGateway {
  constructor(
    private readonly gateway: IPlacesGateway,
    private readonly usageRepository: IPlacesUsageRepository,
    private readonly limits: PlacesDailyLimits,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async autocomplete(params: AutocompleteParams): Promise<PlaceSuggestion[]> {
    await this.consume("AUTOCOMPLETE");
    return this.gateway.autocomplete(params);
  }

  async getDetails(params: PlaceDetailsParams): Promise<PlaceDetails> {
    await this.consume("PLACE_DETAILS");
    return this.gateway.getDetails(params);
  }

  private async consume(sku: PlacesSku) {
    const allowed = await this.usageRepository.tryConsume(
      sku,
      quotaDay(this.now()),
      this.limits[sku],
    );

    if (!allowed) {
      console.warn(`[places] daily ${sku} limit (${this.limits[sku]}) reached; blocking calls`);
      throw new AppError(QUOTA_EXCEEDED_MESSAGE, 503);
    }
  }
}
