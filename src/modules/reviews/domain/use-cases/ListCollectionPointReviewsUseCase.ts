import { AppError } from "../../../../shared/errors/AppError";
import type { PageRequest } from "../entities/Review";
import type { IReviewRepository } from "../repositories/IReviewRepository";

export interface ListCollectionPointReviewsInput extends PageRequest {
  collectionPointId: string;
}

/** Ficha pública do ponto: só avaliações visíveis de pontos aprovados, sem login. */
export class ListCollectionPointReviewsUseCase {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute({ collectionPointId, limit, offset }: ListCollectionPointReviewsInput) {
    if (!(await this.reviewRepository.isCollectionPointPublic(collectionPointId))) {
      throw new AppError("Collection point not found", 404);
    }

    return this.reviewRepository.findVisibleByCollectionPoint(collectionPointId, {
      limit,
      offset,
    });
  }
}
