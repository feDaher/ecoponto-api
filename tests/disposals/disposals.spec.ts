jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const POINT_ID = "point-1";
const CATEGORY_ID = "category-plastic";
const DISPOSAL_ID = "disposal-1";
const CITIZEN_ID = users[Role.CITIZEN].id;
const COLLECTOR_ID = users[Role.COLLECTOR].id;

const DAY_MS = 24 * 60 * 60 * 1000;

const approvedPoint = { id: POINT_ID, collectorId: COLLECTOR_ID, status: "APPROVED" };

const disposalRow = (overrides: Record<string, unknown> = {}) => ({
  id: DISPOSAL_ID,
  citizenId: CITIZEN_ID,
  collectionPointId: POINT_ID,
  categoryId: CATEGORY_ID,
  collectionId: null,
  // Prisma returns Decimal; the repository only relies on toString().
  weightKg: { toString: () => "2.5" },
  pointsEarned: 0,
  status: "PENDING",
  disposedAt: new Date("2026-11-10T12:00:00.000Z"),
  createdAt: new Date("2026-11-10T12:00:00.000Z"),
  updatedAt: new Date("2026-11-10T12:00:00.000Z"),
  collectionPoint: {
    id: POINT_ID,
    name: "Ecoponto Centro",
    city: "Manhuaçu",
    address: "Rua A, 1",
    collectorId: COLLECTOR_ID,
  },
  category: { id: CATEGORY_ID, name: "PLASTIC" },
  citizen: { id: CITIZEN_ID, name: "Maria da Silva" },
  ...overrides,
});

function mockAcceptedCreation() {
  prisma.collectionPoint.findUnique.mockResolvedValue(approvedPoint);
  prisma.wasteCategory.findFirst.mockResolvedValue({ id: CATEGORY_ID, name: "PLASTIC" });
  prisma.pointCategory.findFirst.mockResolvedValue({ pointId: POINT_ID });
  prisma.disposalRecord.create.mockImplementation(async () => {
    const { citizen: _citizen, ...row } = disposalRow();
    return row;
  });
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("POST /disposals", () => {
  const body = { collectionPointId: POINT_ID, categoryId: CATEGORY_ID, weightKg: 2.5 };

  it("logs a PENDING disposal with 0 points for the authenticated citizen", async () => {
    mockAcceptedCreation();

    const response = await request(app).post("/disposals").set(bearer(Role.CITIZEN)).send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({ status: "PENDING", pointsEarned: 0, weightKg: 2.5 }),
    );
    expect(prisma.disposalRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          citizenId: CITIZEN_ID,
          collectionPointId: POINT_ID,
          categoryId: CATEGORY_ID,
          weightKg: 2.5,
        }),
      }),
    );
  });

  it("checks the category through PointCategory, active categories only", async () => {
    mockAcceptedCreation();

    await request(app).post("/disposals").set(bearer(Role.CITIZEN)).send(body);

    expect(prisma.pointCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pointId: POINT_ID, categoryId: CATEGORY_ID, category: { active: true } },
      }),
    );
  });

  it("never takes the citizen from the body", async () => {
    const response = await request(app)
      .post("/disposals")
      .set(bearer(Role.CITIZEN))
      .send({ ...body, citizenId: "someone-else" });

    expect(response.status).toBe(400);
    expect(prisma.disposalRecord.create).not.toHaveBeenCalled();
  });

  it("answers 404 for a point that is not approved", async () => {
    prisma.collectionPoint.findUnique.mockResolvedValue({ ...approvedPoint, status: "PENDING" });

    const response = await request(app).post("/disposals").set(bearer(Role.CITIZEN)).send(body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Collection point not found");
    expect(prisma.disposalRecord.create).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown or inactive category", async () => {
    prisma.collectionPoint.findUnique.mockResolvedValue(approvedPoint);

    const response = await request(app).post("/disposals").set(bearer(Role.CITIZEN)).send(body);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Waste category not found");
  });

  it("answers 422 when the point does not accept the category", async () => {
    prisma.collectionPoint.findUnique.mockResolvedValue(approvedPoint);
    prisma.wasteCategory.findFirst.mockResolvedValue({ id: CATEGORY_ID, name: "PLASTIC" });

    const response = await request(app).post("/disposals").set(bearer(Role.CITIZEN)).send(body);

    expect(response.status).toBe(422);
    expect(prisma.disposalRecord.create).not.toHaveBeenCalled();
  });

  it.each([
    ["in the future", new Date(Date.now() + DAY_MS)],
    ["more than 30 days in the past", new Date(Date.now() - 31 * DAY_MS)],
  ])("rejects a disposal date %s", async (_label, disposedAt) => {
    mockAcceptedCreation();

    const response = await request(app)
      .post("/disposals")
      .set(bearer(Role.CITIZEN))
      .send({ ...body, disposedAt: disposedAt.toISOString() });

    expect(response.status).toBe(400);
    expect(prisma.disposalRecord.create).not.toHaveBeenCalled();
  });

  it("accepts a disposal date within the last 30 days", async () => {
    mockAcceptedCreation();

    const response = await request(app)
      .post("/disposals")
      .set(bearer(Role.CITIZEN))
      .send({ ...body, disposedAt: new Date(Date.now() - 29 * DAY_MS).toISOString() });

    expect(response.status).toBe(201);
  });

  it.each([
    ["zero weight", { ...body, weightKg: 0 }],
    ["weight above the limit", { ...body, weightKg: 1001 }],
    ["weight as a string", { ...body, weightKg: "2" }],
  ])("rejects %s", async (_label, payload) => {
    const response = await request(app).post("/disposals").set(bearer(Role.CITIZEN)).send(payload);

    expect(response.status).toBe(400);
    expect(prisma.disposalRecord.create).not.toHaveBeenCalled();
  });

  it("does not let a collector log a disposal", async () => {
    const response = await request(app).post("/disposals").set(bearer(Role.COLLECTOR)).send(body);

    expect(response.status).toBe(403);
  });
});

