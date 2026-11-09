jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import express from "express";
import request from "supertest";
import { Role } from "../../src/generated/prisma/enums";
import { errorHandler } from "../../src/middlewares/error-handler.middleware";
import { reportsRoutes } from "../../src/modules/reports/presentation/reports.routes";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";
import {
  applyFilters,
  fixtureCategories,
  fixtureDisposals,
  fixturePoints,
  groupByCategory,
  groupByPoint,
} from "./fixtures";

const FROM = "2025-10-01";
const TO = "2025-10-31";
const PERIOD = `from=${FROM}&to=${TO}`;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(reportsRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  resetPrismaMock();
  installIdentities();

  prisma.wasteCategory.findMany.mockResolvedValue(fixtureCategories);
  prisma.collectionPoint.findMany.mockImplementation(async (args) => {
    if (args?.select?.city) return [{ city: "Manhuaçu" }, { city: "Governador Valadares" }];
    return fixturePoints;
  });
  prisma.collectionPoint.count.mockResolvedValue(18);

  prisma.disposalRecord.findMany.mockImplementation(async (args) => {
    const filtered = applyFilters(fixtureDisposals, args.where);
    const sorted = [...filtered].sort(
      (left, right) => right.disposedAt.getTime() - left.disposedAt.getTime(),
    );
    const start = args.skip ?? 0;
    const end = args.take === undefined ? undefined : start + args.take;
    return sorted.slice(start, end);
  });

  prisma.disposalRecord.count.mockImplementation(
    async (args) => applyFilters(fixtureDisposals, args.where).length,
  );

  prisma.disposalRecord.groupBy.mockImplementation(async (args) => {
    const filtered = applyFilters(fixtureDisposals, args.where);
    return args.by.includes("categoryId") ? groupByCategory(filtered) : groupByPoint(filtered);
  });
});

