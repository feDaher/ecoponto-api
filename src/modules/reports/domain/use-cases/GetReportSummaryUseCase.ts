import type { ReportFilter, ReportSummary } from "../entities/Report";
import type { IReportRepository } from "../repositories/IReportRepository";
import { calculateCo2ForRows } from "../rules/co2-rules";
import { round } from "../rules/number-rules";
import { assertValidPeriod, previousPeriod } from "../rules/period-rules";

export class GetReportSummaryUseCase {
  constructor(private readonly repository: IReportRepository) {}

  async execute(filter: ReportFilter): Promise<ReportSummary> {
    assertValidPeriod(filter.from, filter.to);

    const categories = await this.repository.listCategories();
    const nameByCategoryId = new Map(categories.map((category) => [category.id, category.name]));

    const current = await this.summarize(filter, nameByCategoryId);
    const previous = previousPeriod(filter.from, filter.to);
    const previousTotals = await this.summarize(
      { ...filter, from: previous.from, to: previous.to },
      nameByCategoryId,
    );

    return {
      filter,
      totals: current.totals,
      comparison: {
        previousFrom: previous.from,
        previousTo: previous.to,
        weightKg: previousTotals.totals.weightKg,
        variationPercent:
          previousTotals.totals.weightKg > 0
            ? round(
                ((current.totals.weightKg - previousTotals.totals.weightKg) /
                  previousTotals.totals.weightKg) *
                  100,
                1,
              )
            : null,
      },
      co2: current.co2,
      activePoints: { total: await this.repository.countActivePoints() },
    };
  }

  private async summarize(
    filter: ReportFilter,
    nameByCategoryId: Map<string, string>,
  ): Promise<{ totals: ReportSummary["totals"]; co2: ReportSummary["co2"] }> {
    const aggregates = await this.repository.sumByCategory(filter);

    const totals = aggregates.reduce(
      (accumulator, aggregate) => ({
        disposals: accumulator.disposals + aggregate.disposals,
        weightKg: accumulator.weightKg + aggregate.weightKg,
        points: accumulator.points + aggregate.points,
      }),
      { disposals: 0, weightKg: 0, points: 0 },
    );

    const co2 = calculateCo2ForRows(
      aggregates.map((aggregate) => ({
        weightKg: aggregate.weightKg,
        categoryCode: nameByCategoryId.get(aggregate.categoryId) ?? "",
      })),
    );

    return {
      totals: {
        disposals: totals.disposals,
        weightKg: round(totals.weightKg, 3),
        points: totals.points,
      },
      co2,
    };
  }
}
