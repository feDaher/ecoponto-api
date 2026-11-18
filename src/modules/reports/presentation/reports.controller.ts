import type { Request, Response } from "express";
import { DisposalStatus } from "../../../generated/prisma/enums";
import type { ExportFormat, ExportScope, ReportFilter } from "../domain/entities/Report";
import { ExportReportUseCase } from "../domain/use-cases/ExportReportUseCase";
import { GetCategoryBreakdownUseCase } from "../domain/use-cases/GetCategoryBreakdownUseCase";
import { GetFilterOptionsUseCase } from "../domain/use-cases/GetFilterOptionsUseCase";
import { GetPointDensityUseCase } from "../domain/use-cases/GetPointDensityUseCase";
import { GetReportSummaryUseCase } from "../domain/use-cases/GetReportSummaryUseCase";
import { ListManifestsUseCase } from "../domain/use-cases/ListManifestsUseCase";
import { CsvReportExporter } from "../infra/exporters/CsvReportExporter";
import { GeoJsonReportExporter } from "../infra/exporters/GeoJsonReportExporter";
import { KmlReportExporter } from "../infra/exporters/KmlReportExporter";
import { PdfReportExporter } from "../infra/exporters/PdfReportExporter";
import { PrismaReportRepository } from "../infra/repositories/PrismaReportRepository";

const repository = new PrismaReportRepository();
const summaryUseCase = new GetReportSummaryUseCase(repository);
const categoryUseCase = new GetCategoryBreakdownUseCase(repository);
const pointUseCase = new GetPointDensityUseCase(repository);
const manifestsUseCase = new ListManifestsUseCase(repository);
const filterOptionsUseCase = new GetFilterOptionsUseCase(repository);
const exportUseCase = new ExportReportUseCase(
  summaryUseCase,
  categoryUseCase,
  pointUseCase,
  manifestsUseCase,
  {
    csv: new CsvReportExporter(),
    pdf: new PdfReportExporter(),
    geoJson: new GeoJsonReportExporter(),
    kml: new KmlReportExporter(),
  },
);

interface ReportRequestQuery {
  from: string;
  to: string;
  categoryId?: string;
  region?: string;
  status?: DisposalStatus;
  search?: string;
}

function buildFilter(query: ReportRequestQuery): ReportFilter {
  return {
    from: query.from,
    to: query.to,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.region ? { region: query.region } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { search: query.search } : {}),
  };
}

export async function getSummary(req: Request, res: Response) {
  const query = req.query as unknown as ReportRequestQuery;
  res.status(200).json(await summaryUseCase.execute(buildFilter(query)));
}

export async function getByCategory(req: Request, res: Response) {
  const query = req.query as unknown as ReportRequestQuery;
  res.status(200).json(await categoryUseCase.execute(buildFilter(query)));
}

export async function getByPoint(req: Request, res: Response) {
  const query = req.query as unknown as ReportRequestQuery;
  res.status(200).json(await pointUseCase.execute(buildFilter(query)));
}

export async function getManifests(req: Request, res: Response) {
  const query = req.query as unknown as ReportRequestQuery & { page: number; pageSize: number };
  const result = await manifestsUseCase.execute(buildFilter(query), query.page, query.pageSize);
  res.status(200).json(result);
}

export async function getFilterOptions(_req: Request, res: Response) {
  res.status(200).json(await filterOptionsUseCase.execute());
}

export async function exportReport(req: Request, res: Response) {
  const query = req.query as unknown as ReportRequestQuery & {
    scope: ExportScope;
    format: ExportFormat;
    page: number;
    pageSize: number;
  };

  const result = await exportUseCase.execute({
    filter: buildFilter(query),
    scope: query.scope,
    format: query.format,
    page: query.page,
    pageSize: query.pageSize,
  });

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.status(200).send(result.buffer);
}
