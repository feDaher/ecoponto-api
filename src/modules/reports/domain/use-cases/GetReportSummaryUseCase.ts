import type { ReportFilter, ReportSummary, UsersSummary } from "../entities/Report";
import type { IReportRepository } from "../repositories/IReportRepository";
import { calculateCo2ForRows } from "../rules/co2-rules";
import { round } from "../rules/number-rules";
import { assertValidPeriod, previousPeriod, toUtcRange } from "../rules/period-rules";

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
    // Like activePoints, the user counts ignore the disposal filters (region, category, status)
    // but follow the data scope: platform-wide for an ADMIN, own points for a COLLECTOR.
    const [activePoints, users] = await Promise.all([
      this.repository.countActivePoints(filter.collectorId),
      this.summarizeUsers(filter),
    ]);

    const { collectorId: _scope, ...requestFilter } = filter;

    return {
      filter: requestFilter,
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
      activePoints: { total: activePoints },
      users,
    };
  }

  private async summarizeUsers(filter: ReportFilter): Promise<UsersSummary> {
    const period = toUtcRange(filter.from, filter.to);

    if (filter.collectorId) {
      const reach = await this.repository.countCitizensAtCollector(
        filter.collectorId,
        period.gte,
        period.lt,
      );
      return { scope: "collector", ...reach };
    }

    const [total, newInPeriod] = await Promise.all([
      this.repository.countUsers(),
      this.repository.countNewUsers(period.gte, period.lt),
    ]);
    return { scope: "platform", total, newInPeriod };
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
