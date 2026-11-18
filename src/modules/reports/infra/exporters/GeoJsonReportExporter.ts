import type { PointRow } from "../../domain/entities/Report";
import type { IGeoJsonReportExporter } from "../../domain/repositories/IReportExporter";

export class GeoJsonReportExporter implements IGeoJsonReportExporter {
  build(points: PointRow[]): Buffer {
    const featureCollection = {
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        },
        properties: {
          id: point.collectionPointId,
          name: point.name,
          address: point.address,
          neighborhood: point.neighborhood,
          city: point.city,
          weightKg: point.weightKg,
          percentage: point.percentage,
        },
      })),
    };

    return Buffer.from(JSON.stringify(featureCollection, null, 2), "utf8");
  }
}
