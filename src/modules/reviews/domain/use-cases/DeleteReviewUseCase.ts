import { AppError } from "../../../../shared/errors/AppError";
import type { IReviewRepository } from "../repositories/IReviewRepository";

/** Remoção definitiva, para conteúdo que não deve ficar guardado (ex.: dados pessoais no comentário). */
export class DeleteReviewUseCase {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute(id: string) {
    if (!(await this.reviewRepository.exists(id))) {
      throw new AppError("Review not found", 404);
    }

    await this.reviewRepository.delete(id);
  }
}
