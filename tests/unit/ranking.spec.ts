jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import { assignPositions } from "../../src/modules/ranking/domain/entities/RankingEntry";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const score = (citizenId: string, points: number) => ({
  citizenId,
  name: `Name ${citizenId}`,
  city: "Manhuaçu",
  points,
});

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
});

describe("assignPositions", () => {
  it("uses competition ranking: ties share the position and the next one skips", () => {
    const ranked = assignPositions([
      score("a", 90),
      score("b", 50),
      score("c", 50),
      score("d", 10),
    ]);

    expect(ranked.map(({ position }) => position)).toEqual([1, 2, 2, 4]);
  });
});

describe("GET /ranking (public)", () => {
  it("ranks citizens by confirmed points, exposing only first name, city and points", async () => {
    prisma.disposalRecord.groupBy.mockResolvedValue([
      { citizenId: "u1", _sum: { pointsEarned: 120 } },
      { citizenId: "u2", _sum: { pointsEarned: 120 } },
      { citizenId: "u3", _sum: { pointsEarned: 40 } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "Ana Paula Souza", city: "Manhuaçu" },
      { id: "u2", name: "Bruno Lima", city: "Manhuaçu" },
      { id: "u3", name: "Carla", city: "Manhumirim" },
    ]);

    const response = await request(app).get("/ranking").query({ limit: 3 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { position: 1, name: "Ana", city: "Manhuaçu", points: 120 },
      { position: 1, name: "Bruno", city: "Manhuaçu", points: 120 },
      { position: 3, name: "Carla", city: "Manhumirim", points: 40 },
    ]);
    expect(prisma.disposalRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "CONFIRMED",
          citizen: { role: "CITIZEN", isBlocked: false },
        },
        take: 3,
      }),
    );
  });

  it("filters by city", async () => {
    await request(app).get("/ranking").query({ city: "Manhuaçu" });

    expect(prisma.disposalRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          citizen: { role: "CITIZEN", isBlocked: false, city: "Manhuaçu" },
        }),
        take: 20,
      }),
    );
  });

  it("rejects a limit above 100", async () => {
    const response = await request(app).get("/ranking").query({ limit: 101 });
    expect(response.status).toBe(400);
  });
});

describe("GET /ranking/me", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockImplementation(
      async ({ where }: { where: { firebaseUid?: string } }) =>
        where.firebaseUid === "uid-citizen"
          ? { ...users[Role.CITIZEN], name: "Maria da Silva", city: "Manhuaçu", isBlocked: false }
          : null,
    );
  });

  it("returns the citizen's position among those with more points", async () => {
    prisma.disposalRecord.aggregate.mockResolvedValue({ _sum: { pointsEarned: 75 } });
    prisma.disposalRecord.groupBy.mockResolvedValue([{ citizenId: "x" }, { citizenId: "y" }]);

    const response = await request(app).get("/ranking/me").set(bearer(Role.CITIZEN));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ position: 3, name: "Maria", city: "Manhuaçu", points: 75 });
  });

  it("has no position while the citizen has no confirmed points", async () => {
    prisma.disposalRecord.aggregate.mockResolvedValue({ _sum: { pointsEarned: null } });

    const response = await request(app).get("/ranking/me").set(bearer(Role.CITIZEN));

    expect(response.body).toEqual({ position: null, name: "Maria", city: "Manhuaçu", points: 0 });
    expect(prisma.disposalRecord.groupBy).not.toHaveBeenCalled();
  });

  it("has no position in another city's ranking", async () => {
    prisma.disposalRecord.aggregate.mockResolvedValue({ _sum: { pointsEarned: 75 } });

    const response = await request(app)
      .get("/ranking/me")
      .query({ city: "Manhumirim" })
      .set(bearer(Role.CITIZEN));

    expect(response.body.position).toBeNull();
  });
});
