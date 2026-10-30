import type { DisposalStatus } from "../../../../generated/prisma/enums";

export interface Disposal {
  id: string;
  citizenId: string;
  collectionPointId: string;
  categoryId: string;
  weightKg: number;
  pointsEarned: number;
  status: DisposalStatus;
  disposedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  collectionPoint: {
    id: string;
    name: string;
    city: string;
    address: string;
    collectorId: string;
  };
  category: { id: string; name: string };
  // Only filled for the collector/admin views (data minimization, LGPD).
  citizen?: { id: string; name: string };
}

export interface DisposalPoint {
  id: string;
  collectorId: string;
  status: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  disposals: number;
  weightKg: number;
  points: number;
}

export interface DisposalSummary {
  totalDisposals: number;
  totalWeightKg: number;
  totalPoints: number;
  byCategory: CategorySummary[];
}
