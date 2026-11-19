import { toPublicAuthorName } from "../../../reviews/domain/entities/Review";
import { assignPositions, type RankingEntry, type RankingFilters } from "../entities/RankingEntry";
import type { IRankingRepository } from "../repositories/IRankingRepository";

export interface GetRankingInput extends RankingFilters {
  limit: number;
}

/**
 * RB09 — public ranking of correct disposal. Points come only from CONFIRMED disposals, the
 * same rule as `GET /disposals/me/summary`, so a citizen's score matches their own history.
 */
export class GetRankingUseCase {
  constructor(private readonly rankingRepository: IRankingRepository) {}

  async execute({ city, limit }: GetRankingInput): Promise<RankingEntry[]> {
    const scores = await this.rankingRepository.findTopScores({ city }, limit);

    return assignPositions(scores).map(({ position, name, city: entryCity, points }) => ({
      position,
      name: toPublicAuthorName(name),
      city: entryCity,
      points,
    }));
  }
}
