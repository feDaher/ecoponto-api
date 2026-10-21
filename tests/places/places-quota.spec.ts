jest.mock("../../src/config/firebase", () => jest.requireActual("../support/firebase-mock"));
jest.mock("../../src/config/prisma", () => jest.requireActual("../support/prisma-mock"));

const mockAutocomplete = jest.fn();
const mockGetDetails = jest.fn();
jest.mock("../../src/modules/places/infra/http/GooglePlacesClient", () => ({
  GooglePlacesClient: jest.fn().mockImplementation(() => ({
    autocomplete: mockAutocomplete,
    getDetails: mockGetDetails,
  })),
}));

import request from "supertest";
import { app } from "../../src/app";
import { Role } from "../../src/generated/prisma/enums";
import {
  QUOTA_EXCEEDED_MESSAGE,
  quotaDay,
} from "../../src/modules/places/domain/services/PlacesQuotaGuard";
import { bearer, installIdentities } from "../support/identities";
import { prisma, resetPrismaMock } from "../support/prisma-mock";

const MANHUACU_PLACE = { label: "Manhuaçu, MG", latitude: -20.258, longitude: -42.0336 };

const quotaAvailable = () => prisma.placesApiUsage.updateMany.mockResolvedValue({ count: 1 });
const quotaExhausted = () => prisma.placesApiUsage.updateMany.mockResolvedValue({ count: 0 });

beforeEach(() => {
  resetPrismaMock();
  installIdentities();
  mockAutocomplete.mockReset().mockResolvedValue([]);
  mockGetDetails.mockReset().mockResolvedValue(MANHUACU_PLACE);
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("quotaDay", () => {
  it("uses the São Paulo calendar day, not UTC", () => {
    // 02:00 UTC on the 22nd is still 23:00 on the 21st in Brasília (UTC-3).
    expect(quotaDay(new Date("2026-10-22T02:00:00Z"))).toBe("2026-10-21");
    expect(quotaDay(new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-22");
  });
});

describe("Google Places daily quota", () => {
  it("counts an autocomplete call atomically against the daily limit", async () => {
    quotaAvailable();

    const response = await request(app).get("/places/autocomplete").query({ input: "Rua A" });

    expect(response.status).toBe(200);
    expect(prisma.placesApiUsage.createMany).toHaveBeenCalledWith({
      data: [{ sku: "AUTOCOMPLETE", day: quotaDay() }],
      skipDuplicates: true,
    });
    expect(prisma.placesApiUsage.updateMany).toHaveBeenCalledWith({
      where: { sku: "AUTOCOMPLETE", day: quotaDay(), count: { lt: 250 } },
      data: { count: { increment: 1 } },
    });
    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and never calls Google once autocomplete hits the limit", async () => {
    quotaExhausted();

    const response = await request(app).get("/places/autocomplete").query({ input: "Rua A" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: QUOTA_EXCEEDED_MESSAGE });
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });

  it("returns 503 and never calls Google once place details hits the limit", async () => {
    quotaExhausted();

    const response = await request(app).get("/places/abc123");

    expect(response.status).toBe(503);
    expect(mockGetDetails).not.toHaveBeenCalled();
    expect(prisma.placesApiUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sku: "PLACE_DETAILS" }) }),
    );
  });

  it("does not count requests rejected by validation", async () => {
    const response = await request(app).get("/places/autocomplete").query({ input: "ab" });

    expect(response.status).toBe(400);
    expect(prisma.placesApiUsage.updateMany).not.toHaveBeenCalled();
  });

  it("applies the same limit to address verification when registering a point", async () => {
    quotaExhausted();
    // Categories are checked against the catalog (BE-16) before the location is resolved.
    prisma.wasteCategory.findMany.mockResolvedValue([
      { id: "category-plastic", name: "PLASTIC", active: true },
    ]);

    const response = await request(app)
      .post("/collection-points")
      .set(bearer(Role.COLLECTOR))
      .send({
        name: "Eco Ponto Centro",
        city: "Manhuaçu",
        address: "Rua A, 10",
        placeId: "abc123",
        wasteCategories: ["PLASTIC"],
        operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
      });

    expect(response.status).toBe(503);
    expect(mockGetDetails).not.toHaveBeenCalled();
    expect(prisma.collectionPoint.create).not.toHaveBeenCalled();
  });
});

describe("GET /places/usage", () => {
  it("reports today's usage per SKU to admins", async () => {
    prisma.placesApiUsage.findMany.mockResolvedValue([{ sku: "AUTOCOMPLETE", count: 120 }]);

    const response = await request(app).get("/places/usage").set(bearer(Role.ADMIN));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      day: quotaDay(),
      timeZone: "America/Sao_Paulo",
      usage: [
        { sku: "AUTOCOMPLETE", used: 120, limit: 250, remaining: 130 },
        { sku: "PLACE_DETAILS", used: 0, limit: 250, remaining: 250 },
      ],
    });
  });

  it("is not treated as a place id (no Google call, no quota spent)", async () => {
    await request(app).get("/places/usage").set(bearer(Role.ADMIN));

    expect(mockGetDetails).not.toHaveBeenCalled();
    expect(prisma.placesApiUsage.updateMany).not.toHaveBeenCalled();
  });
});
