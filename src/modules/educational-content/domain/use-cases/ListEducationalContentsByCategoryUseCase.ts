import type { IEducationalContentRepository } from "../repositories/IEducationalContentRepository";

export class ListEducationalContentByCategoryUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  execute(categoryId: string) {
    return this.educationalContentRepository.findByCategory(categoryId);
  }
}
