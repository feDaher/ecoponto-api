import { AppError } from "../../../../shared/errors/AppError";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";
import type { Weekday } from "../../../../generated/prisma/enums";

export interface UpdateOperatingHoursInput {
  id: string;
  weekday?: Weekday;
  openTime?: string;
  closeTime?: string;
}

export class UpdateOperatingHoursUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  async execute({ id, ...data }: UpdateOperatingHoursInput) {
    const operatingHours = await this.operatingHoursRepository.findById(id);

    if (!operatingHours) {
      throw new AppError("Operating hours not found", 404);
    }

    const openTime = data.openTime ?? operatingHours.openTime;
    const closeTime = data.closeTime ?? operatingHours.closeTime;

    if (openTime >= closeTime) {
      throw new AppError("Opening time must be before closing time", 400);
    }

    return this.operatingHoursRepository.update(id, data);
  }
}
