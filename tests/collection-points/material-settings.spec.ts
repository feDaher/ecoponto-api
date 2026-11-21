jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const POINT_ID = "point-1";
const CATEGORY_ID = "category-plastic";

function givenPointOwnedBy(collectorId: string) {
  prisma.collectionPoint.findUnique.mockResolvedValue({
    id: POINT_ID,
    collectorId,
    status: "APPROVED",
  });
}

function givenUpdatedMaterial(capacityKg: number | null, isAccepting: boolean) {
  prisma.pointCategory.updateMany.mockResolvedValue({ count: 1 });
  prisma.pointCategory.findUnique.mockResolvedValue({
    capacityKg: capacityKg === null ? null : { toNumber: () => capacityKg },
    isAccepting,
  });
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("PATCH /collection-points/:id/materials/:categoryId", () => {
  it("lets the point owner pause reception and set the capacity", async () => {
    givenPointOwnedBy(users[Role.COLLECTOR].id);
    givenUpdatedMaterial(250.5, false);

    const response = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send({ capacityKg: 250.5, isAccepting: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      pointId: POINT_ID,
      categoryId: CATEGORY_ID,
      capacityKg: 250.5,
      isAccepting: false,
    });
    expect(prisma.pointCategory.updateMany).toHaveBeenCalledWith({
      where: { pointId: POINT_ID, categoryId: CATEGORY_ID },
      data: { capacityKg: 250.5, isAccepting: false },
    });
  });

  it("lets an administrator remove the capacity limit without changing reception", async () => {
    givenPointOwnedBy(users[Role.COLLECTOR].id);
    givenUpdatedMaterial(null, true);

    const response = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .set(bearer(Role.ADMIN))
      .send({ capacityKg: null });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ capacityKg: null, isAccepting: true }));
    expect(prisma.pointCategory.updateMany).toHaveBeenCalledWith({
      where: { pointId: POINT_ID, categoryId: CATEGORY_ID },
      data: { capacityKg: null },
    });
  });

  it("allows reactivating reception and the maximum configured capacity", async () => {
    givenPointOwnedBy(users[Role.COLLECTOR].id);
    givenUpdatedMaterial(100_000, true);

    const response = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send({ capacityKg: 100_000, isAccepting: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ capacityKg: 100_000, isAccepting: true }),
    );
  });

  it("rejects requests without settings and unknown body fields", async () => {
    givenPointOwnedBy(users[Role.COLLECTOR].id);

    const empty = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send({});
    const unknown = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send({ capacityKg: 10, isOpen: true });

    expect(empty.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(prisma.pointCategory.updateMany).not.toHaveBeenCalled();
  });

  it.each([0, -1, 100_000.001, 100_001, 1.2345])(
    "rejects invalid capacity %s",
    async (capacityKg) => {
      const response = await request(app)
        .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
        .set(bearer(Role.COLLECTOR))
        .send({ capacityKg });

      expect(response.status).toBe(400);
      expect(prisma.collectionPoint.findUnique).not.toHaveBeenCalled();
    },
  );

  it("returns 401 without authentication", async () => {
    const response = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .send({ isAccepting: false });

    expect(response.status).toBe(401);
  });

  it("returns 403 when another collector tries to manage the point", async () => {
    givenPointOwnedBy("another-collector");

    const response = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send({ isAccepting: false });

    expect(response.status).toBe(403);
    expect(prisma.pointCategory.updateMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the category is not linked to the point", async () => {
    givenPointOwnedBy(users[Role.COLLECTOR].id);
    prisma.pointCategory.updateMany.mockResolvedValue({ count: 0 });

    const response = await request(app)
      .patch(`/collection-points/${POINT_ID}/materials/${CATEGORY_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send({ isAccepting: false });

    expect(response.status).toBe(404);
  });
});
