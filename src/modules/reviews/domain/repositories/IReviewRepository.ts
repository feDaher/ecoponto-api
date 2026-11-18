import type {
  ModerationReview,
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
  exists(id: string): Promise<boolean>;
  setHidden(id: string, isHidden: boolean): Promise<ModerationReview>;
  delete(id: string): Promise<void>;
}
