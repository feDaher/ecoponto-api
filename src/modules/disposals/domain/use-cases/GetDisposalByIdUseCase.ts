import { Role } from "../../../../generated/prisma/enums";
import { AppError } from "../../../../shared/errors/AppError";
import type { Principal } from "../../../../shared/security/access-policy";
import type { IDisposalRepository } from "../repositories/IDisposalRepository";

export class GetDisposalByIdUseCase {
  constructor(private readonly disposalRepository: IDisposalRepository) {}

  async execute({ id, requester }: { id: string; requester: Principal }) {
    const disposal = await this.disposalRepository.findById(id);

    if (!disposal) {
      throw new AppError("Disposal not found", 404);
    }

    const isDisposalOwner = disposal.citizenId === requester.id;
    const isPointOwner = disposal.collectionPoint.collectorId === requester.id;

    if (requester.role !== Role.ADMIN && !isDisposalOwner && !isPointOwner) {
      // 404 instead of 403: do not reveal that a record exists to someone who cannot see it.
      throw new AppError("Disposal not found", 404);
    }

    if (isDisposalOwner) {
      const ownView = { ...disposal };
      delete ownView.citizen;
      return ownView;
    }

    return disposal;
  }
}
