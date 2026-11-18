import type { PointRow, ReportFilter } from "../entities/Report";
import type { IReportRepository } from "../repositories/IReportRepository";
import { round } from "../rules/number-rules";
import { assertValidPeriod } from "../rules/period-rules";

export class GetPointDensityUseCase {
  constructor(private readonly repository: IReportRepository) {}

  async execute(filter: ReportFilter): Promise<{ rows: PointRow[]; totalWeightKg: number }> {
    assertValidPeriod(filter.from, filter.to);

    const aggregates = await this.repository.sumByPoint(filter);
    const details = await this.repository.findPointsByIds(
      aggregates.map((aggregate) => aggregate.collectionPointId),
    );
    const detailById = new Map(details.map((detail) => [detail.id, detail]));

    const totalWeightKg = aggregates.reduce((sum, aggregate) => sum + aggregate.weightKg, 0);

    const rows = aggregates.map((aggregate) => {
      const detail = detailById.get(aggregate.collectionPointId);

      return {
        collectionPointId: aggregate.collectionPointId,
        name: detail?.name ?? "Ponto de coleta",
        address: detail?.address ?? "",
        neighborhood: detail?.neighborhood ?? null,
        city: detail?.city ?? "",
        latitude: detail?.latitude ?? 0,
        longitude: detail?.longitude ?? 0,
        weightKg: round(aggregate.weightKg, 3),
        percentage: totalWeightKg > 0 ? round((aggregate.weightKg / totalWeightKg) * 100, 1) : 0,
      };
    });

    rows.sort((left, right) => right.weightKg - left.weightKg);

    return { rows, totalWeightKg: round(totalWeightKg, 3) };
  }
}
