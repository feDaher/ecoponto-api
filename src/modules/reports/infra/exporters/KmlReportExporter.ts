import type { PointRow } from "../../domain/entities/Report";
import type { IKmlReportExporter } from "../../domain/repositories/IReportExporter";

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

export class KmlReportExporter implements IKmlReportExporter {
  build(points: PointRow[]): Buffer {
    const placemarks = points
      .map((point) =>
        [
          "    <Placemark>",
          `      <name>${escapeXml(point.name)}</name>`,
          `      <description>${escapeXml(`${point.address} - ${point.weightKg} kg`)}</description>`,
          "      <Point>",
          `        <coordinates>${point.longitude},${point.latitude},0</coordinates>`,
          "      </Point>",
          "    </Placemark>",
        ].join("\n"),
      )
      .join("\n");

    const kml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<kml xmlns="http://www.opengis.net/kml/2.2">',
      "  <Document>",
      "    <name>Trilha Geoespacial - EcoPonto</name>",
      placemarks,
      "  </Document>",
      "</kml>",
    ].join("\n");

    return Buffer.from(kml, "utf8");
  }
}
