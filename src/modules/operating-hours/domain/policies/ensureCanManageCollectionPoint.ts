import { Role } from "../../../../generated/prisma/enums";
import { AppError } from "../../../../shared/errors/AppError";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";

export interface Requester {
  id: string;
  role: Role;
}

export async function ensureCanManageCollectionPoint(
  repository: IOperatingHoursRepository,
  collectionPointId: string,
  requester: Requester,
) {
  const ownerId = await repository.findCollectionPointOwnerId(collectionPointId);

  if (!ownerId) {
    throw new AppError("Collection point not found", 404);
  }

  if (requester.role !== Role.ADMIN && ownerId !== requester.id) {
    throw new AppError("You can only manage your own collection points", 403);
  }
}
