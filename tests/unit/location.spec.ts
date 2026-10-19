import { LocationSource } from "../../src/generated/prisma/enums";
import {
  LocationErrors,
  ResolveLocationUseCase,
} from "../../src/modules/geolocation/domain/use-cases/ResolveLocationUseCase";
import { isWithinBrazil } from "../../src/modules/geolocation/domain/rules/location-rules";
import type { IPlacesGateway } from "../../src/modules/places/domain/gateways/IPlacesGateway";
import { AppError } from "../../src/shared/errors/AppError";
import { distanceInKm } from "../../src/shared/geo/distance";

const MANHUACU = { latitude: -20.258, longitude: -42.0336 };
const NEAR_MANHUACU = { latitude: -20.262, longitude: -42.0336 };
const BELO_HORIZONTE = { latitude: -19.9167, longitude: -43.9345 };

function gatewayReturning(place: { latitude: number; longitude: number } | Error) {
  const getDetails = jest.fn(async () => {
    if (place instanceof Error) throw place;
    return { label: "Rua A, 10 - Manhuaçu, MG", ...place };
  });
  return { gateway: { getDetails, autocomplete: jest.fn() } as IPlacesGateway, getDetails };
}

const expectInvalidLocation = async (promise: Promise<unknown>, message: string) => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ statusCode: 422, message });
};

describe("distanceInKm", () => {
  it("is zero for the same point and symmetric", () => {
    expect(distanceInKm(MANHUACU, MANHUACU)).toBe(0);
    expect(distanceInKm(MANHUACU, BELO_HORIZONTE)).toBeCloseTo(
      distanceInKm(BELO_HORIZONTE, MANHUACU),
      10,
    );
  });

  it("matches known distances", () => {
    expect(distanceInKm(MANHUACU, BELO_HORIZONTE)).toBeGreaterThan(195);
    expect(distanceInKm(MANHUACU, BELO_HORIZONTE)).toBeLessThan(210);
    expect(distanceInKm(MANHUACU, NEAR_MANHUACU)).toBeCloseTo(0.44, 1);
  });
});

describe("isWithinBrazil", () => {
  it.each([
    ["Manhuaçu", MANHUACU],
    ["Oiapoque (north)", { latitude: 4.235, longitude: -51.83 }],
    ["Chuí (south)", { latitude: -33.69, longitude: -53.46 }],
    ["Fernando de Noronha", { latitude: -3.85, longitude: -32.42 }],
  ])("accepts %s", (_name, point) => {
    expect(isWithinBrazil(point)).toBe(true);
  });

  it.each([
    ["null island (0,0)", { latitude: 0, longitude: 0 }],
    ["Paris", { latitude: 48.85, longitude: 2.35 }],
    ["Buenos Aires", { latitude: -34.6, longitude: -58.38 }],
    ["swapped lat/long of Manhuaçu", { latitude: -42.0336, longitude: -20.258 }],
  ])("rejects %s", (_name, point) => {
    expect(isWithinBrazil(point)).toBe(false);
  });
});

describe("ResolveLocationUseCase", () => {
  it("accepts valid GPS coordinates without calling Google", async () => {
    const { gateway, getDetails } = gatewayReturning(MANHUACU);

    await expect(new ResolveLocationUseCase(gateway).execute(MANHUACU)).resolves.toEqual({
      ...MANHUACU,
      source: LocationSource.GPS_COORDINATES,
      placeId: null,
    });
    expect(getDetails).not.toHaveBeenCalled();
  });

  it("rejects a request with no location at all", async () => {
    const { gateway } = gatewayReturning(MANHUACU);
    await expectInvalidLocation(
      new ResolveLocationUseCase(gateway).execute({}),
      LocationErrors.MISSING,
    );
  });

  it.each([[{ latitude: -20.25 }], [{ longitude: -42.03 }]])(
    "rejects incomplete coordinates %o",
    async (input) => {
      const { gateway } = gatewayReturning(MANHUACU);
      await expectInvalidLocation(
        new ResolveLocationUseCase(gateway).execute(input),
        LocationErrors.INCOMPLETE_COORDINATES,
      );
    },
  );

  it("rejects coordinates outside Brazil", async () => {
    const { gateway } = gatewayReturning(MANHUACU);
    await expectInvalidLocation(
      new ResolveLocationUseCase(gateway).execute({ latitude: 0, longitude: 0 }),
      LocationErrors.OUTSIDE_SERVICE_AREA,
    );
  });

  it("uses the coordinates confirmed by Google for an address-only request", async () => {
    const { gateway, getDetails } = gatewayReturning(MANHUACU);

    const location = await new ResolveLocationUseCase(gateway).execute({ placeId: "place_1" });

    expect(getDetails).toHaveBeenCalledWith({ placeId: "place_1" });
    expect(location).toEqual({
      ...MANHUACU,
      source: LocationSource.VERIFIED_ADDRESS,
      placeId: "place_1",
    });
  });

  it("keeps the refined pin when it is within 1 km of the verified address", async () => {
    const { gateway } = gatewayReturning(MANHUACU);

    const location = await new ResolveLocationUseCase(gateway).execute({
      ...NEAR_MANHUACU,
      placeId: "place_1",
    });

    expect(location).toMatchObject({ ...NEAR_MANHUACU, source: LocationSource.VERIFIED_ADDRESS });
  });

  it("rejects coordinates far from the verified address", async () => {
    const { gateway } = gatewayReturning(MANHUACU);
    await expectInvalidLocation(
      new ResolveLocationUseCase(gateway).execute({ ...BELO_HORIZONTE, placeId: "place_1" }),
      LocationErrors.COORDINATES_MISMATCH,
    );
  });

  it("rejects an address Google cannot find", async () => {
    const { gateway } = gatewayReturning(new AppError("Local não encontrado", 404));
    await expectInvalidLocation(
      new ResolveLocationUseCase(gateway).execute({ placeId: "unknown" }),
      LocationErrors.ADDRESS_NOT_FOUND,
    );
  });

  it("rejects a verified address outside Brazil", async () => {
    const { gateway } = gatewayReturning({ latitude: 48.85, longitude: 2.35 });
    await expectInvalidLocation(
      new ResolveLocationUseCase(gateway).execute({ placeId: "paris" }),
      LocationErrors.ADDRESS_OUTSIDE_SERVICE_AREA,
    );
  });

  it("fails closed when the verification service is unavailable", async () => {
    const outage = new AppError("Busca de endereços indisponível no momento", 503);
    const { gateway } = gatewayReturning(outage);

    await expect(
      new ResolveLocationUseCase(gateway).execute({ ...MANHUACU, placeId: "place_1" }),
    ).rejects.toBe(outage);
  });
});
