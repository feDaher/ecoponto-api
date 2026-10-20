import { AppError } from "../../../../shared/errors/AppError";
import { assertOwnerOrAdmin, type Principal } from "../../../../shared/security/access-policy";
import type { IOperatingHoursRepository } from "../repositories/IOperatingHoursRepository";

export type Requester = Principal;

export async function ensureCanManageCollectionPoint(
  repository: IOperatingHoursRepository,
  collectionPointId: string,
  requester: Requester,
) {
  const ownerId = await repository.findCollectionPointOwnerId(collectionPointId);

  if (!ownerId) {
    throw new AppError("Collection point not found", 404);
  }

  assertOwnerOrAdmin(requester, ownerId, "You can only manage your own collection points");
}
