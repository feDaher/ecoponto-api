jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import { Prisma } from "../../src/generated/prisma/client";
import { PrismaCollectionPointRepository } from "../../src/modules/collection-points/infra/repositories/PrismaCollectionPointRepository";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const repository = new PrismaCollectionPointRepository();

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "point-1",
    collectorId: "user-collector",
    name: "Eco Ponto Centro",
    description: null,
    city: "Manhuaçu",
    address: "Rua A, 10",
    latitude: new Prisma.Decimal("-20.25800000"),
    longitude: new Prisma.Decimal("-42.03360000"),
    locationSource: "GPS_COORDINATES",
    placeId: null,
    whatsappContact: "33999990000",
    showWhatsappContact: true,
    hours: [
      {
        id: "hour-1",
        weekday: "MONDAY",
        openTime: new Date("1970-01-01T08:00:00.000Z"),
        closeTime: new Date("1970-01-01T17:30:00.000Z"),
        isActive: true,
      },
    ],
    status: "APPROVED",
    hoursConfirmedAt: new Date("2026-11-01T00:00:00Z"),
    isOutdated: false,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    categories: [{ category: { name: "PLASTIC" } }, { category: { name: "GLASS" } }],
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
});

describe("PrismaCollectionPointRepository mapping", () => {
  it("maps a public row without moderation fields, with sorted category codes", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue(row());

    const point = await repository.findApprovedById("point-1");

    expect(point).toMatchObject({
      latitude: "-20.258",
      longitude: "-42.0336",
      wasteCategories: ["GLASS", "PLASTIC"],
      hours: [
        { id: "hour-1", weekday: "MONDAY", openTime: "08:00", closeTime: "17:30", isActive: true },
      ],
    });
    expect(point).not.toHaveProperty("rejectionReason");
    expect(point).not.toHaveProperty("reviewedById");
    expect(point).not.toHaveProperty("categories");
    expect(prisma.collectionPoint.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "point-1", status: "APPROVED" },
        omit: { rejectionReason: true, reviewedById: true, reviewedAt: true },
      }),
    );
  });

  it("keeps moderation fields and the collector on the admin pending list", async () => {
    prisma.collectionPoint.findMany.mockResolvedValue([
      row({
        status: "PENDING",
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
        collector: { id: "user-collector", name: "Coletor", email: "c@test.dev" },
      }),
    ]);

    const [point] = await repository.listPending();

    expect(point).toMatchObject({
      rejectionReason: null,
      collector: { id: "user-collector", name: "Coletor", email: "c@test.dev" },
    });
  });

  it("reads only the active hours from the OperatingHours table, in weekday order", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue(row());

    await repository.findApprovedById("point-1");

    expect(prisma.collectionPoint.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          hours: {
            where: { isActive: true },
            orderBy: [{ weekday: "asc" }, { openTime: "asc" }],
          },
        }),
      }),
    );
  });

  it("never exposes the removed operatingHours JSON field", async () => {
    prisma.collectionPoint.findFirst.mockResolvedValue(row());

    const point = await repository.findApprovedById("point-1");

    expect(point).not.toHaveProperty("operatingHours");
  });

  it("reads only the fields needed for ownership and status checks", async () => {
    await repository.findSummaryById("point-1");

    expect(prisma.collectionPoint.findUnique).toHaveBeenCalledWith({
      where: { id: "point-1" },
      select: { id: true, collectorId: true, status: true },
    });
  });
});
