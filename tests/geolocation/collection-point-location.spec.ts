jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

const mockGetDetails = jest.fn();
jest.mock("../../src/modules/places/infra/http/GooglePlacesClient", () => ({
  GooglePlacesClient: jest.fn().mockImplementation(() => ({
    getDetails: mockGetDetails,
    autocomplete: jest.fn(),
  })),
}));

import request from "supertest";
import { app } from "../../src/app";
import { LocationSource, Role } from "../../src/generated/prisma/enums";
import { LocationErrors } from "../../src/modules/geolocation/domain/use-cases/ResolveLocationUseCase";
import { AppError } from "../../src/shared/errors/AppError";
import { bearer, installIdentities, users } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const MANHUACU = { latitude: -20.258, longitude: -42.0336 };

const basePoint = {
  name: "Eco Ponto Centro",
  city: "Manhuaçu",
  address: "Rua A, 10",
  wasteCategories: ["PLASTIC"],
  operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
};

const register = (body: object) =>
  request(app).post("/collection-points").set(bearer(Role.COLLECTOR)).send(body);

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  mockGetDetails.mockReset();
  prisma.collectionPoint.create.mockImplementation(async ({ data }) => ({
    id: "point-1",
    ...data,
  }));
});

describe("POST /collection-points location validation (RN04)", () => {
  it.each([
    ["no location at all", {}, LocationErrors.MISSING],
    ["only latitude", { latitude: -20.25 }, LocationErrors.INCOMPLETE_COORDINATES],
    ["null island (0,0)", { latitude: 0, longitude: 0 }, LocationErrors.OUTSIDE_SERVICE_AREA],
    ["Paris", { latitude: 48.85, longitude: 2.35 }, LocationErrors.OUTSIDE_SERVICE_AREA],
    ["out of range", { latitude: 999, longitude: -42 }, LocationErrors.OUTSIDE_SERVICE_AREA],
  ])("returns 422 for %s and stores nothing", async (_label, location, message) => {
    const response = await register({ ...basePoint, ...location });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message });
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });

  it("returns 400 (not 422) for a malformed body", async () => {
    const response = await register({ ...basePoint, latitude: "-20.25", longitude: -42.03 });
    expect(response.status).toBe(400);
  });

  it("returns 400 for a placeId with forbidden characters, without calling Google", async () => {
    const response = await register({ ...basePoint, placeId: "../../etc/passwd" });

    expect(response.status).toBe(400);
    expect(mockGetDetails).not.toHaveBeenCalled();
  });

  it("registers a point with valid GPS coordinates", async () => {
    const response = await register({ ...basePoint, ...MANHUACU });

    expect(response.status).toBe(201);
    expect(prisma.collectionPoint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...MANHUACU,
        locationSource: LocationSource.GPS_COORDINATES,
        placeId: null,
        collectorId: users[Role.COLLECTOR].id,
      }),
    });
    expect(mockGetDetails).not.toHaveBeenCalled();
  });

  it("registers an address-only point with the coordinates confirmed by Google", async () => {
    mockGetDetails.mockResolvedValue({ label: "Rua A, 10", ...MANHUACU });

    const response = await register({ ...basePoint, placeId: "ChIJ_place" });

    expect(response.status).toBe(201);
    expect(prisma.collectionPoint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...MANHUACU,
        locationSource: LocationSource.VERIFIED_ADDRESS,
        placeId: "ChIJ_place",
      }),
    });
  });

  it("returns 422 when the pin is far from the verified address", async () => {
    mockGetDetails.mockResolvedValue({ label: "Rua A, 10", ...MANHUACU });

    const response = await register({
      ...basePoint,
      placeId: "ChIJ_place",
      latitude: -19.9167,
      longitude: -43.9345,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: LocationErrors.COORDINATES_MISMATCH });
  });

  it("returns 422 when Google cannot find the address", async () => {
    mockGetDetails.mockRejectedValue(new AppError("Local não encontrado", 404));

    const response = await register({ ...basePoint, placeId: "ChIJ_unknown" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: LocationErrors.ADDRESS_NOT_FOUND });
  });

  it("returns 503 and stores nothing when address verification is unavailable", async () => {
    mockGetDetails.mockRejectedValue(
      new AppError("Busca de endereços indisponível no momento", 503),
    );

    const response = await register({ ...basePoint, ...MANHUACU, placeId: "ChIJ_place" });

    expect(response.status).toBe(503);
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });
});

describe("PUT /collection-points/:id location validation", () => {
  beforeEach(() => {
    prisma.collectionPoint.findUnique.mockResolvedValue({
      id: "point-1",
      collectorId: users[Role.COLLECTOR].id,
    });
  });

  it("returns 422 for an invalid location and keeps the point unchanged", async () => {
    const response = await request(app)
      .put("/collection-points/point-1")
      .set(bearer(Role.COLLECTOR))
      .send({ ...basePoint, latitude: 0, longitude: 0 });

    expect(response.status).toBe(422);
    expect(prisma.collectionPoint.update).not.toHaveBeenCalled();
  });

  it("checks ownership before calling the address verification service", async () => {
    prisma.collectionPoint.findUnique.mockResolvedValue({ id: "point-1", collectorId: "someone" });

    const response = await request(app)
      .put("/collection-points/point-1")
      .set(bearer(Role.COLLECTOR))
      .send({ ...basePoint, placeId: "ChIJ_place" });

    expect(response.status).toBe(403);
    expect(mockGetDetails).not.toHaveBeenCalled();
  });
});
