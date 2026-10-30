// Placeholder rule until the gamification module exists (docs: points consider waste type,
// quantity and frequency). Today: 10 points per kg, at least 1 point per confirmed disposal.
export const POINTS_PER_KG = 10;
export const MAX_WEIGHT_KG = 1000;

export function calculatePoints(weightKg: number) {
  return Math.max(1, Math.round(weightKg * POINTS_PER_KG));
}

// Decimal(10, 3) in the database: keep what we compute equal to what we store.
export function roundWeight(weightKg: number) {
  return Math.round(weightKg * 1000) / 1000;
}
