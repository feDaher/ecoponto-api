import { AppError } from "../../../../shared/errors/AppError";
import type { PublicReview } from "../entities/Review";
import type { IReviewRepository } from "../repositories/IReviewRepository";

export interface PublishReviewInput {
  citizenId: string;
  collectionPointId: string;
  rating: number;
  comment: string | null;
}

export interface PublishReviewResult {
  review: PublicReview;
  /** `false` quando o cidadão já tinha avaliado o ponto e a avaliação foi atualizada. */
  created: boolean;
}

/**
 * RB12 — cidadão autenticado avalia um ponto aprovado.
 *
 * Uma avaliação por cidadão por ponto: avaliar de novo substitui nota e comentário, para que a
 * média não possa ser inflada repetindo o envio. A avaliação já nasce visível; a moderação do
 * admin é posterior (ocultar/remover).
 */
export class PublishReviewUseCase {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute({
    citizenId,
    collectionPointId,
    rating,
    comment,
  }: PublishReviewInput): Promise<PublishReviewResult> {
    if (!(await this.reviewRepository.isCollectionPointPublic(collectionPointId))) {
      throw new AppError("Collection point not found", 404);
    }

    const ownReviewId = await this.reviewRepository.findOwnReviewId(citizenId, collectionPointId);

    if (ownReviewId) {
      const review = await this.reviewRepository.updateContent(ownReviewId, { rating, comment });
      return { review, created: false };
    }

    const review = await this.reviewRepository.create({
      citizenId,
      collectionPointId,
      rating,
      comment,
    });
    return { review, created: true };
  }
}
