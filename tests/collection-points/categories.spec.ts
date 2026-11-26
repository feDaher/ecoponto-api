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

  it("updates category links on edit and returns the same code-list format", async () => {
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
    // Kept links are not recreated, so their reception settings (BE-19) survive the resubmission.
    expect(updateCall.data.categories).toEqual({
      deleteMany: { categoryId: { notIn: ["category-glass"] } },
      createMany: { data: [{ categoryId: "category-glass" }], skipDuplicates: true },
    });
  });

  it("only returns receiving categories in public search responses", async () => {
    prisma.wasteCategory.findMany.mockResolvedValue([activeCategories[0]]);
    const queryRaw = prisma["$queryRaw"] as unknown as jest.Mock;
    queryRaw.mockImplementation(async (sql: { sql: string }) =>
      sql.sql.includes("SELECT pc.pointId, wc.name")
        ? [{ pointId: "point-1", name: "PLASTIC" }]
        : [{ id: "point-1", distanceKm: null }],
    );
    const { categories: _categories, ...hydratedPoint } = pointWithCategories([]);
    prisma.collectionPoint.findMany.mockResolvedValue([hydratedPoint]);

    const response = await request(app).get("/collection-points?wasteType=PLASTIC");

    expect(response.status).toBe(200);
    expect(response.body[0].wasteCategories).toEqual(["PLASTIC"]);
    expect(response.body[0]).not.toHaveProperty("categories");
    const [ranked] = queryRaw.mock.calls[0];
    expect(ranked.sql).toContain("FROM PointCategory pc");
    expect(ranked.sql).toContain("wc.active = TRUE");
    expect(ranked.sql).toContain("pc.isAccepting = TRUE");
    expect(ranked.values).toContain("PLASTIC");
    const links = queryRaw.mock.calls.find(([sql]) =>
      sql.sql.includes("SELECT pc.pointId, wc.name"),
    )?.[0];
    expect(links.sql).toContain("pc.isAccepting = TRUE");
  });

  it("only returns receiving categories in public point details", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue({
      ...pointWithCategories(["PLASTIC"]),
      status: "APPROVED",
    });

    const response = await request(app).get("/collection-points/point-1");

    expect(response.status).toBe(200);
    expect(response.body.wasteCategories).toEqual(["PLASTIC"]);
    expect(prisma.collectionPoint.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          categories: expect.objectContaining({
            where: { isAccepting: true, approvalStatus: "APPROVED" },
          }),
        }),
      }),
    );
  });

  it("returns category codes for the pending admin list", async () => {
    prisma.collectionPoint.findMany.mockResolvedValue([pointWithCategories(["PLASTIC", "GLASS"])]);

    const response = await request(app)
      .get("/collection-points/admin/pending")
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body[0].wasteCategories).toEqual(["GLASS", "PLASTIC"]);
    expect(response.body[0]).not.toHaveProperty("categories");
  });

  it("returns category codes and per-category state for the mine list", async () => {
    prisma.collectionPoint.findMany.mockResolvedValue([
      {
        ...pointWithCategories(["PLASTIC", "GLASS"]),
        categories: [
          {
            categoryId: "category-plastic",
            approvalStatus: "APPROVED",
            isAccepting: true,
            capacityKg: null,
            category: { name: "PLASTIC" },
          },
          {
            categoryId: "category-glass",
            approvalStatus: "PENDING",
            isAccepting: false,
            capacityKg: null,
            category: { name: "GLASS" },
          },
        ],
      },
    ]);

    const response = await request(app).get("/collection-points/mine").set(bearer(Role.COLLECTOR));

    expect(response.status).toBe(200);
    expect(response.body[0].wasteCategories).toEqual(["GLASS", "PLASTIC"]);
    expect(response.body[0].categories).toEqual([
      {
        id: "category-glass",
        name: "GLASS",
        approvalStatus: "PENDING",
        isAccepting: false,
        capacityKg: null,
      },
      {
        id: "category-plastic",
        name: "PLASTIC",
        approvalStatus: "APPROVED",
        isAccepting: true,
        capacityKg: null,
      },
    ]);
  });

  it("rejects an inactive or unknown wasteType filter", async () => {
    prisma.wasteCategory.findMany.mockResolvedValue([]);

    const response = await request(app).get("/collection-points?wasteType=WOOD");

    expect(response.status).toBe(400);
    expect(prisma.collectionPoint.findMany).not.toHaveBeenCalled();
  });
});
