import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";

const OUTDATED_AFTER_DAYS = 60;

export class FlagOutdatedHoursUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  execute(now: Date = new Date()) {
    const limit = new Date(now);
    limit.setDate(limit.getDate() - OUTDATED_AFTER_DAYS);

    return this.operatingHoursRepository.markOutdatedBefore(limit);
  }
}
