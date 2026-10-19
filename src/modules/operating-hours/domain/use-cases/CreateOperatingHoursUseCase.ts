import { AppError } from "../../../../shared/errors/AppError";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";
import type { Weekday } from "../../../../generated/prisma/enums";

export interface CreateOperatingHoursInput {
  collectionPointId: string;
  weekday: Weekday;
  openTime: string;
  closeTime: string;
}

export class CreateOperatingHoursUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  async execute(input: CreateOperatingHoursInput) {
    if (input.openTime >= input.closeTime) {
      throw new AppError("Opening time must be before closing time", 400);
    }

    return this.operatingHoursRepository.create(input);
  }
}
