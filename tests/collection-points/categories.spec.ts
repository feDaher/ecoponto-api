jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const activeCategories = [
  { id: "category-plastic", name: "PLASTIC", active: true },
  { id: "category-glass", name: "GLASS", active: true },
];

const pointEditBody = {
  name: "Eco Ponto Centro",
  city: "Manhuaçu",
  address: "Rua A, 10",
  latitude: -20.258,
  longitude: -42.0336,
  wasteCategories: ["PLASTIC", "GLASS"],
};

const pointBody = {
  ...pointEditBody,
  operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
};

function pointWithCategories(names: string[]) {
  return {
    id: "point-1",
    name: pointBody.name,
    city: pointBody.city,
    address: pointBody.address,
    latitude: pointBody.latitude,
    longitude: pointBody.longitude,
    showWhatsappContact: false,
    categories: names.map((name) => ({ category: { name } })),
    hours: [],
  };
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("collection point category persistence", () => {
  it("creates PointCategory links from active codes and keeps the API response shape", async () => {
    prisma.wasteCategory.findMany.mockResolvedValue(activeCategories);
    prisma.collectionPoint.create.mockResolvedValue(pointWithCategories(["PLASTIC", "GLASS"]));

    const response = await request(app)
      .post("/collection-points")
      .set(bearer(Role.COLLECTOR))
      .send(pointBody);

    expect(response.status).toBe(201);
    expect(response.body.wasteCategories).toEqual(["GLASS", "PLASTIC"]);
    expect(response.body).not.toHaveProperty("categories");

    const createCall = prisma.collectionPoint.create.mock.calls[0][0];
    expect(createCall.data).not.toHaveProperty("wasteCategories");
    expect(createCall.data.categories).toEqual({
      create: [
        { category: { connect: { id: "category-plastic" } } },
        { category: { connect: { id: "category-glass" } } },
      ],
    });
  });

  it("accepts active categories created through the existing category module", async () => {
    const wood = { id: "category-wood", name: "WOOD", active: true };
    prisma.wasteCategory.findMany.mockResolvedValue([wood]);
    prisma.collectionPoint.create.mockResolvedValue(pointWithCategories(["WOOD"]));

    const response = await request(app)
      .post("/collection-points")
      .set(bearer(Role.COLLECTOR))
      .send({ ...pointBody, wasteCategories: ["WOOD"] });

    expect(response.status).toBe(201);
    expect(response.body.wasteCategories).toEqual(["WOOD"]);
    expect(prisma.collectionPoint.create.mock.calls[0][0].data.categories).toEqual({
      create: [{ category: { connect: { id: wood.id } } }],
    });
  });

  it.each([
    ["unknown", [activeCategories[0]], ["PLASTIC", "WOOD"]],
    ["inactive", [], ["PLASTIC"]],
  ])("rejects %s codes without creating the point", async (_label, available, codes) => {
    prisma.wasteCategory.findMany.mockResolvedValue(available);

    const response = await request(app)
      .post("/collection-points")
      .set(bearer(Role.COLLECTOR))
      .send({ ...pointBody, wasteCategories: codes });

    expect(response.status).toBe(400);
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate category codes before querying or writing", async () => {
    const response = await request(app)
      .post("/collection-points")
      .set(bearer(Role.COLLECTOR))
      .send({ ...pointBody, wasteCategories: ["PLASTIC", " PLASTIC "] });

    expect(response.status).toBe(400);
    expect(prisma.wasteCategory.findMany).not.toHaveBeenCalled();
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });

  it("replaces category links on edit and returns the same code-list format", async () => {
    prisma.collectionPoint.findUnique.mockResolvedValue({
      id: "point-1",
      collectorId: users[Role.COLLECTOR].id,
    });
    prisma.wasteCategory.findMany.mockResolvedValue([activeCategories[1]]);
    prisma.collectionPoint.update.mockResolvedValue(pointWithCategories(["GLASS"]));

    const response = await request(app)
      .put("/collection-points/point-1")
      .set(bearer(Role.COLLECTOR))
      .send({ ...pointEditBody, wasteCategories: ["GLASS"] });

    expect(response.status).toBe(200);
    expect(response.body.wasteCategories).toEqual(["GLASS"]);

    const updateCall = prisma.collectionPoint.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("wasteCategories");
    expect(updateCall.data.categories).toEqual({
      deleteMany: {},
      create: [{ category: { connect: { id: "category-glass" } } }],
    });
  });

  it("filters public search through PointCategory and serializes codes", async () => {
    prisma.wasteCategory.findMany.mockResolvedValue([activeCategories[0]]);
    const queryRaw = prisma["$queryRaw"] as unknown as jest.Mock;
    queryRaw.mockImplementation(async (sql: { sql: string }) =>
      sql.sql.includes("WHERE pc.pointId IN")
        ? [
            { pointId: "point-1", name: "PLASTIC" },
            { pointId: "point-1", name: "GLASS" },
          ]
        : [{ id: "point-1", distanceKm: null }],
    );
    const { categories: _categories, ...hydratedPoint } = pointWithCategories([]);
    prisma.collectionPoint.findMany.mockResolvedValue([hydratedPoint]);

    const response = await request(app).get("/collection-points?wasteType=PLASTIC");

    expect(response.status).toBe(200);
    expect(response.body[0].wasteCategories).toEqual(["GLASS", "PLASTIC"]);
    expect(response.body[0]).not.toHaveProperty("categories");
    const [ranked] = queryRaw.mock.calls[0];
    expect(ranked.sql).toContain("FROM PointCategory pc");
    expect(ranked.sql).toContain("wc.active = TRUE");
    expect(ranked.values).toContain("PLASTIC");
  });

  it.each([
    ["mine", Role.COLLECTOR, "/collection-points/mine"],
    ["pending admin", Role.ADMIN, "/collection-points/admin/pending"],
  ])("returns category codes for the %s list", async (_label, role, path) => {
    prisma.collectionPoint.findMany.mockResolvedValue([pointWithCategories(["PLASTIC", "GLASS"])]);

    const response = await request(app).get(path).set(bearer(role));

    expect(response.status).toBe(200);
    expect(response.body[0].wasteCategories).toEqual(["GLASS", "PLASTIC"]);
    expect(response.body[0]).not.toHaveProperty("categories");
  });

  it("rejects an inactive or unknown wasteType filter", async () => {
    prisma.wasteCategory.findMany.mockResolvedValue([]);

    const response = await request(app).get("/collection-points?wasteType=WOOD");

    expect(response.status).toBe(400);
    expect(prisma.collectionPoint.findMany).not.toHaveBeenCalled();
  });
});
