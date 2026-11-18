import type { ExportFormat, ExportScope, ReportBundle, ReportFilter } from "../entities/Report";
import type {
  ICsvReportExporter,
  IGeoJsonReportExporter,
  IKmlReportExporter,
  IPdfReportExporter,
} from "../repositories/IReportExporter";
import { assertCompatible, resolveExport } from "../rules/export-policy";
import type { GetCategoryBreakdownUseCase } from "./GetCategoryBreakdownUseCase";
import type { GetPointDensityUseCase } from "./GetPointDensityUseCase";
import type { GetReportSummaryUseCase } from "./GetReportSummaryUseCase";
import type { ListManifestsUseCase } from "./ListManifestsUseCase";

const GENERAL_MANIFEST_ROWS = 50;

export interface ExportReportInput {
  filter: ReportFilter;
  scope: ExportScope;
  format: ExportFormat;
  page: number;
  pageSize: number;
}

export interface ExportReportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export interface ReportExporters {
  csv: ICsvReportExporter;
  pdf: IPdfReportExporter;
  geoJson: IGeoJsonReportExporter;
  kml: IKmlReportExporter;
}

export class ExportReportUseCase {
  constructor(
    private readonly summaryUseCase: GetReportSummaryUseCase,
    private readonly categoryUseCase: GetCategoryBreakdownUseCase,
    private readonly pointUseCase: GetPointDensityUseCase,
    private readonly manifestsUseCase: ListManifestsUseCase,
    private readonly exporters: ReportExporters,
  ) {}

  async execute(input: ExportReportInput): Promise<ExportReportResult> {
    assertCompatible(input.scope, input.format);
    const { contentType, filename } = resolveExport(
      input.scope,
      input.format,
      input.filter.from,
      input.filter.to,
    );

    if (input.scope === "geospatial") {
      const { rows } = await this.pointUseCase.execute(input.filter);
      const buffer =
        input.format === "geojson"
          ? this.exporters.geoJson.build(rows)
          : this.exporters.kml.build(rows);
      return { buffer, contentType, filename };
    }

    if (input.scope === "category") {
      const { rows } = await this.categoryUseCase.execute(input.filter);
      return { buffer: this.exporters.csv.buildCategories(rows), contentType, filename };
    }

    if (input.scope === "manifests") {
      const { items } = await this.manifestsUseCase.execute(
        input.filter,
        input.page,
        input.pageSize,
      );
      return { buffer: this.exporters.csv.buildManifests(items), contentType, filename };
    }

    const bundle = await this.buildBundle(input.filter);
    const buffer =
      input.format === "csv"
        ? this.exporters.csv.buildGeneral(bundle)
        : await this.exporters.pdf.buildGeneral(bundle);

    return { buffer, contentType, filename };
  }

  private async buildBundle(filter: ReportFilter): Promise<ReportBundle> {
    const [summary, categories, points, manifests] = await Promise.all([
      this.summaryUseCase.execute(filter),
      this.categoryUseCase.execute(filter),
      this.pointUseCase.execute(filter),
      this.manifestsUseCase.execute(filter, 1, GENERAL_MANIFEST_ROWS),
    ]);

    return {
      filter,
      summary,
      categories: categories.rows,
      points: points.rows,
      manifests: manifests.items,
      manifestTotal: manifests.total,
    };
  }
}
