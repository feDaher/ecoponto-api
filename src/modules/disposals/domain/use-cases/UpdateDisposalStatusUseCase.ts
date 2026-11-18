import { DisposalStatus } from "../../../../generated/prisma/enums";
import { AppError } from "../../../../shared/errors/AppError";
import { assertOwnerOrAdmin, type Principal } from "../../../../shared/security/access-policy";
import { calculatePoints } from "../rules/points-rules";
import type { IDisposalRepository } from "../repositories/IDisposalRepository";

export interface UpdateDisposalStatusInput {
  id: string;
  status: typeof DisposalStatus.CONFIRMED | typeof DisposalStatus.CANCELLED;
  requester: Principal;
}

export class UpdateDisposalStatusUseCase {
  constructor(private readonly disposalRepository: IDisposalRepository) {}

  async execute({ id, status, requester }: UpdateDisposalStatusInput) {
    const disposal = await this.disposalRepository.findById(id);

    if (!disposal) {
      throw new AppError("Disposal not found", 404);
    }

    assertOwnerOrAdmin(
      requester,
      disposal.collectionPoint.collectorId,
      "You can only manage disposals delivered to your own collection points",
    );

    if (disposal.status !== DisposalStatus.PENDING) {
      throw new AppError(`Disposal is already ${disposal.status}`, 409);
    }

    const pointsEarned =
      status === DisposalStatus.CONFIRMED ? calculatePoints(disposal.weightKg) : 0;
    const changed = await this.disposalRepository.transitionFromPending(id, {
      status,
      pointsEarned,
    });

    if (!changed) {
      throw new AppError("Disposal was already updated by someone else", 409);
    }

    return { ...disposal, status, pointsEarned };
  }
}
