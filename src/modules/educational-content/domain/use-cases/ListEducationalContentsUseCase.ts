import type { IEducationalContentRepository } from "../repositories/IEducationalContentRepository";

export class ListEducationalContentsUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  execute() {
    return this.educationalContentRepository.findMany();
  }
}
