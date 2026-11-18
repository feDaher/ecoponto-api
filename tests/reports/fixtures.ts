export interface FixtureCategory {
  id: string;
  name: string;
}

export interface FixturePoint {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  status: string;
  geolocation: { neighborhood: string | null; city: string; state: string } | null;
}

export interface FixtureDisposal {
  id: string;
  disposedAt: Date;
  weightKg: number;
  pointsEarned: number;
  status: string;
  collectionId: string | null;
  categoryId: string;
  category: FixtureCategory;
  collectionPointId: string;
  collectionPoint: FixturePoint;
}

export interface WhereClause {
  disposedAt?: { gte?: Date; lt?: Date };
  status?: string;
  categoryId?: string | { in: string[] };
  collectionPoint?: { is: { city: { contains: string } } };
}

export interface ReportWhere {
  AND?: WhereClause[];
}

export const fixtureCategories: FixtureCategory[] = [
  { id: "cat-batteries", name: "BATTERIES" },
  { id: "cat-paper", name: "PAPER" },
];

export const fixturePoints: FixturePoint[] = [
  {
    id: "point-central",
    name: "EcoPonto Central",
    address: "Praça Cordovil Pinto Coelho",
    city: "Manhuaçu",
    latitude: -20.5583,
    longitude: -42.8975,
    status: "APPROVED",
    geolocation: { neighborhood: "Centro", city: "Manhuaçu", state: "MG" },
  },
  {
    id: "point-pacheco",
    name: "Drogaria Pacheco",
    address: "Centro Comercial",
    city: "Manhuaçu",
    latitude: -20.5594,
    longitude: -42.8981,
    status: "APPROVED",
    geolocation: { neighborhood: "Centro", city: "Manhuaçu", state: "MG" },
  },
];

export const fixtureDisposals: FixtureDisposal[] = [
  {
    id: "d1",
    disposedAt: new Date("2025-10-24T18:42:00.000Z"),
    weightKg: 340.5,
    pointsEarned: 120,
    status: "CONFIRMED",
    collectionId: "col-1",
    categoryId: "cat-batteries",
    category: { id: "cat-batteries", name: "BATTERIES" },
    collectionPointId: "point-central",
    collectionPoint: fixturePoints[0],
  },
  {
    id: "d2",
    disposedAt: new Date("2025-09-15T14:00:00.000Z"),
    weightKg: 100,
    pointsEarned: 30,
    status: "CONFIRMED",
    collectionId: "col-2",
    categoryId: "cat-paper",
    category: { id: "cat-paper", name: "PAPER" },
    collectionPointId: "point-pacheco",
    collectionPoint: fixturePoints[1],
  },
  {
    id: "d3",
    disposedAt: new Date("2025-10-10T13:00:00.000Z"),
    weightKg: 50,
    pointsEarned: 10,
    status: "CANCELLED",
    collectionId: "col-3",
    categoryId: "cat-batteries",
    category: { id: "cat-batteries", name: "BATTERIES" },
    collectionPointId: "point-central",
    collectionPoint: fixturePoints[0],
  },
  {
    id: "d4",
    disposedAt: new Date("2025-11-01T02:30:00.000Z"),
    weightKg: 120,
    pointsEarned: 40,
    status: "CONFIRMED",
    collectionId: "col-4",
    categoryId: "cat-paper",
    category: { id: "cat-paper", name: "PAPER" },
    collectionPointId: "point-pacheco",
    collectionPoint: fixturePoints[1],
  },
  {
    id: "d5",
    disposedAt: new Date("2025-10-01T02:30:00.000Z"),
    weightKg: 60,
    pointsEarned: 15,
    status: "CONFIRMED",
    collectionId: "col-5",
    categoryId: "cat-paper",
    category: { id: "cat-paper", name: "PAPER" },
    collectionPointId: "point-pacheco",
    collectionPoint: fixturePoints[1],
  },
];

export function applyFilters(rows: FixtureDisposal[], where: ReportWhere): FixtureDisposal[] {
  const clauses = where.AND ?? [];

  return rows.filter((row) =>
    clauses.every((clause) => {
      if (clause.disposedAt) {
        if (clause.disposedAt.gte && row.disposedAt < clause.disposedAt.gte) return false;
        if (clause.disposedAt.lt && row.disposedAt >= clause.disposedAt.lt) return false;
      }

      if (clause.status && row.status !== clause.status) return false;

      if (clause.categoryId) {
        if (typeof clause.categoryId === "string") {
          if (row.categoryId !== clause.categoryId) return false;
        } else if (!clause.categoryId.in.includes(row.categoryId)) {
          return false;
        }
      }

      if (clause.collectionPoint?.is?.city?.contains) {
        const term = clause.collectionPoint.is.city.contains.toLowerCase();
        if (!row.collectionPoint.city.toLowerCase().includes(term)) return false;
      }

      return true;
    }),
  );
}

export function groupByCategory(rows: FixtureDisposal[]) {
  const grouped = new Map<
    string,
    { _count: { _all: number }; _sum: { weightKg: number; pointsEarned: number } }
  >();

  for (const row of rows) {
    const entry = grouped.get(row.categoryId) ?? {
      _count: { _all: 0 },
      _sum: { weightKg: 0, pointsEarned: 0 },
    };

    entry._count._all += 1;
    entry._sum.weightKg += row.weightKg;
    entry._sum.pointsEarned += row.pointsEarned;
    grouped.set(row.categoryId, entry);
  }

  return [...grouped.entries()].map(([categoryId, value]) => ({ categoryId, ...value }));
}

export function groupByPoint(rows: FixtureDisposal[]) {
  const grouped = new Map<string, { _count: { _all: number }; _sum: { weightKg: number } }>();

  for (const row of rows) {
    const entry = grouped.get(row.collectionPointId) ?? {
      _count: { _all: 0 },
      _sum: { weightKg: 0 },
    };

    entry._count._all += 1;
    entry._sum.weightKg += row.weightKg;
    grouped.set(row.collectionPointId, entry);
  }

  return [...grouped.entries()].map(([collectionPointId, value]) => ({
    collectionPointId,
    ...value,
  }));
}
