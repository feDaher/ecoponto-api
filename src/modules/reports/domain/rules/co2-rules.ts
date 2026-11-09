import type { Co2Summary } from "../entities/Report";
import { round } from "./number-rules";

// Fatores de referência: quilogramas de CO2 evitados por quilograma de material reciclado. (Somemente estimativas enquanto não tem a tabela oficial)
export const CO2_FACTORS_KG_PER_KG: Record<string, number> = {
  BATTERIES: 1.71,
  CELL_PHONES: 1.4,
  COMPUTERS: 1.6,
  PRINTERS: 1.5,
  TELEVISIONS: 1.5,
  ELECTRONICS: 1.6,
  PLASTIC: 0.9,
  PAPER: 0.8,
  METALS: 1.2,
  GLASS: 0.4,
  COOKING_OIL: 0.6,
};

export const DEFAULT_CO2_FACTOR = 0.8;

// Aproximadamente quantos kg uma árvore absorve de CO2 por ano.
export const KG_CO2_PER_TREE = 14.2;

export function calculateCo2(weightKg: number, categoryCode: string): Co2Summary {
  const factor = CO2_FACTORS_KG_PER_KG[categoryCode] ?? DEFAULT_CO2_FACTOR;
  const avoidedKg = weightKg * factor;

  return {
    avoidedKg: round(avoidedKg, 2),
    treesSaved: round(avoidedKg / KG_CO2_PER_TREE, 0),
  };
}

export function calculateCo2ForRows(
  rows: { weightKg: number; categoryCode: string }[],
): Co2Summary {
  return rows.reduce<Co2Summary>(
    (accumulator, row) => {
      const result = calculateCo2(row.weightKg, row.categoryCode);
      return {
        avoidedKg: round(accumulator.avoidedKg + result.avoidedKg, 2),
        treesSaved: round(accumulator.treesSaved + result.treesSaved, 0),
      };
    },
    { avoidedKg: 0, treesSaved: 0 },
  );
}
