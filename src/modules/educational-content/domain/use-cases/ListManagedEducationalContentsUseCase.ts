import type {
  IEducationalContentRepository,
  ManagedContentFilter,
} from "../repositories/IEducationalContentRepository";

export class ListManagedEducationalContentsUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  execute(filter: ManagedContentFilter) {
    return this.educationalContentRepository.findManaged(filter);
  }
}
