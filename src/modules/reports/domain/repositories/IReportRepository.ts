import type { DisposalRaw, ReportFilter } from "../entities/Report";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface CategoryAggregate {
  categoryId: string;
  disposals: number;
  weightKg: number;
  points: number;
}

export interface PointAggregate {
  collectionPointId: string;
  disposals: number;
  weightKg: number;
}

export interface PointDetail {
  id: string;
  name: string;
  address: string;
  city: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
}

export interface DisposalQueryOptions {
  skip?: number;
  take?: number;
  categoryIds?: string[];
}

export interface IReportRepository {
  listCategories(): Promise<CategoryOption[]>;
  listRegions(): Promise<string[]>;
  findDisposals(filter: ReportFilter, options?: DisposalQueryOptions): Promise<DisposalRaw[]>;
  countDisposals(filter: ReportFilter, categoryIds?: string[]): Promise<number>;
  sumByCategory(filter: ReportFilter, categoryIds?: string[]): Promise<CategoryAggregate[]>;
  sumByPoint(filter: ReportFilter, categoryIds?: string[]): Promise<PointAggregate[]>;
  findPointsByIds(ids: string[]): Promise<PointDetail[]>;
  countActivePoints(): Promise<number>;
}
