import { AppError } from "../../../../shared/errors/AppError";
import type { ExportFormat, ExportScope } from "../entities/Report";

const SUPPORTED_FORMATS: Record<ExportScope, ExportFormat[]> = {
  general: ["csv", "pdf"],
  category: ["csv"],
  manifests: ["csv"],
  geospatial: ["geojson", "kml"],
};

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  geojson: "application/geo+json",
  kml: "application/vnd.google-earth.kml+xml",
};

const FILE_PREFIXES: Record<ExportScope, string> = {
  general: "relatorio-geral",
  category: "tabela-categorias",
  manifests: "manifestos",
  geospatial: "trilha-geoespacial",
};

export function assertCompatible(scope: ExportScope, format: ExportFormat): void {
  if (!SUPPORTED_FORMATS[scope].includes(format)) {
    throw new AppError(`Unsupported export format '${format}' for scope '${scope}'.`, 400);
  }
}

export function resolveExport(
  scope: ExportScope,
  format: ExportFormat,
  from: string,
  to: string,
): { contentType: string; filename: string } {
  assertCompatible(scope, format);

  const prefix =
    scope === "general" && format === "pdf" ? "relatorio-oficial" : FILE_PREFIXES[scope];

  return {
    contentType: CONTENT_TYPES[format],
    filename: `${prefix}-${from}-a-${to}.${format}`,
  };
}
