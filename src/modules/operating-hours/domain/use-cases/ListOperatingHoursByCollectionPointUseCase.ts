import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";

export interface ListOperatingHoursByCollectionPointInput {
  collectionPointId: string;
}

export class ListOperatingHoursByCollectionPointUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  execute({ collectionPointId }: ListOperatingHoursByCollectionPointInput) {
    return this.operatingHoursRepository.findByCollectionPointId(collectionPointId);
  }
}
