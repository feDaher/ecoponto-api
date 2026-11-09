jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const editPoint = {
  name: "Eco Ponto Centro",
  city: "Manhuaçu",
  address: "Rua A, 10",
  latitude: -20.258,
  longitude: -42.0336,
  wasteCategories: ["PLASTIC"],
};

const newPoint = {
  ...editPoint,
  operatingHours: [
    { weekday: "MONDAY", openTime: "08:00", closeTime: "17:30" },
    { weekday: "SATURDAY", openTime: "08:00", closeTime: "12:00" },
  ],
};

const storedHours = [
  {
    id: "hour-1",
    weekday: "MONDAY",
    openTime: new Date("1970-01-01T08:00:00.000Z"),
    closeTime: new Date("1970-01-01T17:30:00.000Z"),
    isActive: true,
  },
];

function storedPoint(overrides: Record<string, unknown> = {}) {
  return {
    id: "point-1",
    collectorId: users[Role.COLLECTOR].id,
    name: editPoint.name,
    description: null,
    city: editPoint.city,
    address: editPoint.address,
    latitude: "-20.258",
    longitude: "-42.0336",
    locationSource: "GPS_COORDINATES",
    placeId: null,
    whatsappContact: null,
    showWhatsappContact: false,
    status: "PENDING",
    hoursConfirmedAt: new Date("2026-11-01T00:00:00Z"),
    isOutdated: false,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    categories: [{ category: { name: "PLASTIC" } }],
    hours: storedHours,
    ...overrides,
  };
}

const register = (body: object) =>
  request(app).post("/collection-points").set(bearer(Role.COLLECTOR)).send(body);

const edit = (body: object) =>
  request(app).put("/collection-points/point-1").set(bearer(Role.COLLECTOR)).send(body);

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  prisma.wasteCategory.findMany.mockResolvedValue([
    { id: "category-plastic", name: "PLASTIC", active: true },
  ]);
  prisma.collectionPoint.create.mockResolvedValue(storedPoint());
  prisma.collectionPoint.update.mockResolvedValue(storedPoint());
  prisma.collectionPoint.findUnique.mockResolvedValue({
    id: "point-1",
    collectorId: users[Role.COLLECTOR].id,
    status: "APPROVED",
  });
});

describe("operating hours on point registration", () => {
  it("writes the hours to the OperatingHours table in the same create as the point", async () => {
    const response = await register(newPoint);

    expect(response.status).toBe(201);
    const { data } = prisma.collectionPoint.create.mock.calls[0][0];
    expect(data).not.toHaveProperty("operatingHours");
    expect(data.hours).toEqual({
      create: [
        {
          weekday: "MONDAY",
          openTime: new Date("1970-01-01T08:00:00.000Z"),
          closeTime: new Date("1970-01-01T17:30:00.000Z"),
        },
        {
          weekday: "SATURDAY",
          openTime: new Date("1970-01-01T08:00:00.000Z"),
          closeTime: new Date("1970-01-01T12:00:00.000Z"),
        },
      ],
    });
  });

  it("returns the hours as HH:mm in the hours field", async () => {
    const response = await register(newPoint);

    expect(response.body.hours).toEqual([
      { id: "hour-1", weekday: "MONDAY", openTime: "08:00", closeTime: "17:30", isActive: true },
    ]);
    expect(response.body).not.toHaveProperty("operatingHours");
  });

  it.each([
    ["closes before it opens", "18:00", "08:00"],
    ["opens and closes at the same time", "08:00", "08:00"],
  ])("rejects an hour that %s with 400", async (_label, openTime, closeTime) => {
    const response = await register({
      ...newPoint,
      operatingHours: [{ weekday: "MONDAY", openTime, closeTime }],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(
      "O horário de fechamento deve ser depois do horário de abertura",
    );
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });

  it("still requires at least one operating hour", async () => {
    const response = await register({ ...newPoint, operatingHours: [] });

    expect(response.status).toBe(400);
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });
});

describe("operating hours on point edition", () => {
  it("rejects operatingHours on PUT with 400 instead of silently ignoring them", async () => {
    const response = await edit(newPoint);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("/collection-points/{id}/operating-hours");
    expect(prisma.collectionPoint.update).not.toHaveBeenCalled();
  });

  it("resubmits the point without touching its hours or the hours confirmation", async () => {
    const response = await edit(editPoint);

    expect(response.status).toBe(200);
    const { data } = prisma.collectionPoint.update.mock.calls[0][0];
    expect(data.status).toBe("PENDING");
    expect(data).not.toHaveProperty("hours");
    expect(data).not.toHaveProperty("hoursConfirmedAt");
    expect(data).not.toHaveProperty("isOutdated");
    expect(response.body.hours).toHaveLength(1);
  });
});

describe("public reads", () => {
  it("returns the active hours on the public detail", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue(storedPoint({ status: "APPROVED" }));

    const response = await request(app).get("/collection-points/point-1");

    expect(response.status).toBe(200);
    expect(response.body.hours).toEqual([
      { id: "hour-1", weekday: "MONDAY", openTime: "08:00", closeTime: "17:30", isActive: true },
    ]);
  });
});
