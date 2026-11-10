jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { bearer, installIdentities } from "../support/identities";
import { resetPrismaMock, prisma } from "../support/prisma-mock";

const review = {
  id: "review-test",
  citizenId: "user-citizen",
  collectionPointId: "point-test",
  rating: 5,
  comment: "Avaliação de teste",
  isHidden: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("BE-09 - Moderação de avaliações", () => {
  it("lista somente avaliações visíveis", async () => {
    (prisma.review.findMany as jest.Mock).mockResolvedValue([review]);

    const response = await request(app).get("/reviews");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prisma.review.findMany).toHaveBeenCalledWith({
      where: { isHidden: false },
      orderBy: { createdAt: "desc" },
    });
  });

  it("permite ao administrador ocultar uma avaliação", async () => {
    (prisma.review.findUnique as jest.Mock).mockResolvedValue(review);
    (prisma.review.update as jest.Mock).mockResolvedValue({
      ...review,
      isHidden: true,
    });

    const response = await request(app)
      .patch("/admin/reviews/review-test/hide")
      .set(bearer("ADMIN"));

    expect(response.status).toBe(200);
    expect(response.body.isHidden).toBe(true);
    expect(prisma.review.update).toHaveBeenCalledWith({
      where: { id: "review-test" },
      data: { isHidden: true },
    });
  });

  it("retorna 404 ao tentar ocultar avaliação inexistente", async () => {
    const response = await request(app)
      .patch("/admin/reviews/inexistente/hide")
      .set(bearer("ADMIN"));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Avaliação não encontrada",
    });
  });

  it("permite ao administrador excluir uma avaliação", async () => {
    (prisma.review.findUnique as jest.Mock).mockResolvedValue(review);
    (prisma.review.delete as jest.Mock).mockResolvedValue(review);

    const response = await request(app).delete("/admin/reviews/review-test").set(bearer("ADMIN"));

    expect(response.status).toBe(204);
    expect(prisma.review.delete).toHaveBeenCalledWith({
      where: { id: "review-test" },
    });
  });

  it("retorna 404 ao tentar excluir avaliação inexistente", async () => {
    const response = await request(app).delete("/admin/reviews/inexistente").set(bearer("ADMIN"));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Avaliação não encontrada",
    });
  });

  it("impede cidadão de ocultar avaliação", async () => {
    const response = await request(app)
      .patch("/admin/reviews/review-test/hide")
      .set(bearer("CITIZEN"));

    expect(response.status).toBe(403);
  });

  it("impede cidadão de excluir avaliação", async () => {
    const response = await request(app).delete("/admin/reviews/review-test").set(bearer("CITIZEN"));

    expect(response.status).toBe(403);
  });
});
