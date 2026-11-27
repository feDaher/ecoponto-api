import type {
  ModerationReview,
  NewReview,
  Page,
  PageRequest,
  PublicReview,
  ReviewVisibility,
} from "../entities/Review";

export interface ModerationFilters {
  visibility: ReviewVisibility;
  collectionPointId?: string;
}

export interface IReviewRepository {
  /** Só pontos aprovados têm ficha pública. */
  isCollectionPointPublic(collectionPointId: string): Promise<boolean>;
  findVisibleByCollectionPoint(
    collectionPointId: string,
    page: PageRequest,
  ): Promise<Page<PublicReview>>;
  findForModeration(filters: ModerationFilters, page: PageRequest): Promise<Page<ModerationReview>>;
  /** Avaliação do cidadão para o ponto, se houver (RB12: uma por cidadão por ponto). */
  findOwnReviewId(citizenId: string, collectionPointId: string): Promise<string | null>;
  create(review: NewReview): Promise<{
    review: PublicReview;
    created: boolean;
  }>;
  updateContent(id: string, content: Pick<NewReview, "rating" | "comment">): Promise<PublicReview>;
  exists(id: string): Promise<boolean>;
  setHidden(id: string, isHidden: boolean): Promise<ModerationReview>;
  delete(id: string): Promise<void>;
}
