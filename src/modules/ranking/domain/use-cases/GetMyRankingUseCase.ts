import { toPublicAuthorName } from "../../../reviews/domain/entities/Review";
import type { MyRanking, RankingFilters } from "../entities/RankingEntry";
import type { IRankingRepository } from "../repositories/IRankingRepository";

export interface GetMyRankingInput extends RankingFilters {
  /** The authenticated citizen, already loaded by the `authenticate` middleware. */
  citizen: { id: string; name: string; city: string };
}

/**
 * The authenticated citizen's position, so the apps can highlight it without the public ranking
 * exposing user ids. Uses the same competition ranking as `GET /ranking`.
 */
export class GetMyRankingUseCase {
  constructor(private readonly rankingRepository: IRankingRepository) {}

  async execute({ citizen, city }: GetMyRankingInput): Promise<MyRanking> {
    const points = await this.rankingRepository.sumConfirmedPoints(citizen.id);

    // Citizens without confirmed points, or outside the filtered city, are not in that ranking.
    const competes = points > 0 && (!city || sameCity(citizen.city, city));
    const position = competes
      ? (await this.rankingRepository.countAbove(points, { city })) + 1
      : null;

    return { position, name: toPublicAuthorName(citizen.name), city: citizen.city, points };
  }
}

function sameCity(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" }) === 0;
}
