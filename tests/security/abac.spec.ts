jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const POINT_ID = "point-1";
const HOURS_ID = "hours-1";
const OTHER_COLLECTOR_ID = "user-other-collector";

const validPoint = {
  name: "Eco Ponto",
  city: "Manhuaçu",
  address: "Rua A, 10",
  latitude: -20.25,
  longitude: -42.03,
  wasteCategories: ["PLASTIC"],
  operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
};

function givenPointOwnedBy(ownerId: string) {
  const point = { id: POINT_ID, collectorId: ownerId };
  prisma.collectionPoint.findUnique.mockResolvedValue(point);
  prisma.collectionPoint.update.mockResolvedValue({ ...point, ...validPoint });
  prisma.operatingHours.findUnique.mockResolvedValue({
    id: HOURS_ID,
    collectionPointId: POINT_ID,
    weekday: "MONDAY",
    openTime: new Date("1970-01-01T08:00:00.000Z"),
    closeTime: new Date("1970-01-01T12:00:00.000Z"),
    isActive: true,
  });
  prisma.operatingHours.create.mockImplementation(async ({ data }) => ({
    id: HOURS_ID,
    isActive: true,
    ...data,
  }));
  prisma.operatingHours.update.mockImplementation(async ({ data }) => ({
    id: HOURS_ID,
    collectionPointId: POINT_ID,
    weekday: "MONDAY",
    openTime: new Date("1970-01-01T08:00:00.000Z"),
    closeTime: new Date("1970-01-01T12:00:00.000Z"),
    isActive: true,
    ...data,
  }));
}

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("ABAC: collection point ownership", () => {
  it("lets the owner collector update their point", async () => {
    givenPointOwnedBy(users[Role.COLLECTOR].id);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send(validPoint);

    expect(response.status).toBe(200);
  });

  it("forbids a collector from updating another collector's point", async () => {
    givenPointOwnedBy(OTHER_COLLECTOR_ID);

    const response = await request(app)
      .put(`/collection-points/${POINT_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send(validPoint);

    expect(response.status).toBe(403);
    expect(prisma.collectionPoint.update).not.toHaveBeenCalled();
  });
});

describe("ABAC: operating hours ownership", () => {
  const newHours = { weekday: "TUESDAY", openTime: "09:00", closeTime: "11:00" };

  it.each([
    ["owner collector", Role.COLLECTOR, users[Role.COLLECTOR].id, 201],
    ["other collector", Role.COLLECTOR, OTHER_COLLECTOR_ID, 403],
    ["admin on any point", Role.ADMIN, OTHER_COLLECTOR_ID, 201],
  ] as const)("create hours as %s", async (_label, role, ownerId, expected) => {
    givenPointOwnedBy(ownerId);

    const response = await request(app)
      .post(`/collection-points/${POINT_ID}/operating-hours`)
      .set(bearer(role))
      .send(newHours);

    expect(response.status).toBe(expected);
    if (expected === 403) {
      expect(prisma.operatingHours.create).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["update", "put", { closeTime: "13:00" }],
    ["delete", "delete", undefined],
  ] as const)("forbids another collector to %s hours", async (_label, method, body) => {
    givenPointOwnedBy(OTHER_COLLECTOR_ID);

    const response = await request(app)
      [method](`/operating-hours/${HOURS_ID}`)
      .set(bearer(Role.COLLECTOR))
      .send(body);

    expect(response.status).toBe(403);
    expect(prisma.operatingHours.update).not.toHaveBeenCalled();
    expect(prisma.operatingHours.delete).not.toHaveBeenCalled();
  });

  it("returns 404 before checking ownership when the point does not exist", async () => {
    const response = await request(app)
      .post(`/collection-points/missing/operating-hours`)
      .set(bearer(Role.COLLECTOR))
      .send(newHours);

    expect(response.status).toBe(404);
  });
});
