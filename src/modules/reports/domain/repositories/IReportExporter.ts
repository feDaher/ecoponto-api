import type { CategoryRow, ManifestRow, PointRow, ReportBundle } from "../entities/Report";

export interface ICsvReportExporter {
  buildGeneral(bundle: ReportBundle): Buffer;
  buildCategories(rows: CategoryRow[]): Buffer;
  buildManifests(rows: ManifestRow[]): Buffer;
}

export interface IPdfReportExporter {
  buildGeneral(bundle: ReportBundle): Promise<Buffer>;
}

export interface IGeoJsonReportExporter {
  build(points: PointRow[]): Buffer;
}

export interface IKmlReportExporter {
  build(points: PointRow[]): Buffer;
}
