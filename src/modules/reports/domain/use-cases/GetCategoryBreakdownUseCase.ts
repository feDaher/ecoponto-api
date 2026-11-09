import { enrich } from "../catalog/CategoryCatalog";
import type { CategoryRow, ReportFilter } from "../entities/Report";
import type { IReportRepository } from "../repositories/IReportRepository";
import { round } from "../rules/number-rules";
import { assertValidPeriod } from "../rules/period-rules";

export class GetCategoryBreakdownUseCase {
  constructor(private readonly repository: IReportRepository) {}

  async execute(filter: ReportFilter): Promise<{ rows: CategoryRow[]; totalWeightKg: number }> {
    assertValidPeriod(filter.from, filter.to);

    const [categories, aggregates] = await Promise.all([
      this.repository.listCategories(),
      this.repository.sumByCategory(filter),
    ]);

    const nameByCategoryId = new Map(categories.map((category) => [category.id, category.name]));
    const totalWeightKg = aggregates.reduce((sum, aggregate) => sum + aggregate.weightKg, 0);

    const rows = aggregates.map((aggregate) => {
      const code = nameByCategoryId.get(aggregate.categoryId) ?? "";
      const enrichment = enrich(code);

      return {
        categoryId: aggregate.categoryId,
        name: code,
        displayName: enrichment.displayName,
        destinador: enrichment.destinador,
        disposals: aggregate.disposals,
        weightKg: round(aggregate.weightKg, 3),
        percentage: totalWeightKg > 0 ? round((aggregate.weightKg / totalWeightKg) * 100, 1) : 0,
      };
    });

    rows.sort((left, right) => right.weightKg - left.weightKg);

    return { rows, totalWeightKg: round(totalWeightKg, 3) };
  }
}