describe("PATCH /disposals/:id/status", () => {
  it("confirms a pending disposal and credits 10 points per kg", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(disposalRow());
    prisma.disposalRecord.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ status: "CONFIRMED", pointsEarned: 25 }),
    );
    // Race-safe: only a row that is still PENDING can change.
    expect(prisma.disposalRecord.updateMany).toHaveBeenCalledWith({
      where: { id: DISPOSAL_ID, status: "PENDING" },
      data: { status: "CONFIRMED", pointsEarned: 25 },
    });
  });

  it("cancels with 0 points", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(disposalRow());
    prisma.disposalRecord.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "CANCELLED" });

    expect(response.status).toBe(200);
    expect(prisma.disposalRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED", pointsEarned: 0 } }),
    );
  });

  it("answers 409 for a disposal that is no longer pending", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(disposalRow({ status: "CONFIRMED" }));

    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(409);
    expect(prisma.disposalRecord.updateMany).not.toHaveBeenCalled();
  });

  it("answers 409 when a concurrent confirmation won the race", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(disposalRow());
    prisma.disposalRecord.updateMany.mockResolvedValue({ count: 0 });

    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(409);
  });

  it("forbids the collector of another point", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(
      disposalRow({
        collectionPoint: { ...disposalRow().collectionPoint, collectorId: "another-collector" },
      }),
    );

    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(403);
    expect(prisma.disposalRecord.updateMany).not.toHaveBeenCalled();
  });

  it("lets an admin moderate any disposal", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(disposalRow());
    prisma.disposalRecord.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.ADMIN))
      .send({ status: "CANCELLED" });

    expect(response.status).toBe(200);
  });

  it("does not accept going back to PENDING", async () => {
    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "PENDING" });

    expect(response.status).toBe(400);
  });

  it("answers 404 for an unknown disposal", async () => {
    const response = await request(app)
      .patch(`/disposals/${DISPOSAL_ID}/status`)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(404);
  });
});

