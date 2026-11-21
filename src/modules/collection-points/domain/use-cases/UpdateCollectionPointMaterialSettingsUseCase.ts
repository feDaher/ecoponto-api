import { AppError } from "../../../../shared/errors/AppError";
import { assertOwnerOrAdmin, type Principal } from "../../../../shared/security/access-policy";
import type {
  ICollectionPointRepository,
  UpdateCollectionPointMaterialSettings,
} from "../repositories/ICollectionPointRepository";

export interface UpdateCollectionPointMaterialSettingsInput extends UpdateCollectionPointMaterialSettings {
  pointId: string;
  categoryId: string;
  requester: Principal;
}

export class UpdateCollectionPointMaterialSettingsUseCase {
  constructor(private readonly points: ICollectionPointRepository) {}

  async execute({
    pointId,
    categoryId,
    requester,
    ...settings
  }: UpdateCollectionPointMaterialSettingsInput) {
    const point = await this.points.findSummaryById(pointId);
    if (!point) throw new AppError("Collection point not found", 404);

    assertOwnerOrAdmin(
      requester,
      point.collectorId,
      "You can only manage your own collection points",
    );

    const updated = await this.points.updateMaterialSettings(pointId, categoryId, settings);
    if (!updated) throw new AppError("This collection point does not accept this category", 404);

    return updated;
  }
}
