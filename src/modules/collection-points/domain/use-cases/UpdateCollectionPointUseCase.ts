import { AppError } from "../../../../shared/errors/AppError";
import { assertOwner } from "../../../../shared/security/access-policy";
import type { Role } from "../../../../generated/prisma/enums";
import type { CollectionPoint, CollectionPointDraft } from "../entities/CollectionPoint";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";
import type { IWasteCategoryRepository } from "../../../waste-categories/domain/repositories/IWasteCategoryRepository";
import { ensureActiveWasteCategories } from "../policies/ensureActiveWasteCategories";
import type { ICollectionPointLocationResolver } from "../gateways/ICollectionPointLocationResolver";
export interface UpdateCollectionPointInput extends CollectionPointDraft {
  id: string;
  requester: { id: string; role: Role };
}
export class UpdateCollectionPointUseCase {
  constructor(
    private readonly points: ICollectionPointRepository,
    private readonly categories: IWasteCategoryRepository,
    private readonly location: ICollectionPointLocationResolver,
  ) {}
  async execute(input: UpdateCollectionPointInput): Promise<CollectionPoint> {
    const existing = await this.points.findSummaryById(input.id);
    if (!existing) throw new AppError("Ponto de coleta não encontrado", 404);
    assertOwner(
      input.requester,
      existing.collectorId,
      "Você só pode atualizar seus próprios pontos de coleta",
    );
    const categoryIds = await ensureActiveWasteCategories(this.categories, input.wasteCategories);
    const resolved = await this.location.execute({
      latitude: input.latitude,
      longitude: input.longitude,
      placeId: input.placeId,
    });
    const { id, requester: _requester, wasteCategories: _wasteCategories, ...pointData } = input;
    const { source, ...resolvedData } = resolved;
    return this.points.update(id, {
      ...pointData,
      ...resolvedData,
      locationSource: source,
      categoryIds,
    });
  }
}
