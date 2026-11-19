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
});
