import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma";
import { CollectionPointStatus, Role, Weekday } from "../generated/prisma/enums";
import { wasteTypes } from "../modules/collection-points/presentation/collection-points.validators";
import { toTime } from "../shared/time/time-of-day";

const LOAD_PREFIX = "[LOAD] ";
const BATCH_SIZE = 500;
const DEFAULT_POINTS = 5000;

const cities = [
  { name: "Manhuaçu", latitude: -20.258, longitude: -42.0336, weight: 8 },
  { name: "Juiz de Fora", latitude: -21.7642, longitude: -43.3503, weight: 4 },
  { name: "Viçosa", latitude: -20.7546, longitude: -42.8825, weight: 2 },
  { name: "Ubá", latitude: -21.12, longitude: -42.94, weight: 2 },
  { name: "Muriaé", latitude: -21.13, longitude: -42.366, weight: 2 },
  { name: "Caratinga", latitude: -19.79, longitude: -42.139, weight: 2 },
  { name: "Ponte Nova", latitude: -20.416, longitude: -42.909, weight: 1 },
];

const operatingHours = [
  { weekday: Weekday.MONDAY, openTime: toTime("08:00"), closeTime: toTime("17:00") },
  { weekday: Weekday.TUESDAY, openTime: toTime("08:00"), closeTime: toTime("17:00") },
];

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickCity(random: () => number) {
  const total = cities.reduce((sum, city) => sum + city.weight, 0);
  let threshold = random() * total;

  for (const city of cities) {
    threshold -= city.weight;
    if (threshold <= 0) return city;
  }

  return cities[0];
}

function pickWasteTypes(random: () => number) {
  const count = 1 + Math.floor(random() * 4);
  return [...wasteTypes].sort(() => random() - 0.5).slice(0, count);
}

function pickStatus(random: () => number) {
  const roll = random();
  if (roll < 0.9) return CollectionPointStatus.APPROVED;
  return roll < 0.98 ? CollectionPointStatus.PENDING : CollectionPointStatus.REJECTED;
}

async function clean() {
  const where = { name: { startsWith: LOAD_PREFIX } };
  await prisma.pointCategory.deleteMany({ where: { point: where } });
  const { count } = await prisma.collectionPoint.deleteMany({ where });
  console.log(`Removed ${count} load-test collection points`);
}

async function populate(total: number) {
  const collector = await prisma.user.findFirst({ where: { role: Role.COLLECTOR } });

  if (!collector) {
    throw new Error("No COLLECTOR user found. Run `npm run db:seed` first.");
  }

  const categories = await prisma.wasteCategory.findMany({
    where: { name: { in: [...wasteTypes] }, active: true },
    select: { id: true, name: true },
  });
  const categoryIds = new Map(categories.map(({ id, name }) => [name, id]));

  if (categoryIds.size !== wasteTypes.length) {
    throw new Error("Missing waste categories. Run `npm run db:seed` first.");
  }

  await clean();

  const random = createRandom(20261104);

  for (let created = 0; created < total; created += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, total - created);

    const links: { pointId: string; categoryId: string }[] = [];
    const hours: ({ collectionPointId: string } & (typeof operatingHours)[number])[] = [];

    await prisma.collectionPoint.createMany({
      data: Array.from({ length: size }, (_, index) => {
        const city = pickCity(random);
        const number = created + index + 1;
        const id = randomUUID();

        for (const wasteType of pickWasteTypes(random)) {
          links.push({ pointId: id, categoryId: categoryIds.get(wasteType)! });
        }

        for (const hour of operatingHours) {
          hours.push({ collectionPointId: id, ...hour });
        }

        return {
          id,
          collectorId: collector.id,
          name: `${LOAD_PREFIX}Ponto ${number}`,
          city: city.name,
          address: `Rua ${number}, ${city.name}`,
          latitude: city.latitude + (random() - 0.5) * 0.16,
          longitude: city.longitude + (random() - 0.5) * 0.16,
          status: pickStatus(random),
        };
      }),
    });

    await prisma.pointCategory.createMany({ data: links });
    await prisma.operatingHours.createMany({ data: hours });

    console.log(`Inserted ${created + size}/${total}`);
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the load seed with NODE_ENV=production");
  }

  if (process.argv.includes("--clean")) {
    await clean();
    return;
  }

  const requested = Number(process.argv.find((argument) => /^\d+$/.test(argument)));
  await populate(Number.isInteger(requested) && requested > 0 ? requested : DEFAULT_POINTS);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