describe("GET /disposals/:id", () => {
  it("shows the citizen their own disposal without the citizen block", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(disposalRow());

    const response = await request(app).get(`/disposals/${DISPOSAL_ID}`).set(bearer(Role.CITIZEN));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(DISPOSAL_ID);
    expect(response.body).not.toHaveProperty("citizen");
  });

  it("shows the point's collector who delivered it (name only)", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(disposalRow());

    const response = await request(app)
      .get(`/disposals/${DISPOSAL_ID}`)
      .set(bearer(Role.COLLECTOR));

    expect(response.status).toBe(200);
    expect(response.body.citizen).toEqual({ id: CITIZEN_ID, name: "Maria da Silva" });
  });

  it("answers 404 (not 403) to someone who may not see it", async () => {
    prisma.disposalRecord.findUnique.mockResolvedValue(
      disposalRow({
        citizenId: "another-citizen",
        collectionPoint: { ...disposalRow().collectionPoint, collectorId: "another-collector" },
      }),
    );

    for (const role of [Role.CITIZEN, Role.COLLECTOR]) {
      const response = await request(app).get(`/disposals/${DISPOSAL_ID}`).set(bearer(role));
      expect(response.status).toBe(404);
    }
  });
});

describe("listings and summary", () => {
  it("GET /disposals/me lists only the citizen's own records, paginated", async () => {
    prisma.disposalRecord.findMany.mockResolvedValue([disposalRow()]);
    prisma.disposalRecord.count.mockResolvedValue(21);

    const response = await request(app)
      .get("/disposals/me")
      .query({ page: 2, pageSize: 10, status: "CONFIRMED" })
      .set(bearer(Role.CITIZEN));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ page: 2, pageSize: 10, total: 21, totalPages: 3 }),
    );
    expect(prisma.disposalRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { citizenId: CITIZEN_ID, status: "CONFIRMED" },
        skip: 10,
        take: 10,
      }),
    );
  });

  it("GET /disposals/received lists what was delivered to the collector's points", async () => {
    const response = await request(app).get("/disposals/received").set(bearer(Role.COLLECTOR));

    expect(response.status).toBe(200);
    expect(prisma.disposalRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { collectionPoint: { collectorId: COLLECTOR_ID } } }),
    );
  });

  it("rejects an inverted date range", async () => {
    const response = await request(app)
      .get("/disposals/me")
      .query({ from: "2026-11-10", to: "2026-11-01" })
      .set(bearer(Role.CITIZEN));

    expect(response.status).toBe(400);
  });

  it("GET /disposals/me/summary totals only CONFIRMED disposals by category", async () => {
    prisma.disposalRecord.groupBy.mockResolvedValue([
      {
        categoryId: "c-paper",
        _sum: { weightKg: { toString: () => "1.5" }, pointsEarned: 15 },
        _count: { _all: 1 },
      },
      {
        categoryId: CATEGORY_ID,
        _sum: { weightKg: { toString: () => "4" }, pointsEarned: 40 },
        _count: { _all: 2 },
      },
    ]);
    prisma.wasteCategory.findMany.mockResolvedValue([
      { id: "c-paper", name: "PAPER" },
      { id: CATEGORY_ID, name: "PLASTIC" },
    ]);

    const response = await request(app).get("/disposals/me/summary").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totalDisposals: 3,
      totalWeightKg: 5.5,
      totalPoints: 55,
      byCategory: [
        { categoryId: CATEGORY_ID, categoryName: "PLASTIC", disposals: 2, weightKg: 4, points: 40 },
        { categoryId: "c-paper", categoryName: "PAPER", disposals: 1, weightKg: 1.5, points: 15 },
      ],
    });
    expect(prisma.disposalRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { citizenId: CITIZEN_ID, status: "CONFIRMED" } }),
    );
  });
});
