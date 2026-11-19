import type { CitizenScore, RankingFilters } from "../entities/RankingEntry";

export interface IRankingRepository {
  /** Citizens with confirmed points, highest first (ties broken by citizen id, for stable pages). */
  findTopScores(filters: RankingFilters, limit: number): Promise<CitizenScore[]>;

  /** Sum of the citizen's CONFIRMED disposal points (0 when they have none). */
  sumConfirmedPoints(citizenId: string): Promise<number>;

  /** How many citizens have strictly more confirmed points than `points`. */
  countAbove(points: number, filters: RankingFilters): Promise<number>;
}
