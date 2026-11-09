import { AppError } from "../../../../shared/errors/AppError";
import type { IEducationalContentRepository } from "../repositories/IEducationalContentRepository";

export class FindEducationalContentByIdUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  async execute(id: string) {
    const content = await this.educationalContentRepository.findPublishedById(id);
    if (!content) {
      throw new AppError("Content not found", 404);
    }
    await this.educationalContentRepository.incrementViews(id);
    return { ...content, viewCount: content.viewCount + 1 };
  }
}
