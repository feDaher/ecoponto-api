import type { IDisposalRepository } from "../repositories/IDisposalRepository";

export class GetCitizenSummaryUseCase {
  constructor(private readonly disposalRepository: IDisposalRepository) {}

  // Only CONFIRMED disposals count: pending/cancelled ones never earned anything.
  execute({ citizenId, from, to }: { citizenId: string; from?: Date; to?: Date }) {
    return this.disposalRepository.summarizeConfirmedByCitizen(citizenId, { from, to });
  }
}
