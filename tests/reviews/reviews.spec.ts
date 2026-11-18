jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const POINT_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_ID = "22222222-2222-4222-8222-222222222222";
const CITIZEN_ID = "33333333-3333-4333-8333-333333333333";

const moderationRow = (isHidden: boolean) => ({
  id: REVIEW_ID,
  rating: 2,
  comment: "Atendimento ruim",
  isHidden,
  createdAt: new Date("2026-11-10T12:00:00.000Z"),
  updatedAt: new Date("2026-11-10T12:00:00.000Z"),
  citizen: { id: CITIZEN_ID, name: "Maria da Silva" },
  collectionPoint: { id: POINT_ID, name: "Ecoponto Centro" },
});

const flushAudit = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("GET /collection-points/:id/reviews (public)", () => {
  it("lists only visible reviews of an approved point, without login", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue({ id: POINT_ID });
    prisma.review.findMany.mockResolvedValue([
      {
        id: REVIEW_ID,
        rating: 5,
        comment: "Ótimo",
        createdAt: new Date("2026-11-10T12:00:00.000Z"),
        citizen: { name: "  Maria da Silva " },
      },
    ]);
    prisma.review.count.mockResolvedValue(1);

    const response = await request(app).get(`/collection-points/${POINT_ID}/reviews`);

    expect(response.status).toBe(200);
    expect(response.headers["x-total-count"]).toBe("1");
    // LGPD: só o primeiro nome, sem id/nome completo do cidadão.
    expect(response.body).toEqual([
      {
        id: REVIEW_ID,
        rating: 5,
        comment: "Ótimo",
        authorName: "Maria",
        createdAt: "2026-11-10T12:00:00.000Z",
      },
    ]);
    expect(prisma.collectionPoint.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: POINT_ID, status: "APPROVED" } }),
    );
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collectionPointId: POINT_ID, isHidden: false },
        take: 20,
        skip: 0,
      }),
    );
    expect(prisma.review.count).toHaveBeenCalledWith({
      where: { collectionPointId: POINT_ID, isHidden: false },
    });
  });

  it("answers 404 for a point that is not approved (or does not exist)", async () => {
    const response = await request(app).get(`/collection-points/${POINT_ID}/reviews`);

    expect(response.status).toBe(404);
    expect(prisma.review.findMany).not.toHaveBeenCalled();
  });

  it("paginates with limit and offset", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue({ id: POINT_ID });

    const response = await request(app)
      .get(`/collection-points/${POINT_ID}/reviews`)
      .query({ limit: 5, offset: 10 });

    expect(response.status).toBe(200);
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 10 }),
    );
  });

  it.each([
    ["a non-uuid point id", "/collection-points/abc/reviews"],
    ["limit above 100", `/collection-points/${POINT_ID}/reviews?limit=101`],
    ["a negative offset", `/collection-points/${POINT_ID}/reviews?offset=-1`],
    ["an unknown parameter", `/collection-points/${POINT_ID}/reviews?isHidden=true`],
  ])("rejects %s with 400", async (_label, url) => {
    const response = await request(app).get(url);

    expect(response.status).toBe(400);
    expect(prisma.review.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /admin/reviews (moderation)", () => {
  it("lists every review, hidden ones included, with author and point", async () => {
    prisma.review.findMany.mockResolvedValue([moderationRow(true)]);
    prisma.review.count.mockResolvedValue(1);

    const response = await request(app).get("/admin/reviews").set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.headers["x-total-count"]).toBe("1");
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        id: REVIEW_ID,
        isHidden: true,
        author: { id: CITIZEN_ID, name: "Maria da Silva" },
        collectionPoint: { id: POINT_ID, name: "Ecoponto Centro" },
      }),
    );
    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it.each([
    ["hidden", { isHidden: true }],
    ["visible", { isHidden: false }],
  ])("filters by visibility=%s", async (visibility, where) => {
    const response = await request(app)
      .get("/admin/reviews")
      .query({ visibility, collectionPointId: POINT_ID })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ...where, collectionPointId: POINT_ID } }),
    );
  });

  it("rejects an unknown visibility", async () => {
    const response = await request(app)
      .get("/admin/reviews")
      .query({ visibility: "removed" })
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
  });
});

describe("PATCH /admin/reviews/:id/hide and /unhide", () => {
  it("hides a review, which removes it from the public listing query", async () => {
    prisma.review.findUnique.mockResolvedValue({ id: REVIEW_ID });
    prisma.review.update.mockResolvedValue(moderationRow(true));

    const response = await request(app)
      .patch(`/admin/reviews/${REVIEW_ID}/hide`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.isHidden).toBe(true);
    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: REVIEW_ID }, data: { isHidden: true } }),
    );
  });

  it("unhides a review", async () => {
    prisma.review.findUnique.mockResolvedValue({ id: REVIEW_ID });
    prisma.review.update.mockResolvedValue(moderationRow(false));

    const response = await request(app)
      .patch(`/admin/reviews/${REVIEW_ID}/unhide`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.isHidden).toBe(false);
    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isHidden: false } }),
    );
  });

  it("answers 404 for an unknown review", async () => {
    const response = await request(app)
      .patch(`/admin/reviews/${REVIEW_ID}/hide`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Review not found" });
    expect(prisma.review.update).not.toHaveBeenCalled();
  });

  it("answers 400 for a malformed id", async () => {
    const response = await request(app)
      .patch("/admin/reviews/not-a-uuid/hide")
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(400);
    expect(prisma.review.findUnique).not.toHaveBeenCalled();
  });

  it("records the moderation in the audit trail", async () => {
    prisma.review.findUnique.mockResolvedValue({ id: REVIEW_ID });
    prisma.review.update.mockResolvedValue(moderationRow(true));

    await request(app).patch(`/admin/reviews/${REVIEW_ID}/hide`).set(bearer(Role.ADMIN));
    await flushAudit();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "RESOURCE_CHANGED",
        method: "PATCH",
        route: "/admin/reviews/:id/hide",
        resourceId: REVIEW_ID,
      }),
    });
  });

  it.each([Role.CITIZEN, Role.COLLECTOR])("forbids %s", async (role) => {
    const response = await request(app).patch(`/admin/reviews/${REVIEW_ID}/hide`).set(bearer(role));

    expect(response.status).toBe(403);
    expect(prisma.review.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/reviews/:id", () => {
  it("deletes a review", async () => {
    prisma.review.findUnique.mockResolvedValue({ id: REVIEW_ID });

    const response = await request(app)
      .delete(`/admin/reviews/${REVIEW_ID}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(204);
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({ where: { id: REVIEW_ID } });
  });

  it("answers 404 for an unknown review", async () => {
    const response = await request(app)
      .delete(`/admin/reviews/${REVIEW_ID}`)
      .set(bearer(Role.ADMIN));

    expect(response.status).toBe(404);
    expect(prisma.review.deleteMany).not.toHaveBeenCalled();
  });

  it("forbids a citizen", async () => {
    const response = await request(app)
      .delete(`/admin/reviews/${REVIEW_ID}`)
      .set(bearer(Role.CITIZEN));

    expect(response.status).toBe(403);
    expect(prisma.review.deleteMany).not.toHaveBeenCalled();
  });
});
