jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const POINT_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_ID = "22222222-2222-4222-8222-222222222222";

const savedRow = (rating: number, comment: string | null) => ({
  id: REVIEW_ID,
  rating,
  comment,
  createdAt: new Date("2026-11-19T12:00:00.000Z"),
  citizen: { name: "Maria da Silva" },
});

const publish = (body: object, role: Role = Role.CITIZEN) =>
  request(app).post(`/collection-points/${POINT_ID}/reviews`).set(bearer(role)).send(body);
const flushAudit = () => new Promise((resolve) => setImmediate(resolve));
beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  prisma.collectionPoint.findFirst.mockResolvedValue({ id: POINT_ID });
});

describe("POST /collection-points/:id/reviews (RB12)", () => {
  it("creates the citizen's first review of the point, authored by the token's user", async () => {
    prisma.review.create.mockResolvedValue(savedRow(5, "Muito organizado"));

    const response = await publish({ rating: 5, comment: "  Muito organizado  " });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: REVIEW_ID,
      rating: 5,
      comment: "Muito organizado",
      authorName: "Maria",
      createdAt: "2026-11-19T12:00:00.000Z",
    });
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          citizenId: "user-citizen",
          collectionPointId: POINT_ID,
          rating: 5,
          comment: "Muito organizado",
        },
      }),
    );
  });

  it("updates the existing review instead of creating a second one", async () => {
    prisma.review.findFirst.mockResolvedValue({ id: REVIEW_ID });
    prisma.review.update.mockResolvedValue(savedRow(3, null));

    const response = await publish({ rating: 3, comment: "   " });

    expect(response.status).toBe(200);
    expect(prisma.review.create).not.toHaveBeenCalled();
    // isHidden is not part of the update: editing never undoes the moderation.
    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: REVIEW_ID }, data: { rating: 3, comment: null } }),
    );
  });

  it("answers 404 for a point that is not approved", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue(null);

    const response = await publish({ rating: 4 });

    expect(response.status).toBe(404);
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it.each([{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: 4, comment: "x".repeat(501) }])(
    "rejects an invalid body %j with 400",
    async (body) => {
      const response = await publish(body);
      expect(response.status).toBe(400);
    },
  );

  it("does not accept a citizenId from the client", async () => {
    const response = await publish({ rating: 4, citizenId: "someone-else" });
    expect(response.status).toBe(400);
  });
  it("records the review creation in the audit trail", async () => {
    prisma.review.create.mockResolvedValue(savedRow(5, "Teste"));

    const response = await publish({ rating: 5, comment: "Teste" });
    await flushAudit();

    expect(response.status).toBe(201);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-citizen",
        action: "RESOURCE_CHANGED",
        method: "POST",
        route: "/collection-points/:id/reviews",
        resourceId: REVIEW_ID,
        statusCode: 201,
      }),
    });
  });
  it("records the review update in the audit trail", async () => {
    prisma.review.findFirst.mockResolvedValue({ id: REVIEW_ID });
    prisma.review.update.mockResolvedValue(savedRow(4, "Atualizado"));

    const response = await publish({ rating: 4, comment: "Atualizado" });
    await flushAudit();

    expect(response.status).toBe(200);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-citizen",
        action: "RESOURCE_CHANGED",
        method: "POST",
        route: "/collection-points/:id/reviews",
        resourceId: REVIEW_ID,
        statusCode: 200,
      }),
    });
  });

  it("updates the existing review after a concurrent creation conflict", async () => {
    prisma.review.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: REVIEW_ID });

    prisma.review.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      }),
    );

    prisma.review.update.mockResolvedValue(savedRow(4, "Avaliação atualizada"));

    const response = await publish({
      rating: 4,
      comment: "Avaliação atualizada",
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(REVIEW_ID);
    expect(response.body.rating).toBe(4);

    expect(prisma.review.create).toHaveBeenCalledTimes(1);
    expect(prisma.review.findFirst).toHaveBeenCalledTimes(2);

    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REVIEW_ID },
        data: {
          rating: 4,
          comment: "Avaliação atualizada",
        },
      }),
    );
  });

  it("does not recover a unique conflict without a matching review", async () => {
    prisma.review.findFirst.mockResolvedValue(null);

    prisma.review.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      }),
    );

    const response = await publish({ rating: 4 });

    expect(response.status).toBe(500);
    expect(prisma.review.update).not.toHaveBeenCalled();
  });

  it("propagates database errors unrelated to unique constraints", async () => {
    prisma.review.findFirst.mockResolvedValue(null);

    prisma.review.create.mockRejectedValueOnce(
      Object.assign(new Error("Database error"), {
        code: "P2024",
      }),
    );

    const response = await publish({ rating: 4 });

    expect(response.status).toBe(500);
    expect(prisma.review.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.review.update).not.toHaveBeenCalled();
  });
});
