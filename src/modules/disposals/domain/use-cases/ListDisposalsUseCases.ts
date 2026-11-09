import type { DisposalFilters, IDisposalRepository } from "../repositories/IDisposalRepository";

export interface ListDisposalsInput {
  userId: string;
  filters: DisposalFilters;
  page: number;
  pageSize: number;
}

// Citizen history: only the requester's own records, ever.
export class ListCitizenDisposalsUseCase {
  constructor(private readonly disposalRepository: IDisposalRepository) {}

  execute({ userId, ...rest }: ListDisposalsInput) {
    return this.disposalRepository.findMany({ citizenId: userId, ...rest });
  }
}

// Collector view: disposals delivered to the points the collector owns.
export class ListCollectorDisposalsUseCase {
  constructor(private readonly disposalRepository: IDisposalRepository) {}

  execute({ userId, ...rest }: ListDisposalsInput) {
    return this.disposalRepository.findMany({ collectorId: userId, ...rest });
  }
}
