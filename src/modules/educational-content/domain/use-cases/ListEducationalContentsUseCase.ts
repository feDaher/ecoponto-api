import type {
  IEducationalContentRepository,
  PublishedContentFilter,
} from "../repositories/IEducationalContentRepository";

export class ListEducationalContentsUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  execute(filter: PublishedContentFilter = {}) {
    return this.educationalContentRepository.findPublished(filter);
  }
}
