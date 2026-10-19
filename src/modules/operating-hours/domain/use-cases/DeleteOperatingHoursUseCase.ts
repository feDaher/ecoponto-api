import { AppError } from "../../../../shared/errors/AppError";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";
import {
  ensureCanManageCollectionPoint,
  type Requester,
} from "../policies/ensureCanManageCollectionPoint";

export interface DeleteOperatingHoursInput {
  id: string;
  requester: Requester;
}

export class DeleteOperatingHoursUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  async execute({ id, requester }: DeleteOperatingHoursInput) {
    const operatingHours = await this.operatingHoursRepository.findById(id);

    if (!operatingHours) {
      throw new AppError("Operating hours not found", 404);
    }

    await ensureCanManageCollectionPoint(
      this.operatingHoursRepository,
      operatingHours.collectionPointId,
      requester,
    );

    await this.operatingHoursRepository.delete(id);
    await this.operatingHoursRepository.confirmHours(operatingHours.collectionPointId);
  }
}
