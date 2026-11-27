import type { IPlacesUsageRepository, PlacesSku } from "../repositories/IPlacesUsageRepository";
import { QUOTA_TIME_ZONE, quotaDay, type PlacesDailyLimits } from "../services/PlacesQuotaGuard";

export interface PlacesUsageReport {
  day: string;
  timeZone: string;
  usage: { sku: PlacesSku; used: number; limit: number; remaining: number }[];
}

export class GetPlacesUsageUseCase {
  constructor(
    private readonly usageRepository: IPlacesUsageRepository,
    private readonly limits: PlacesDailyLimits,
  ) {}

  async execute(now: Date = new Date()): Promise<PlacesUsageReport> {
    const day = quotaDay(now);
    const rows = await this.usageRepository.findByDay(day);

    const usage = (Object.keys(this.limits) as PlacesSku[]).map((sku) => {
      const used = rows.find((row) => row.sku === sku)?.count ?? 0;
      const limit = this.limits[sku];
      return { sku, used, limit, remaining: Math.max(limit - used, 0) };
    });

    return { day, timeZone: QUOTA_TIME_ZONE, usage };
  }
}
