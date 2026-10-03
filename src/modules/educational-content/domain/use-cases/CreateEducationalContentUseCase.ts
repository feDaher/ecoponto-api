import type { IEducationalContentRepository } from "../repositories/IEducationalContentRepository";

export interface CreateEducationalContentInput {
  title: string;
  content: string;
}

export class CreateEducationalContentUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  execute(title: string, content: string) {
    return this.educationalContentRepository.create({
      title,
      content,
    });
  }
}
