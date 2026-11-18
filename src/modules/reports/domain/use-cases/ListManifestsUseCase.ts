import { enrich, matchesDestinador } from "../catalog/CategoryCatalog";
import type { DisposalRaw, ManifestRow, Paged, ReportFilter } from "../entities/Report";
import type { IReportRepository } from "../repositories/IReportRepository";
import { round } from "../rules/number-rules";
import { assertValidPeriod } from "../rules/period-rules";

export class ListManifestsUseCase {
  constructor(private readonly repository: IReportRepository) {}

  async execute(filter: ReportFilter, page = 1, pageSize = 5): Promise<Paged<ManifestRow>> {
    assertValidPeriod(filter.from, filter.to);

    const categoryIds = await this.resolveCategoryIds(filter.search);
    const total = await this.repository.countDisposals(filter, categoryIds);
    const disposals = await this.repository.findDisposals(filter, {
      skip: (page - 1) * pageSize,
      take: pageSize,
      categoryIds,
    });

    return {
      items: disposals.map((disposal) => this.toManifestRow(disposal)),
      page,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    };
  }

  private async resolveCategoryIds(search?: string): Promise<string[] | undefined> {
    if (!search) return undefined;

    const categories = await this.repository.listCategories();
    return categories
      .filter((category) => matchesDestinador(category.name, search))
      .map((category) => category.id);
  }

  private toManifestRow(disposal: DisposalRaw): ManifestRow {
    const enrichment = enrich(disposal.categoryName);
    const reference = disposal.collectionId
      ? `MAN-${disposal.collectionId.slice(0, 8).toUpperCase()}`
      : `DR-${disposal.id.slice(0, 8).toUpperCase()}`;

    return {
      protocol: reference,
      disposedAt: disposal.disposedAt.toISOString(),
      collectionPointName: disposal.collectionPointName,
      categoryName: disposal.categoryName,
      categoryDisplayName: enrichment.displayName,
      weightKg: round(disposal.weightKg, 3),
      pointsEarned: disposal.pointsEarned,
      destinador: enrichment.destinador,
      status: disposal.status,
    };
  }
}
