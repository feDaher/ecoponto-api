import { AppError } from "../../../../shared/errors/AppError";
import { assertOwnerOrAdmin, type Principal } from "../../../../shared/security/access-policy";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";

interface Input {
  pointId: string;
  actor: Principal;
  wasteCategories: string[];
}

export class UpdatePointCategoriesUseCase {
  constructor(private readonly repository: ICollectionPointRepository) {}

  async execute({ pointId, actor, wasteCategories }: Input) {
    const point = await this.repository.findSummaryById(pointId);
    if (!point) throw new AppError("Ponto de coleta não encontrado", 404);

    assertOwnerOrAdmin(actor, point.collectorId, "Sem permissão para alterar este ponto");

    const requested = await this.repository.findActiveCategoriesByNames(wasteCategories);
    if (requested.length !== wasteCategories.length) {
      throw new AppError("Há categorias inexistentes ou inativas", 400);
    }

    const current = await this.repository.findCategoriesByPointId(pointId);
    const requestedIds = new Set(requested.map((c) => c.id));
    const currentIds = new Set(current.map((c) => c.categoryId));

    const removeIds = current
      .filter((c) => !requestedIds.has(c.categoryId))
      .map((c) => c.categoryId);
    const addIds = requested.filter((c) => !currentIds.has(c.id)).map((c) => c.id);

    const keepsApproved = current.some((c) => c.isApproved && requestedIds.has(c.categoryId));
    if (!keepsApproved) {
      throw new AppError("O ponto precisa manter ao menos uma categoria aprovada", 422);
    }

    await this.repository.applyCategoryChanges(pointId, { removeIds, addIds });

    return this.repository.findCategoriesByPointId(pointId);
  }
}
