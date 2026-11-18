import type { IEducationalContentRepository } from "../repositories/IEducationalContentRepository";

export class GetEducationalContentStatsUseCase {
  constructor(private readonly educationalContentRepository: IEducationalContentRepository) {}
  execute(now: Date = new Date()) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.educationalContentRepository.getStats(monthStart);
  }
}
