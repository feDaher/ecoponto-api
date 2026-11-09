import { AppError } from "../../../../shared/errors/AppError";
import type { IEducationalContentRepository } from "../repositories/IEducationalContentRepository";

export class GetFeaturedEducationalContentUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  async execute() {
    const content = await this.educationalContentRepository.findFeatured();
    if (!content) {
      throw new AppError("No featured content", 404);
    }
    return content;
  }
}
