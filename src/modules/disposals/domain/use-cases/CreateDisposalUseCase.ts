import { CollectionPointStatus } from "../../../../generated/prisma/enums";
import { AppError } from "../../../../shared/errors/AppError";
import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
import { roundWeight } from "../rules/points-rules";
import type { IDisposalRepository } from "../repositories/IDisposalRepository";

export interface CreateDisposalInput {
  citizenId: string;
  collectionPointId: string;
  categoryId: string;
  weightKg: number;
  disposedAt?: Date;
}

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
// A disposal is logged around the time of the delivery; older dates would let points be farmed
// for deliveries nobody can check anymore.
export const MAX_BACKDATE_DAYS = 30;
const MAX_BACKDATE_MS = MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000;

export class CreateDisposalUseCase {
  constructor(
    private readonly disposalRepository: IDisposalRepository,
    private readonly wasteCategoryRepository: IWasteCategoryRepository,
  ) {}

  async execute(input: CreateDisposalInput) {
    const now = Date.now();
    const disposedAt = input.disposedAt ?? new Date(now);

    if (disposedAt.getTime() > now + FUTURE_TOLERANCE_MS) {
      throw new AppError("Disposal date cannot be in the future", 400);
    }

    if (disposedAt.getTime() < now - MAX_BACKDATE_MS) {
      throw new AppError(
        `Disposal date cannot be more than ${MAX_BACKDATE_DAYS} days in the past`,
        400,
      );
    }

    const weightKg = roundWeight(input.weightKg);

    if (weightKg <= 0) {
      throw new AppError("Weight must be greater than zero", 400);
    }

    const point = await this.disposalRepository.findPoint(input.collectionPointId);

    // A point that is not approved is invisible on the map, so it does not exist for citizens.
    if (!point || point.status !== CollectionPointStatus.APPROVED) {
      throw new AppError("Collection point not found", 404);
    }

    const category = await this.wasteCategoryRepository.findById(input.categoryId);

    if (!category) {
      throw new AppError("Waste category not found", 404);
    }

    const accepted = await this.disposalRepository.pointAcceptsCategory(point.id, category.id);

    if (!accepted) {
      throw new AppError("This collection point does not accept this waste category", 422);
    }

    // Starts PENDING with 0 points: points only exist once the collector confirms the delivery.
    return this.disposalRepository.create({
      citizenId: input.citizenId,
      collectionPointId: point.id,
      categoryId: category.id,
      weightKg,
      disposedAt,
    });
  }
}
