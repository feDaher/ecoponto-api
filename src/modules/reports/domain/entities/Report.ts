import type { DisposalStatus } from "../../../../generated/prisma/enums";

export interface ReportFilter {
  from: string;
  to: string;
  categoryId?: string;
  region?: string;
  status?: DisposalStatus;
  search?: string;
  /**
   * Data scope set by the server from the authenticated user, never from the query string:
   * a COLLECTOR only sees disposals made at their own collection points.
   */
  collectorId?: string;
}

export type ExportScope = "general" | "category" | "geospatial" | "manifests";

export type ExportFormat = "csv" | "pdf" | "geojson" | "kml";

export interface DisposalRaw {
  id: string;
  disposedAt: Date;
  weightKg: number;
  pointsEarned: number;
  status: DisposalStatus;
  collectionId: string | null;
  categoryId: string;
  categoryName: string;
  collectionPointId: string;
  collectionPointName: string;
  collectionPointAddress: string;
  collectionPointCity: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
}

export interface ReportTotals {
  disposals: number;
  weightKg: number;
  points: number;
}

export interface Comparison {
  previousFrom: string;
  previousTo: string;
  weightKg: number;
  variationPercent: number | null;
}

export interface Co2Summary {
  avoidedKg: number;
  treesSaved: number;
}

export interface ActivePointsSummary {
  total: number;
}

/**
 * platform (ADMIN): every registered user / users created in the period.
 * collector (COLLECTOR): distinct citizens with a CONFIRMED disposal at the collector's points /
 * those whose first such disposal happened in the period. No personal data either way.
 */
export interface UsersSummary {
  scope: "platform" | "collector";
  total: number;
  newInPeriod: number;
}

export interface ReportSummary {
  filter: ReportFilter;
  totals: ReportTotals;
  comparison: Comparison;
  co2: Co2Summary;
  activePoints: ActivePointsSummary;
  users: UsersSummary;
}

export interface CategoryRow {
  categoryId: string;
  name: string;
  displayName: string;
  destinador: string | null;
  disposals: number;
  weightKg: number;
  percentage: number;
}

export interface PointRow {
  collectionPointId: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  latitude: number;
  longitude: number;
  weightKg: number;
  percentage: number;
}

export interface ManifestRow {
  protocol: string;
  disposedAt: string;
  collectionPointName: string;
  categoryName: string;
  categoryDisplayName: string;
  weightKg: number;
  pointsEarned: number;
  destinador: string | null;
  status: DisposalStatus;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FilterOptions {
  categories: { id: string; name: string; displayName: string }[];
  regions: string[];
  statuses: { value: DisposalStatus; label: string }[];
}

export interface ReportBundle {
  filter: ReportFilter;
  summary: ReportSummary;
  categories: CategoryRow[];
  points: PointRow[];
  manifests: ManifestRow[];
  manifestTotal: number;
}
