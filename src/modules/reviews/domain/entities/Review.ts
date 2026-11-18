/** Avaliação como aparece na ficha pública do ponto: sem ids nem dados do autor além do primeiro nome. */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: Date;
}

/** Avaliação como o admin vê na moderação (inclui as ocultas). */
export interface ModerationReview {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string };
  collectionPoint: { id: string; name: string };
}

export const ReviewVisibility = {
  VISIBLE: "visible",
  HIDDEN: "hidden",
  ALL: "all",
} as const;

export type ReviewVisibility = (typeof ReviewVisibility)[keyof typeof ReviewVisibility];

export interface Page<T> {
  items: T[];
  total: number;
}

export interface PageRequest {
  limit: number;
  offset: number;
}

/**
 * LGPD (minimização): a ficha pública mostra só o primeiro nome de quem avaliou.
 * O nome completo e o id do cidadão ficam restritos à moderação.
 */
export function toPublicAuthorName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
