jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const POINT_ID = "point-1";
const OTHER_COLLECTOR_ID = "user-other-collector";

const plastic = { id: "cat-plastic", name: "PLASTIC", active: true };
const glass = { id: "cat-glass", name: "GLASS", active: true };

const link = (
  categoryId: string,
  name: string,
  approvalStatus: "APPROVED" | "PENDING",
  settings: { isAccepting?: boolean; capacityKg?: { toNumber(): number } | null } = {},
) => ({
  pointId: POINT_ID,
  categoryId,
  approvalStatus,
  isAccepting: settings.isAccepting ?? true,
  capacityKg: settings.capacityKg ?? null,
  category: { name },
});

function givenPoint(ownerId: string, links: ReturnType<typeof link>[]) {
  prisma.collectionPoint.findUnique.mockResolvedValue({
    id: POINT_ID,
    collectorId: ownerId,
    status: "APPROVED",
  });
  prisma.pointCategory.findMany.mockResolvedValue(links);
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  // Interactive transactions run against the same mocked client.
  prisma.$transaction.mockImplementation(async (work: unknown) =>
    typeof work === "function" ? work(prisma) : Promise.all(work as Promise<unknown>[]),
  );
});

describe("PUT /collection-points/:id/categories", () => {
  it("removes a category right away and does not resubmit the point", async () => {
    givenPoint(users[Role.COLLECTOR].id, [
      link(plastic.id, "PLASTIC", "APPROVED"),
      link(glass.id, "GLASS", "APPROVED"),
    ]);
    prisma.wasteCategory.findMany.mockResolvedValue([plastic]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.COLLECTOR))
      .send({ wasteCategories: ["PLASTIC"] });

    expect(response.status).toBe(200);
    expect(prisma.pointCategory.deleteMany).toHaveBeenCalledWith({
      where: { pointId: POINT_ID, categoryId: { in: [glass.id] } },
    });
    expect(prisma.collectionPoint.update).not.toHaveBeenCalled();
  });

  it("adds a category as PENDING without touching the point status", async () => {
    givenPoint(users[Role.COLLECTOR].id, [link(plastic.id, "PLASTIC", "APPROVED")]);
    prisma.wasteCategory.findMany.mockResolvedValue([plastic, glass]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.COLLECTOR))
      .send({ wasteCategories: ["PLASTIC", "GLASS"] });

    expect(response.status).toBe(200);
    expect(prisma.pointCategory.createMany).toHaveBeenCalledWith({
      data: [{ pointId: POINT_ID, categoryId: glass.id, approvalStatus: "PENDING" }],
      skipDuplicates: true,
    });
    expect(prisma.collectionPoint.update).not.toHaveBeenCalled();
    expect(prisma.pointCategoryReview.createMany).not.toHaveBeenCalled();
  });

  it("adds a category as APPROVED when the admin adds it and logs the decision", async () => {
    givenPoint(OTHER_COLLECTOR_ID, [link(plastic.id, "PLASTIC", "APPROVED")]);
    prisma.wasteCategory.findMany.mockResolvedValue([plastic, glass]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.ADMIN))
      .send({ wasteCategories: ["PLASTIC", "GLASS"] });

    expect(response.status).toBe(200);
    expect(prisma.pointCategory.createMany).toHaveBeenCalledWith({
      data: [{ pointId: POINT_ID, categoryId: glass.id, approvalStatus: "APPROVED" }],
      skipDuplicates: true,
    });
    expect(prisma.pointCategoryReview.createMany).toHaveBeenCalledWith({
      data: [
        {
          pointId: POINT_ID,
          categoryId: glass.id,
          decision: "APPROVED",
          reviewedById: users[Role.ADMIN].id,
        },
      ],
    });
  });

  it("returns each link's material settings, so a paused category is not shown as receiving", async () => {
    givenPoint(users[Role.COLLECTOR].id, [
      link(plastic.id, "PLASTIC", "APPROVED", {
        isAccepting: false,
        capacityKg: { toNumber: () => 120.25 },
      }),
    ]);
    prisma.wasteCategory.findMany.mockResolvedValue([plastic]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.COLLECTOR))
      .send({ wasteCategories: ["PLASTIC"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        pointId: POINT_ID,
        categoryId: plastic.id,
        categoryName: "PLASTIC",
        approvalStatus: "APPROVED",
        isAccepting: false,
        capacityKg: 120.25,
      },
    ]);
  });

  it("answers 422 when the point would be left without an approved category", async () => {
    givenPoint(users[Role.COLLECTOR].id, [link(plastic.id, "PLASTIC", "APPROVED")]);
    prisma.wasteCategory.findMany.mockResolvedValue([glass]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.COLLECTOR))
      .send({ wasteCategories: ["GLASS"] });

    expect(response.status).toBe(422);
    expect(prisma.pointCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("answers 403 to a collector that does not own the point", async () => {
    givenPoint(OTHER_COLLECTOR_ID, [link(plastic.id, "PLASTIC", "APPROVED")]);
    prisma.wasteCategory.findMany.mockResolvedValue([plastic]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.COLLECTOR))
      .send({ wasteCategories: ["PLASTIC"] });

    expect(response.status).toBe(403);
    expect(prisma.pointCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("lets an administrator change any point", async () => {
    givenPoint(OTHER_COLLECTOR_ID, [
      link(plastic.id, "PLASTIC", "APPROVED"),
      link(glass.id, "GLASS", "APPROVED"),
    ]);
    prisma.wasteCategory.findMany.mockResolvedValue([plastic]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.ADMIN))
      .send({ wasteCategories: ["PLASTIC"] });

    expect(response.status).toBe(200);
  });

  it("answers 400 for unknown or inactive categories", async () => {
    givenPoint(users[Role.COLLECTOR].id, [link(plastic.id, "PLASTIC", "APPROVED")]);
    prisma.wasteCategory.findMany.mockResolvedValue([]);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.COLLECTOR))
      .send({ wasteCategories: ["UNKNOWN"] });

    expect(response.status).toBe(400);
  });

  it.each([
    ["an empty list", { wasteCategories: [] }],
    ["repeated codes", { wasteCategories: ["PLASTIC", "PLASTIC"] }],
    ["a missing body field", {}],
    ["unknown body fields", { wasteCategories: ["PLASTIC"], status: "APPROVED" }],
  ])("answers 400 for %s", async (_label, body) => {
    const response = await request(app)
      .put(`/collection-points/${POINT_ID}/categories`)
      .set(bearer(Role.COLLECTOR))
      .send(body);

    expect(response.status).toBe(400);
    expect(prisma.pointCategory.deleteMany).not.toHaveBeenCalled();
  });
});

