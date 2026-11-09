jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

import request from "supertest";
import { app } from "../../src/app";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const category = { id: "plastic-id", name: "PLASTIC", active: true };
const point = (id: string, latitude: number, longitude: number) => ({
  id,
  collectorId: "collector-1",
  name: id,
  description: null,
  city: "Manhuaçu",
  address: "Rua A, 10",
  latitude,
  longitude,
  locationSource: "GPS_COORDINATES",
  placeId: null,
  whatsappContact: null,
  showWhatsappContact: false,
  operatingHours: [],
  status: "APPROVED",
  hoursConfirmedAt: new Date("2026-11-01T10:00:00.000Z"),
  isOutdated: false,
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
  categories: [{ category: { name: "PLASTIC" } }],
});

beforeEach(() => {
  resetPrismaMock();
  prisma.wasteCategory.findMany.mockResolvedValue([category]);
});

describe("GET /collection-points query validation and filtering", () => {
  it("combines city, waste type and radius filters", async () => {
    prisma.collectionPoint.findMany.mockResolvedValue([
      point("nearby", -20.258, -42.0336),
      point("far-away", -22.9, -43.2),
    ]);

    const response = await request(app).get(
      "/collection-points?city=Manhua%C3%A7u&wasteType=PLASTIC&latitude=-20.258&longitude=-42.0336&radius=2",
    );

    expect(response.status).toBe(200);
    expect(response.body.map(({ id }: { id: string }) => id)).toEqual(["nearby"]);
    expect(prisma.collectionPoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: { equals: "Manhuaçu" },
          categories: {
            some: { category: { is: { name: "PLASTIC", active: true } } },
          },
        }),
      }),
    );
  });

  it.each([
    ["malformed number", "latitude=oops&longitude=-42", "Latitude, longitude ou raio inválido."],
    [
      "missing coordinate pair",
      "latitude=-20.25",
      "Informe latitude e longitude juntas; o raio exige ambas.",
    ],
    [
      "radius without coordinates",
      "radius=2",
      "Informe latitude e longitude juntas; o raio exige ambas.",
    ],
    ["zero radius", "latitude=-20&longitude=-42&radius=0", "Latitude, longitude ou raio inválido."],
    [
      "out-of-range coordinates",
      "latitude=91&longitude=-42",
      "Coordenadas fora dos limites válidos.",
    ],
  ])("returns 400 for %s", async (_label, query, message) => {
    const response = await request(app).get(`/collection-points?${query}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(message);
    expect(prisma.collectionPoint.findMany).not.toHaveBeenCalled();
  });
});
