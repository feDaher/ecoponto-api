import type { CategoryRow, ManifestRow, ReportBundle } from "../../domain/entities/Report";
import type { ICsvReportExporter } from "../../domain/repositories/IReportExporter";

const BOM = "\uFEFF";
const BRASILIA_OFFSET_HOURS = 3;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

export function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function ptNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(decimals).replace(".", ",");
}

export function ptPercent(value: number): string {
  return `${ptNumber(value, 1)}%`;
}

export function brTime(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getTime() - BRASILIA_OFFSET_HOURS * 60 * 60 * 1000);
}

export function ptDateTime(value: Date | string): string {
  const date = brTime(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function toCsv(rows: string[][]): Buffer {
  const lines = rows.map((row) => row.map(csvCell).join(";"));
  return Buffer.from(BOM + lines.join("\r\n"), "utf8");
}

const MANIFEST_HEADERS = [
  "Referência",
  "Data & Hora",
  "Ponto de Origem",
  "Categoria",
  "Peso (kg)",
  "Pontos",
  "Destinador Homologado",
  "Status",
];

export class CsvReportExporter implements ICsvReportExporter {
  buildGeneral(bundle: ReportBundle): Buffer {
    const { summary, filter } = bundle;

    const metadata: string[][] = [
      ["Relatório", "EcoPonto - Relatórios e Exportação de Dados"],
      ["Polo", "Manhuaçu - MG"],
      ["Período", `${filter.from} a ${filter.to}`],
      ["Volume total (kg)", ptNumber(summary.totals.weightKg, 3)],
      ["Descartes no período", String(summary.totals.disposals)],
      ["Pontos de gamificação", String(summary.totals.points)],
      ["CO₂ evitado (kg)", ptNumber(summary.co2.avoidedKg, 2)],
      ["Árvores equivalentes", String(summary.co2.treesSaved)],
      ["Postos ativos monitorados", String(summary.activePoints.total)],
      [
        "Variação vs. período anterior",
        summary.comparison.variationPercent === null
          ? "—"
          : ptPercent(summary.comparison.variationPercent),
      ],
      [],
    ];

    const rows = bundle.manifests.map((manifest) => [
      manifest.protocol,
      ptDateTime(manifest.disposedAt),
      manifest.collectionPointName,
      manifest.categoryDisplayName,
      ptNumber(manifest.weightKg, 3),
      String(manifest.pointsEarned),
      manifest.destinador ?? "",
      statusLabel(manifest.status),
    ]);

    return toCsv([...metadata, MANIFEST_HEADERS, ...rows]);
  }

  buildCategories(rows: CategoryRow[]): Buffer {
    const table = rows.map((row) => [
      row.displayName,
      row.destinador ?? "",
      String(row.disposals),
      ptNumber(row.weightKg, 3),
      ptPercent(row.percentage),
    ]);

    const totalWeightKg = rows.reduce((sum, row) => sum + row.weightKg, 0);
    const totalDisposals = rows.reduce((sum, row) => sum + row.disposals, 0);

    return toCsv([
      ["Categoria", "Destinador Homologado", "Descartes", "Peso (kg)", "Participação (%)"],
      ...table,
      ["TOTAL", "", String(totalDisposals), ptNumber(totalWeightKg, 3), ptPercent(100)],
    ]);
  }

  buildManifests(rows: ManifestRow[]): Buffer {
    const table = rows.map((manifest) => [
      manifest.protocol,
      ptDateTime(manifest.disposedAt),
      manifest.collectionPointName,
      manifest.categoryDisplayName,
      ptNumber(manifest.weightKg, 3),
      String(manifest.pointsEarned),
      manifest.destinador ?? "",
      statusLabel(manifest.status),
    ]);

    return toCsv([MANIFEST_HEADERS, ...table]);
  }
}
