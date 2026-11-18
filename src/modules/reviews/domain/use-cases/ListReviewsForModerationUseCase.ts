import type { PageRequest } from "../entities/Review";
import type { IReviewRepository, ModerationFilters } from "../repositories/IReviewRepository";

export class ListReviewsForModerationUseCase {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  execute(filters: ModerationFilters, page: PageRequest) {
    return this.reviewRepository.findForModeration(filters, page);
  }
}
