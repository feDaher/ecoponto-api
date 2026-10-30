import type { DisposalStatus } from "../../../../generated/prisma/enums";
import type { Disposal, DisposalPoint, DisposalSummary, Paginated } from "../entities/Disposal";

export interface CreateDisposalData {
  citizenId: string;
  collectionPointId: string;
  categoryId: string;
  weightKg: number;
  disposedAt: Date;
}

export interface DisposalFilters {
  status?: DisposalStatus;
  categoryId?: string;
  collectionPointId?: string;
  from?: Date;
  to?: Date;
}

export interface ListDisposalsParams {
  // Exactly one scope is set by the use case: the citizen's own history or the collector's points.
  citizenId?: string;
  collectorId?: string;
  filters: DisposalFilters;
  page: number;
  pageSize: number;
}

export interface IDisposalRepository {
  findPoint(id: string): Promise<DisposalPoint | null>;
  pointAcceptsCategory(pointId: string, categoryName: string): Promise<boolean>;
  create(data: CreateDisposalData): Promise<Disposal>;
  findById(id: string): Promise<Disposal | null>;
  findMany(params: ListDisposalsParams): Promise<Paginated<Disposal>>;
  // Only PENDING records can change. Returns false when it was no longer PENDING (race-safe).
  transitionFromPending(
    id: string,
    data: { status: DisposalStatus; pointsEarned: number },
  ): Promise<boolean>;
  summarizeConfirmedByCitizen(
    citizenId: string,
    range: { from?: Date; to?: Date },
  ): Promise<DisposalSummary>;
}