describe("GET /collection-points/admin/pending-categories", () => {
  it("lists the categories awaiting approval for an administrator", async () => {
    prisma.pointCategory.findMany.mockResolvedValue([
      {
        pointId: POINT_ID,
        categoryId: glass.id,
        approvalStatus: "PENDING",
        point: { name: "Eco Ponto" },
        category: { name: "GLASS" },
      },
    ]);

    const response = await request(app)
      .get("/collection-points/admin/pending-categories")
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { pointId: POINT_ID, pointName: "Eco Ponto", categoryId: glass.id, categoryName: "GLASS" },
    ]);
  });
});

describe("PATCH /collection-points/:id/categories/:categoryId/review", () => {
  const url = `/collection-points/${POINT_ID}/categories/${glass.id}/review`;

  it("approves a pending category", async () => {
    prisma.pointCategory.findMany.mockResolvedValue([link(glass.id, "GLASS", "PENDING")]);
    prisma.pointCategory.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch(url)
      .set(bearer(Role.ADMIN))
      .send({ status: "APPROVED" });

    expect(response.status).toBe(204);
    expect(prisma.pointCategory.updateMany).toHaveBeenCalledWith({
      where: { pointId: POINT_ID, categoryId: glass.id, approvalStatus: "PENDING" },
      data: { approvalStatus: "APPROVED" },
    });
    expect(prisma.pointCategoryReview.create).toHaveBeenCalledWith({
      data: {
        pointId: POINT_ID,
        categoryId: glass.id,
        decision: "APPROVED",
        reason: null,
        reviewedById: users[Role.ADMIN].id,
      },
    });
  });

  it("rejects a pending category by removing the link", async () => {
    prisma.pointCategory.findMany.mockResolvedValue([link(glass.id, "GLASS", "PENDING")]);
    prisma.pointCategory.deleteMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch(url)
      .set(bearer(Role.ADMIN))
      .send({ status: "REJECTED", rejectionReason: "Não aceitamos vidro" });

    expect(response.status).toBe(204);
    expect(prisma.pointCategory.deleteMany).toHaveBeenCalledWith({
      where: { pointId: POINT_ID, categoryId: glass.id, approvalStatus: "PENDING" },
    });
    // The link is gone, so the reason must survive in the review history.
    expect(prisma.pointCategoryReview.create).toHaveBeenCalledWith({
      data: {
        pointId: POINT_ID,
        categoryId: glass.id,
        decision: "REJECTED",
        reason: "Não aceitamos vidro",
        reviewedById: users[Role.ADMIN].id,
      },
    });
  });

  it("answers 409 when another admin reviewed the category first", async () => {
    prisma.pointCategory.findMany.mockResolvedValue([link(glass.id, "GLASS", "PENDING")]);
    prisma.pointCategory.updateMany.mockResolvedValue({ count: 0 });

    const response = await request(app)
      .patch(url)
      .set(bearer(Role.ADMIN))
      .send({ status: "APPROVED" });

    expect(response.status).toBe(409);
    expect(prisma.pointCategoryReview.create).not.toHaveBeenCalled();
  });

  it("rejects an oversized rejection reason", async () => {
    const response = await request(app)
      .patch(url)
      .set(bearer(Role.ADMIN))
      .send({ status: "REJECTED", rejectionReason: "x".repeat(501) });

    expect(response.status).toBe(400);
    expect(prisma.pointCategory.findMany).not.toHaveBeenCalled();
  });

  it("requires a reason to reject", async () => {
    const response = await request(app)
      .patch(url)
      .set(bearer(Role.ADMIN))
      .send({ status: "REJECTED" });

    expect(response.status).toBe(400);
    expect(prisma.pointCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("answers 404 when the category is not linked to the point", async () => {
    prisma.pointCategory.findMany.mockResolvedValue([]);

    const response = await request(app)
      .patch(url)
      .set(bearer(Role.ADMIN))
      .send({ status: "APPROVED" });

    expect(response.status).toBe(404);
  });

  it("answers 409 when the category is already approved", async () => {
    prisma.pointCategory.findMany.mockResolvedValue([link(glass.id, "GLASS", "APPROVED")]);

    const response = await request(app)
      .patch(url)
      .set(bearer(Role.ADMIN))
      .send({ status: "APPROVED" });

    expect(response.status).toBe(409);
  });

  it("answers 403 to a collector", async () => {
    const response = await request(app)
      .patch(url)
      .set(bearer(Role.COLLECTOR))
      .send({ status: "APPROVED" });

    expect(response.status).toBe(403);
    expect(prisma.pointCategory.updateMany).not.toHaveBeenCalled();
  });
});

describe("GET /collection-points/:id/categories/reviews", () => {
  const url = `/collection-points/${POINT_ID}/categories/reviews`;
  const history = [
    {
      id: "rev-2",
      pointId: POINT_ID,
      categoryId: glass.id,
      decision: "REJECTED",
      reason: "Não aceitamos vidro",
      reviewedById: users[Role.ADMIN].id,
      reviewedAt: new Date("2026-11-20T12:00:00.000Z"),
      category: { name: "GLASS" },
      reviewedBy: { id: users[Role.ADMIN].id, name: "Admin" },
    },
  ];

  it("shows the owner the decision and the reason, but not who decided", async () => {
    givenPoint(users[Role.COLLECTOR].id, []);
    prisma.pointCategoryReview.findMany.mockResolvedValue(history);

    const response = await request(app).get(url).set(bearer(Role.COLLECTOR));

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: "rev-2",
        categoryId: glass.id,
        categoryName: "GLASS",
        decision: "REJECTED",
        reason: "Não aceitamos vidro",
        reviewedAt: "2026-11-20T12:00:00.000Z",
        reviewedBy: null,
      },
    ]);
    expect(prisma.pointCategoryReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pointId: POINT_ID },
        orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
        take: 100,
      }),
    );
  });

  it("shows the admin who decided", async () => {
    givenPoint(OTHER_COLLECTOR_ID, []);
    prisma.pointCategoryReview.findMany.mockResolvedValue(history);

    const response = await request(app).get(url).set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body[0].reviewedBy).toEqual({ id: users[Role.ADMIN].id, name: "Admin" });
  });

  it("answers 403 to another collector and to a citizen", async () => {
    givenPoint(OTHER_COLLECTOR_ID, []);

    const collector = await request(app).get(url).set(bearer(Role.COLLECTOR));
    const citizen = await request(app).get(url).set(bearer(Role.CITIZEN));

    expect(collector.status).toBe(403);
    expect(citizen.status).toBe(403);
    expect(prisma.pointCategoryReview.findMany).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown point", async () => {
    prisma.collectionPoint.findUnique.mockResolvedValue(null);

    const response = await request(app).get(url).set(bearer(Role.ADMIN));

    expect(response.status).toBe(404);
  });
});
