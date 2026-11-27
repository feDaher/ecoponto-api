import type { Request, Response } from "express";
import { DisposalStatus, Role } from "../../../generated/prisma/enums";
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

// Data scope comes from the token, never from the query: an ADMIN sees the whole platform,
// a COLLECTOR only the disposals made at their own collection points.
function collectorScope(req: Request): string | undefined {
  return req.user!.role === Role.COLLECTOR ? req.user!.id : undefined;
}

function buildFilter(req: Request): ReportFilter {
  const query = req.query as unknown as ReportRequestQuery;
  const collectorId = collectorScope(req);
  return {
    from: query.from,
    to: query.to,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.region ? { region: query.region } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(collectorId ? { collectorId } : {}),
  };
}

export async function getSummary(req: Request, res: Response) {
  res.status(200).json(await summaryUseCase.execute(buildFilter(req)));
}

export async function getByCategory(req: Request, res: Response) {
  res.status(200).json(await categoryUseCase.execute(buildFilter(req)));
}

export async function getByPoint(req: Request, res: Response) {
  res.status(200).json(await pointUseCase.execute(buildFilter(req)));
}

export async function getManifests(req: Request, res: Response) {
  const query = req.query as unknown as { page: number; pageSize: number };
  const result = await manifestsUseCase.execute(buildFilter(req), query.page, query.pageSize);
  res.status(200).json(result);
}

export async function getFilterOptions(req: Request, res: Response) {
  res.status(200).json(await filterOptionsUseCase.execute(collectorScope(req)));
}

export async function exportReport(req: Request, res: Response) {
  const query = req.query as unknown as {
    scope: ExportScope;
    format: ExportFormat;
    page: number;
    pageSize: number;
  };

  const result = await exportUseCase.execute({
    filter: buildFilter(req),
    scope: query.scope,
    format: query.format,
    page: query.page,
    pageSize: query.pageSize,
  });

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.status(200).send(result.buffer);
}
