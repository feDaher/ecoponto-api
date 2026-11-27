/**
 * One line of the public ranking (RB09). LGPD minimization, same rule as the public reviews:
 * first name and city only — no user id, full name, email or phone.
 */
export interface RankingEntry {
  position: number;
  name: string;
  city: string;
  points: number;
}

/** The caller's own standing. `position` is null while they have no confirmed points. */
export interface MyRanking {
  position: number | null;
  name: string;
  city: string;
  points: number;
}

/** Points of one citizen, as aggregated from their CONFIRMED disposals. */
export interface CitizenScore {
  citizenId: string;
  name: string;
  city: string;
  points: number;
}

export interface RankingFilters {
  city?: string;
}

/**
 * Standard competition ranking ("1224"): citizens with the same points share a position and
 * the next one skips accordingly. `scores` must be sorted by points, highest first.
 */
export function assignPositions(scores: readonly CitizenScore[]): (CitizenScore & {
  position: number;
})[] {
  return scores.map((score) => ({
    ...score,
    // The first citizen with these points marks the shared position (the list is sorted).
    position: scores.findIndex((other) => other.points === score.points) + 1,
  }));
}
