import { AppError } from "../../../../shared/errors/AppError";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";
import type { Weekday } from "../../../../generated/prisma/enums";
import {
  ensureCanManageCollectionPoint,
  type Requester,
} from "../policies/ensureCanManageCollectionPoint";

export interface CreateOperatingHoursInput {
  collectionPointId: string;
  weekday: Weekday;
  openTime: string;
  closeTime: string;
  requester: Requester;
}

export class CreateOperatingHoursUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  async execute({ requester, ...input }: CreateOperatingHoursInput) {
    await ensureCanManageCollectionPoint(
      this.operatingHoursRepository,
      input.collectionPointId,
      requester,
    );

    if (input.openTime >= input.closeTime) {
      throw new AppError("Opening time must be before closing time", 400);
    }

    const operatingHours = await this.operatingHoursRepository.create(input);
    await this.operatingHoursRepository.confirmHours(input.collectionPointId);

    return operatingHours;
  }
}
