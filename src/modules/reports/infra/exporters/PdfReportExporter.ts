import PDFDocument from "pdfkit";
import type {
  CategoryRow,
  ManifestRow,
  PointRow,
  ReportBundle,
} from "../../domain/entities/Report";
import type { IPdfReportExporter } from "../../domain/repositories/IReportExporter";
import { ptDateTime, ptNumber, ptPercent, statusLabel } from "./CsvReportExporter";

type PdfDocument = InstanceType<typeof PDFDocument>;

const PAGE_WIDTH = 515;
const FOOTER_Y = 800;

export class PdfReportExporter implements IPdfReportExporter {
  buildGeneral(bundle: ReportBundle): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
        info: { Title: "EcoPonto - Relatorios de Descarte" },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.writeHeader(doc, bundle);
      this.writeSummary(doc, bundle);
      this.writeCategories(doc, bundle.categories);
      this.writePoints(doc, bundle.points);
      this.writeManifests(doc, bundle.manifests, bundle.manifestTotal);

      const range = doc.bufferedPageRange();
      for (let index = 0; index < range.count; index += 1) {
        doc.switchToPage(range.start + index);
        this.writeFooter(doc, index + 1, range.count);
      }

      doc.end();
    });
  }

  private writeHeader(doc: PdfDocument, bundle: ReportBundle): void {
    doc.font("Helvetica-Bold").fontSize(16).text("Relatórios e Exportação de Dados", 40, 40);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#555555")
      .text("EcoPonto Digital - Polo Regional Manhuaçu - MG", 40, 64)
      .text(
        `Módulo de Auditoria & ESG - Conformidade SINIR & PNRS - Período ${bundle.filter.from} a ${bundle.filter.to}`,
        40,
        78,
      );
    doc.moveDown(2);
  }

  private writeSummary(doc: PdfDocument, bundle: ReportBundle): void {
    const { summary } = bundle;
    const variation =
      summary.comparison.variationPercent === null
        ? "—"
        : ptPercent(summary.comparison.variationPercent);

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000000").text("Indicadores do período");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10).fillColor("#222222");
    doc.text(`Volume descartado: ${ptNumber(summary.totals.weightKg, 3)} kg`);
    doc.text(`Descartes no período: ${summary.totals.disposals}`);
    doc.text(`CO2 evitado (estimativa): ${ptNumber(summary.co2.avoidedKg, 2)} kg`);
    doc.text(`Árvores equivalentes: ${summary.co2.treesSaved}`);
    doc.text(`Postos ativos monitorados: ${summary.activePoints.total}`);
    doc.text(`Variação vs. período anterior (${summary.comparison.previousFrom}): ${variation}`);
    doc.moveDown(1);
  }

  private writeCategories(doc: PdfDocument, rows: CategoryRow[]): void {
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#000000")
      .text("Fracionamento gravimétrico - por categoria");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    if (rows.length === 0) {
      doc.text("Sem descartes no período.");
      doc.moveDown(1);
      return;
    }

    for (const row of rows) {
      const destinador = row.destinador ?? "—";
      doc
        .fillColor("#222222")
        .text(
          `${row.displayName} - ${ptNumber(row.weightKg, 3)} kg (${ptPercent(row.percentage)}) - ${destinador}`,
        );
    }

    doc.moveDown(1);
  }

  private writePoints(doc: PdfDocument, rows: PointRow[]): void {
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#000000")
      .text("Mapeamento territorial - por ponto de coleta");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    if (rows.length === 0) {
      doc.text("Sem descartes no período.");
      doc.moveDown(1);
      return;
    }

    for (const row of rows) {
      doc
        .fillColor("#222222")
        .text(
          `${row.name} - ${row.address} - ${ptNumber(row.weightKg, 3)} kg (${ptPercent(row.percentage)})`,
        );
    }

    doc.moveDown(1);
  }

  private writeManifests(doc: PdfDocument, rows: ManifestRow[], total: number): void {
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#000000")
      .text("Rastreabilidade - registros do período");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(8);

    if (rows.length === 0) {
      doc.fontSize(9).text("Sem descartes no período.");
      doc.moveDown(1);
      return;
    }

    for (const row of rows) {
      doc
        .fillColor("#222222")
        .text(
          `${row.protocol} | ${ptDateTime(row.disposedAt)} | ${row.collectionPointName} | ${row.categoryDisplayName} | ${ptNumber(row.weightKg, 3)} kg | ${statusLabel(row.status)}`,
        );
    }

    if (total > rows.length) {
      doc.fillColor("#555555").text(`Mostrando ${rows.length} de ${total} registros.`);
    }

    doc.moveDown(1);
  }

  private writeFooter(doc: PdfDocument, page: number, total: number): void {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text("Auditado conforme NBR 16156:2013", 40, FOOTER_Y, { width: PAGE_WIDTH })
      .text(`Página ${page} de ${total}`, 40, FOOTER_Y, { width: PAGE_WIDTH, align: "right" });
  }
}