describe("GET /reports/summary", () => {
  it("returns the totals of the selected period and the previous period comparison", async () => {
    const response = await request(app).get(`/reports/summary?${PERIOD}`).set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({ disposals: 2, weightKg: 460.5, points: 160 });
    expect(response.body.comparison.previousFrom).toBe("2025-08-31");
    expect(response.body.comparison.previousTo).toBe("2025-09-30");
    expect(response.body.comparison.weightKg).toBe(160);
    expect(response.body.comparison.variationPercent).toBe(187.8);
    expect(response.body.co2).toEqual({ avoidedKg: 678.26, treesSaved: 48 });
    expect(response.body.activePoints.total).toBe(18);
  });

  it("ignores cancelled disposals by default and accepts an explicit status filter", async () => {
    const confirmed = await request(app).get(`/reports/summary?${PERIOD}`).set(bearer(Role.ADMIN));
    const cancelled = await request(app)
      .get(`/reports/summary?${PERIOD}&status=CANCELLED`)
      .set(bearer(Role.ADMIN));

    expect(confirmed.body.totals.disposals).toBe(2);
    expect(cancelled.body.totals).toEqual({ disposals: 1, weightKg: 50, points: 10 });
  });

  it("filters the period by region", async () => {
    const response = await request(app)
      .get(`/reports/summary?${PERIOD}&region=Governador%20Valadares`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({ disposals: 0, weightKg: 0, points: 0 });
    expect(response.body.comparison.variationPercent).toBeNull();
  });

  it("does not break when the aggregation returns no groups", async () => {
    prisma.disposalRecord.groupBy.mockResolvedValue({});

    const response = await request(app).get(`/reports/summary?${PERIOD}`).set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({ disposals: 0, weightKg: 0, points: 0 });
    expect(response.body.rows).toBeUndefined();
  });
});

describe("GET /reports/by-category", () => {
  it("breaks the volume down by category with the participation percentage", async () => {
    const response = await request(app)
      .get(`/reports/by-category?${PERIOD}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.totalWeightKg).toBe(460.5);
    expect(response.body.rows).toHaveLength(2);

    const [batteries, paper] = response.body.rows;
    expect(batteries.name).toBe("BATTERIES");
    expect(batteries.displayName).toBe("Baterias, Células de Lítio & Pilhas");
    expect(batteries.destinador).toBe("CicloLimpo Reversa");
    expect(batteries.weightKg).toBe(340.5);
    expect(batteries.percentage).toBe(73.9);
    expect(paper.name).toBe("PAPER");
    expect(paper.weightKg).toBe(120);
    expect(paper.percentage).toBe(26.1);

    const summed = response.body.rows.reduce(
      (total: number, row: { weightKg: number }) => total + row.weightKg,
      0,
    );
    expect(summed).toBe(response.body.totalWeightKg);
  });
});

describe("GET /reports/by-point", () => {
  it("returns the density per collection point with coordinates", async () => {
    const response = await request(app).get(`/reports/by-point?${PERIOD}`).set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.rows).toHaveLength(2);
    expect(response.body.rows[0].name).toBe("EcoPonto Central");
    expect(response.body.rows[0].weightKg).toBe(340.5);
    expect(response.body.rows[0].percentage).toBe(73.9);
    expect(response.body.rows[0].latitude).toBe(-20.5583);
    expect(response.body.rows[1].name).toBe("Drogaria Pacheco");
    expect(response.body.rows[1].weightKg).toBe(120);
  });
});

describe("GET /reports/manifests", () => {
  it("paginates the traceability records of the period", async () => {
    const firstPage = await request(app)
      .get(`/reports/manifests?${PERIOD}&pageSize=1`)
      .set(bearer(Role.ADMIN));
    const secondPage = await request(app)
      .get(`/reports/manifests?${PERIOD}&pageSize=1&page=2`)
      .set(bearer(Role.ADMIN));

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.total).toBe(2);
    expect(firstPage.body.totalPages).toBe(2);
    expect(firstPage.body.page).toBe(1);
    expect(firstPage.body.pageSize).toBe(1);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.items[0].protocol).toBe("MAN-COL-4");
    expect(secondPage.body.items[0].protocol).toBe("MAN-COL-1");
  });

  it("searches by the homologated destination of the category", async () => {
    const response = await request(app)
      .get(`/reports/manifests?${PERIOD}&search=CicloLimpo`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].protocol).toBe("MAN-COL-1");
    expect(response.body.items[0].destinador).toBe("CicloLimpo Reversa");
  });

  it("returns an empty page when the search matches nothing", async () => {
    const response = await request(app)
      .get(`/reports/manifests?${PERIOD}&search=DestinadorInexistente`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(response.body.items).toEqual([]);
  });
});

describe("GET /reports/filter-options", () => {
  it("returns the options available for the filters", async () => {
    const response = await request(app).get("/reports/filter-options").set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.categories).toEqual([
      {
        id: "cat-batteries",
        name: "BATTERIES",
        displayName: "Baterias, Células de Lítio & Pilhas",
      },
      { id: "cat-paper", name: "PAPER", displayName: "Papéis e Papelão" },
    ]);
    expect(response.body.regions).toEqual(["Governador Valadares", "Manhuaçu"]);
    expect(response.body.statuses).toHaveLength(3);
  });
});

describe("GET /reports/export", () => {
  it("exports only the records inside the requested period (acceptance criterion)", async () => {
    const response = await request(app)
      .get(`/reports/export?scope=manifests&format=csv&${PERIOD}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="manifestos-${FROM}-a-${TO}.csv"`,
    );

    const csv = response.text;
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("MAN-COL-1");
    expect(csv).toContain("MAN-COL-4");
    expect(csv).not.toContain("MAN-COL-2");
    expect(csv).not.toContain("MAN-COL-3");
    expect(csv).not.toContain("MAN-COL-5");
    expect(csv).toContain("340,500");
    expect(csv).toContain("120,000");
  });

  it("exports the general report with the indicators of the period", async () => {
    const response = await request(app)
      .get(`/reports/export?scope=general&format=csv&${PERIOD}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.text).toContain('"Volume total (kg)"');
    expect(response.text).toContain('"460,500"');
    expect(response.text).toContain('"Postos ativos monitorados"');
  });

  it("exports the official report as PDF", async () => {
    const response = await request(app)
      .get(`/reports/export?scope=general&format=pdf&${PERIOD}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="relatorio-oficial-${FROM}-a-${TO}.pdf"`,
    );
  });

  it("exports the geospatial trail as GeoJSON", async () => {
    const response = await request(app)
      .get(`/reports/export?scope=geospatial&format=geojson&${PERIOD}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/geo+json");

    const payload = JSON.parse(response.text ?? JSON.stringify(response.body));
    expect(payload.type).toBe("FeatureCollection");
    expect(payload.features).toHaveLength(2);
    expect(payload.features[0].geometry.coordinates).toEqual([-42.8975, -20.5583]);
  });

  it("exports the geospatial trail as KML", async () => {
    const response = await request(app)
      .get(`/reports/export?scope=geospatial&format=kml&${PERIOD}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("kml");
    expect(response.text).toContain("<Placemark>");
    expect(response.text).toContain("EcoPonto Central");
  });

  it("rejects a format that is not compatible with the scope", async () => {
    const response = await request(app)
      .get(`/reports/export?scope=general&format=geojson&${PERIOD}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Unsupported export format 'geojson' for scope 'general'.");
  });
});

describe("report period validation", () => {
  it("rejects a period that ends before it starts", async () => {
    const response = await request(app)
      .get("/reports/summary?from=2025-10-31&to=2025-10-01")
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid report period: 'from' must be on or before 'to'.");
  });

  it("rejects a period longer than 366 days", async () => {
    const response = await request(app)
      .get("/reports/summary?from=2024-01-01&to=2025-12-31")
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Report period cannot exceed 366 days.");
  });

  it("rejects a malformed date", async () => {
    const response = await request(app)
      .get("/reports/summary?from=01-10-2025&to=2025-10-31")
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("date must be formatted as YYYY-MM-DD");
  });
});

describe("report access control", () => {
  it("allows the admin and the collector", async () => {
    const admin = await request(app).get(`/reports/summary?${PERIOD}`).set(bearer(Role.ADMIN));
    const collector = await request(app)
      .get(`/reports/summary?${PERIOD}`)
      .set(bearer(Role.COLLECTOR));

    expect(admin.status).toBe(200);
    expect(collector.status).toBe(200);
  });

  it("rejects the citizen with 403", async () => {
    const response = await request(app).get(`/reports/summary?${PERIOD}`).set(bearer(Role.CITIZEN));

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("You do not have permission to access this resource");
  });

  it("rejects a request without a token with 401", async () => {
    const response = await request(app).get(`/reports/summary?${PERIOD}`);

    expect(response.status).toBe(401);
  });
});
