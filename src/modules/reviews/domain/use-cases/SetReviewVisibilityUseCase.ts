import { AppError } from "../../../../shared/errors/AppError";
import type { IReviewRepository } from "../repositories/IReviewRepository";

export interface SetReviewVisibilityInput {
  id: string;
  isHidden: boolean;
}

/**
 * Ocultar (ou reexibir) uma avaliação. Ocultar é a moderação reversível: a avaliação
 * some da ficha pública na hora, mas continua no banco para o admin desfazer o engano.
 * Idempotente: ocultar uma avaliação já oculta só devolve o estado atual.
 */
export class SetReviewVisibilityUseCase {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute({ id, isHidden }: SetReviewVisibilityInput) {
    if (!(await this.reviewRepository.exists(id))) {
      throw new AppError("Review not found", 404);
    }

    return this.reviewRepository.setHidden(id, isHidden);
  }
}
