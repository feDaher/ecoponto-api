import { boundingBox, distanceInKm, type GeoPoint } from "../../src/shared/geo/distance";

const MANHUACU: GeoPoint = { latitude: -20.258, longitude: -42.0336 };

describe("boundingBox", () => {
  it("is centered on the point and spans twice the radius in latitude", () => {
    const box = boundingBox(MANHUACU, 10);

    expect((box.minLatitude + box.maxLatitude) / 2).toBeCloseTo(MANHUACU.latitude, 10);
    expect((box.minLongitude + box.maxLongitude) / 2).toBeCloseTo(MANHUACU.longitude, 10);
    expect(box.maxLatitude - box.minLatitude).toBeCloseTo(20 / 111.195, 3);
  });

  it("widens the longitude span away from the equator", () => {
    const equator = boundingBox({ latitude: 0, longitude: 0 }, 10);
    const south = boundingBox({ latitude: -60, longitude: 0 }, 10);

    expect(south.maxLongitude - south.minLongitude).toBeGreaterThan(
      equator.maxLongitude - equator.minLongitude,
    );
  });

  it("never excludes a point that is within the radius", () => {
    for (const radiusKm of [0.5, 5, 50, 100]) {
      const box = boundingBox(MANHUACU, radiusKm);

      for (let bearing = 0; bearing < 360; bearing += 5) {
        const angle = (bearing * Math.PI) / 180;
        const offsetKm = radiusKm * 0.999;
        const candidate = {
          latitude: MANHUACU.latitude + (offsetKm * Math.cos(angle)) / 111.195,
          longitude:
            MANHUACU.longitude +
            (offsetKm * Math.sin(angle)) /
              (111.195 * Math.cos((MANHUACU.latitude * Math.PI) / 180)),
        };

        if (distanceInKm(MANHUACU, candidate) > radiusKm) continue;

        expect(candidate.latitude).toBeGreaterThanOrEqual(box.minLatitude);
        expect(candidate.latitude).toBeLessThanOrEqual(box.maxLatitude);
        expect(candidate.longitude).toBeGreaterThanOrEqual(box.minLongitude);
        expect(candidate.longitude).toBeLessThanOrEqual(box.maxLongitude);
      }
    }
  });

  it("does not blow up at the poles", () => {
    const box = boundingBox({ latitude: 90, longitude: 0 }, 10);

    expect(Number.isFinite(box.minLongitude)).toBe(true);
    expect(Number.isFinite(box.maxLongitude)).toBe(true);
  });
});
