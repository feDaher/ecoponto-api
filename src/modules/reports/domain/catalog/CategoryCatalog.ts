export interface CategoryEnrichment {
  displayName: string;
  destinador: string | null;
}

// Catálogo temporário até a criação das colunas no schema.

export const CATEGORY_ENRICHMENT: Record<string, CategoryEnrichment> = {
  BATTERIES: {
    displayName: "Baterias, Células de Lítio & Pilhas",
    destinador: "CicloLimpo Reversa",
  },
  CELL_PHONES: {
    displayName: "Smartphones & Telefonia Móvel",
    destinador: "TechRecycle MG",
  },
  COMPUTERS: {
    displayName: "Laptops, Placas-Mãe & Equipamentos TI",
    destinador: "E-Tec Reversa",
  },
  PRINTERS: {
    displayName: "Impressoras & Equipamentos de Impressão",
    destinador: "Minas Metais Reciclagem",
  },
  TELEVISIONS: {
    displayName: "Monitores CRT, Telas & Periféricos",
    destinador: "Minas Metais Reciclagem",
  },
  ELECTRONICS: {
    displayName: "Eletrônicos Diversos",
    destinador: null,
  },
  PLASTIC: {
    displayName: "Plásticos",
    destinador: null,
  },
  PAPER: {
    displayName: "Papéis e Papelão",
    destinador: null,
  },
  METALS: {
    displayName: "Metais",
    destinador: null,
  },
  GLASS: {
    displayName: "Vidro",
    destinador: null,
  },
  COOKING_OIL: {
    displayName: "Óleo de Cozinha",
    destinador: null,
  },
};

export function enrich(categoryCode: string): CategoryEnrichment {
  return (
    CATEGORY_ENRICHMENT[categoryCode] ?? {
      displayName: categoryCode,
      destinador: null,
    }
  );
}

export function matchesDestinador(categoryCode: string, term: string): boolean {
  const destinador = CATEGORY_ENRICHMENT[categoryCode]?.destinador;
  if (!destinador) return false;
  return destinador.toLowerCase().includes(term.toLowerCase());
}
