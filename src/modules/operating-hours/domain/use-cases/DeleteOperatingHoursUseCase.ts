import { AppError } from "../../../../shared/errors/AppError";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";

export interface DeleteOperatingHoursInput {
  id: string;
}

export class DeleteOperatingHoursUseCase {
  constructor(private readonly operatingHoursRepository: IOperatingHoursRepository) {}

  async execute({ id }: DeleteOperatingHoursInput) {
    const operatingHours = await this.operatingHoursRepository.findById(id);

    if (!operatingHours) {
      throw new AppError("Operating hours not found", 404);
    }

    await this.operatingHoursRepository.delete(id);
  }
}
