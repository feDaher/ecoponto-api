jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import type { Prisma } from "../../src/generated/prisma/client";
import request from "supertest";
import { app } from "../../src/app";
import { CollectionPointStatus } from "../../src/generated/prisma/enums";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const MANHUACU = { latitude: -20.258, longitude: -42.0336 };
const MANHUACU_QUERY = { latitude: "-20.258", longitude: "-42.0336" };
const ACTIVE_CATEGORIES = ["PLASTIC", "PAPER", "GLASS", "BATTERIES", "TELEVISIONS"];

let sequence = 0;

function point(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return {
    id: `point-${sequence}`,
    collectorId: "user-collector",
    name: `Ponto ${sequence}`,
    description: null,
    city: "Manhuaçu",
    address: "Rua A, 10",
    latitude: MANHUACU.latitude,
    longitude: MANHUACU.longitude,
    locationSource: "GPS_COORDINATES",
    placeId: null,
    whatsappContact: "33999990000",
    showWhatsappContact: false,
    categories: [{ category: { name: "PLASTIC" } }],
    operatingHours: [],
    status: CollectionPointStatus.APPROVED,
    hoursConfirmedAt: new Date("2026-10-01T00:00:00Z"),
    isOutdated: false,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

const search = (query: Record<string, string | string[]> = {}) =>
  request(app).get("/collection-points").query(query);

const queryRaw = () => prisma["$queryRaw"] as unknown as jest.Mock;

const rankedQuery = () => queryRaw().mock.calls[0][0] as Prisma.Sql;
const countQuery = () => queryRaw().mock.calls.find(([sql]) => sql.sql.includes("COUNT(*)"))?.[0];

function stubSearch({
  ranked = [] as { id: string; distanceKm: number | null }[],
  total = ranked.length as number | bigint,
  hydrated = [] as ReturnType<typeof point>[],
} = {}) {
  queryRaw().mockImplementation(async (sql: Prisma.Sql) => {
    if (sql.sql.includes("COUNT(*)")) return [{ total }];
    if (sql.sql.includes("WHERE pc.pointId IN")) {
      return hydrated.flatMap(({ id, categories }) =>
        categories.map(({ category }) => ({ pointId: id, name: category.name })),
      );
    }
    return ranked;
  });
  prisma.collectionPoint.findMany.mockResolvedValue(hydrated);
}

beforeEach(() => {
  resetPrismaMock();
  sequence = 0;
  prisma.wasteCategory.findMany.mockImplementation(
    async ({ where }: { where: { name: { in: string[] } } }) =>
      where.name.in
        .filter((name) => ACTIVE_CATEGORIES.includes(name))
        .map((name) => ({ id: `cat-${name}`, name, active: true })),
  );
});

describe("GET /collection-points query validation", () => {
  it.each([
    ["latitude without longitude", { latitude: "-20.25" }],
    ["longitude without latitude", { longitude: "-42.03" }],
    ["radius without coordinates", { radius: "5" }],
    ["radius with only one coordinate", { radius: "5", latitude: "-20.25" }],
    ["zero radius", { ...MANHUACU_QUERY, radius: "0" }],
    ["radius above the maximum", { ...MANHUACU_QUERY, radius: "101" }],
    ["non numeric radius", { ...MANHUACU_QUERY, radius: "abc" }],
    ["exponent notation", { latitude: "1e1", longitude: "-42.03" }],
    ["latitude out of range", { latitude: "91", longitude: "-42.03" }],
    ["longitude out of range", { latitude: "-20.25", longitude: "181" }],
    ["zero limit", { limit: "0" }],
    ["limit above the maximum", { limit: "501" }],
    ["fractional limit", { limit: "1.5" }],
    ["repeated city", { city: ["Manhuaçu", "Ubá"] }],
    ["city that is too long", { city: "a".repeat(101) }],
  ])("returns 400 for %s without touching the database", async (_label, query) => {
    const response = await search(query);

    expect(response.status).toBe(400);
    expect(queryRaw()).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown waste type", "UNOBTAINIUM"],
    ["one unknown waste type among valid ones", "PLASTIC,UNOBTAINIUM"],
  ])("returns 400 for %s, checked against the catalog", async (_label, wasteType) => {
    const response = await search({ wasteType });

    expect(response.status).toBe(400);
    expect(prisma.wasteCategory.findMany).toHaveBeenCalled();
  });

  it("names the unknown or inactive waste types from the catalog", async () => {
    const response = await search({ wasteType: "PLASTIC,UNOBTAINIUM" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("UNOBTAINIUM");
    expect(response.body.message).not.toContain("PLASTIC");
  });

  it("rejects malformed waste type codes before querying the catalog", async () => {
    const response = await search({ wasteType: "PLASTIC;DROP" });

    expect(response.status).toBe(400);
    expect(prisma.wasteCategory.findMany).not.toHaveBeenCalled();
  });

  it("treats blank filters as absent", async () => {
    const response = await search({ city: " ", wasteType: "", latitude: "", radius: "" });

    expect(response.status).toBe(200);
    expect(rankedQuery().values).toEqual([CollectionPointStatus.APPROVED, 100]);
  });

  it("ignores unknown query parameters", async () => {
    const response = await search({ foo: "bar" });

    expect(response.status).toBe(200);
  });
});

describe("GET /collection-points filter composition", () => {
  it("only ever reads approved points, with no filters at all", async () => {
    await search();

    expect(rankedQuery().values).toEqual([CollectionPointStatus.APPROVED, 100]);
    expect(rankedQuery().sql).toContain("ORDER BY name");
    expect(rankedQuery().sql).not.toContain("BETWEEN");
  });

  it("combines city, waste type and radius in a single query", async () => {
    await search({ city: "Manhuaçu", wasteType: "GLASS", ...MANHUACU_QUERY, radius: "5" });

    const { sql, values } = rankedQuery();
    expect(sql).toContain("status = ?");
    expect(sql).toContain("city = ?");
    expect(sql).toContain("id IN (");
    expect(sql).toContain("SEMIJOIN(MATERIALIZATION)");
    expect(sql).toContain("FROM PointCategory pc");
    expect(sql).toContain("wc.active = TRUE");
    expect(sql).toContain("wc.name IN (?)");
    expect(sql).toContain("latitude BETWEEN ? AND ?");
    expect(sql).toContain("longitude BETWEEN ? AND ?");
    expect(sql).toContain("<= ?");
    expect(values).toEqual(
      expect.arrayContaining([CollectionPointStatus.APPROVED, "Manhuaçu", "GLASS", 5]),
    );
  });

  it("applies the same conditions to the page query and the count query", async () => {
    stubSearch({
      ranked: [{ id: "point-1", distanceKm: 1 }],
      total: 250,
      hydrated: [point({ id: "point-1" })],
    });

    await search({ city: "Manhuaçu", wasteType: "GLASS", limit: "1" });

    const conditions = (sql: Prisma.Sql) => sql.sql.slice(sql.sql.indexOf("WHERE"));
    expect(conditions(countQuery())).toBe(conditions(rankedQuery()).replace(/ ORDER BY.*/, ""));
    expect(countQuery().values).toEqual(["APPROVED", "Manhuaçu", "GLASS"]);
  });

  it("matches any of several waste types and ignores duplicates", async () => {
    await search({ wasteType: "PLASTIC, GLASS,PLASTIC" });

    const { sql, values } = rankedQuery();
    expect(sql.match(/FROM PointCategory pc/g)).toHaveLength(1);
    expect(sql).toMatch(/wc\.name IN \(\?,\s?\?\)/);
    expect(values.filter((value: unknown) => value === "PLASTIC")).toHaveLength(1);
    expect(values).toEqual(expect.arrayContaining(["PLASTIC", "GLASS"]));
  });

  it("bounds the query around the reference point by the radius", async () => {
    await search({ ...MANHUACU_QUERY, radius: "10" });

    const numbers = rankedQuery().values.filter(
      (value: unknown): value is number => typeof value === "number",
    );
    const latitudes = numbers.filter((value) => value > -20.4 && value < -20.1);
    expect(Math.min(...latitudes)).toBeLessThan(MANHUACU.latitude);
    expect(Math.max(...latitudes)).toBeGreaterThan(MANHUACU.latitude);
    expect(rankedQuery().values).toContain(10);
  });

  it("orders by distance, then name, when there is a reference point", async () => {
    await search({ ...MANHUACU_QUERY, radius: "5" });

    expect(rankedQuery().sql).toContain("ORDER BY distanceKm, name");
  });

  it("ranks without cutting off when there is a reference point but no radius", async () => {
    await search(MANHUACU_QUERY);

    expect(rankedQuery().sql).toContain("ORDER BY distanceKm, name");
    expect(rankedQuery().sql).not.toContain("BETWEEN");
    expect(rankedQuery().sql).not.toContain("<= ?");
  });

  it("uses the default limit and honors an explicit one", async () => {
    await search();
    await search({ limit: "25" });

    expect(queryRaw().mock.calls[0][0].values.at(-1)).toBe(100);
    expect(queryRaw().mock.calls[1][0].values.at(-1)).toBe(25);
  });
});

describe("GET /collection-points results", () => {
  it("returns an empty list without hydrating when nothing matches", async () => {
    const response = await search();

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(response.headers["x-total-count"]).toBe("0");
    expect(prisma.collectionPoint.findMany).not.toHaveBeenCalled();
  });

  it("hydrates only the ranked ids and never selects moderation details", async () => {
    stubSearch({
      ranked: [{ id: "point-a", distanceKm: null }],
      hydrated: [point({ id: "point-a" })],
    });

    await search();

    expect(prisma.collectionPoint.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["point-a"] } },
      omit: { rejectionReason: true, reviewedById: true, reviewedAt: true },
    });
  });

  it("keeps the ranking order regardless of the order the rows are hydrated in", async () => {
    stubSearch({
      ranked: [
        { id: "perto", distanceKm: 0.114 },
        { id: "meio", distanceKm: 2.5 },
        { id: "longe", distanceKm: 9.876 },
      ],
      hydrated: [
        point({ id: "longe", name: "Longe" }),
        point({ id: "perto", name: "Perto" }),
        point({ id: "meio", name: "Meio" }),
      ],
    });

    const response = await search({ ...MANHUACU_QUERY, radius: "10" });

    expect(response.body.map((item: { name: string }) => item.name)).toEqual([
      "Perto",
      "Meio",
      "Longe",
    ]);
    expect(response.body.map((item: { distanceKm: number }) => item.distanceKm)).toEqual([
      0.11, 2.5, 9.88,
    ]);
  });

  it("omits distanceKm when there is no reference point", async () => {
    stubSearch({
      ranked: [{ id: "point-a", distanceKm: null }],
      hydrated: [point({ id: "point-a" })],
    });

    const response = await search();

    expect(response.body[0]).not.toHaveProperty("distanceKm");
  });

  it("skips the count query when the page is not full", async () => {
    stubSearch({
      ranked: [{ id: "point-a", distanceKm: null }],
      total: 999,
      hydrated: [point({ id: "point-a" })],
    });

    const response = await search({ limit: "10" });

    expect(countQuery()).toBeUndefined();
    expect(response.headers["x-total-count"]).toBe("1");
  });

  it("reports the full match count when the page is full", async () => {
    stubSearch({
      ranked: [
        { id: "point-a", distanceKm: null },
        { id: "point-b", distanceKm: null },
      ],
      total: BigInt(42),
      hydrated: [point({ id: "point-a" }), point({ id: "point-b" })],
    });

    const response = await search({ limit: "2" });

    expect(response.body).toHaveLength(2);
    expect(response.headers["x-total-count"]).toBe("42");
  });

  it("ignores ranked ids that disappeared before hydration", async () => {
    stubSearch({
      ranked: [
        { id: "gone", distanceKm: null },
        { id: "point-a", distanceKm: null },
      ],
      hydrated: [point({ id: "point-a" })],
    });

    const response = await search();

    expect(response.body.map((item: { id: string }) => item.id)).toEqual(["point-a"]);
  });

  it("accepts distances returned as strings by the driver", async () => {
    stubSearch({
      ranked: [{ id: "point-a", distanceKm: "0.114" as unknown as number }],
      hydrated: [point({ id: "point-a" })],
    });

    const response = await search({ ...MANHUACU_QUERY, radius: "5" });

    expect(response.body[0].distanceKm).toBe(0.11);
  });

  it("serializes Decimal coordinates returned as strings", async () => {
    stubSearch({
      ranked: [{ id: "point-a", distanceKm: 0.1 }],
      hydrated: [point({ id: "point-a", latitude: "-20.25900000", longitude: "-42.03360000" })],
    });

    const response = await search({ ...MANHUACU_QUERY, radius: "5" });

    expect(response.status).toBe(200);
    expect(response.body[0].latitude).toBe("-20.25900000");
  });

  it("hides the WhatsApp number unless the collector opted in", async () => {
    stubSearch({
      ranked: [
        { id: "a", distanceKm: null },
        { id: "b", distanceKm: null },
      ],
      hydrated: [
        point({ id: "a", showWhatsappContact: false }),
        point({ id: "b", showWhatsappContact: true }),
      ],
    });

    const response = await search();

    expect(response.body[0].whatsappContact).toBeNull();
    expect(response.body[1].whatsappContact).toBe("33999990000");
  });

  it("exposes the total count header to browsers", async () => {
    const response = await request(app)
      .get("/collection-points")
      .set("Origin", "https://web.example.com");

    expect(response.headers["access-control-expose-headers"]).toContain("X-Total-Count");
  });
});
