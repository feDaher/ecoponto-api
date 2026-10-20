import { AppError } from "../../../../shared/errors/AppError";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";
import type { Weekday } from "../../../../generated/prisma/enums";
import {
  ensureCanManageCollectionPoint,
  type Requester,
} from "../policies/ensureCanManageCollectionPoint";

export interface UpdateOperatingHoursInput {
  id: string;
  weekday?: Weekday;
  openTime?: string;
  closeTime?: string;
  requester: Requester;
}

export class UpdateOperatingHoursUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  async execute({ id, requester, ...data }: UpdateOperatingHoursInput) {
    const operatingHours = await this.operatingHoursRepository.findById(id);

    if (!operatingHours) {
      throw new AppError("Operating hours not found", 404);
    }

    await ensureCanManageCollectionPoint(
      this.operatingHoursRepository,
      operatingHours.collectionPointId,
      requester,
    );

    const openTime = data.openTime ?? operatingHours.openTime;
    const closeTime = data.closeTime ?? operatingHours.closeTime;

    if (openTime >= closeTime) {
      throw new AppError("Opening time must be before closing time", 400);
    }

    const updated = await this.operatingHoursRepository.update(id, data);
    await this.operatingHoursRepository.confirmHours(operatingHours.collectionPointId);

    return updated;
  }
}
