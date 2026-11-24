import { AppError } from "../../../../shared/errors/AppError";
import { assertOwnerOrAdmin, type Principal } from "../../../../shared/security/access-policy";
import { Role } from "../../../../generated/prisma/enums";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";

interface Input {
  pointId: string;
  requester: Principal;
}

export class ListPointCategoryReviewsUseCase {
  constructor(private readonly repository: ICollectionPointRepository) {}

  async execute({ pointId, requester }: Input) {
    const point = await this.repository.findSummaryById(pointId);
    if (!point) throw new AppError("Ponto de coleta não encontrado", 404);

    assertOwnerOrAdmin(requester, point.collectorId, "Sem permissão para ver este ponto");

    const reviews = await this.repository.listCategoryReviews(pointId);

    // The collector needs the decision and the reason; who decided is only shown to admins.
    if (requester.role === Role.ADMIN) return reviews;
    return reviews.map((review) => ({ ...review, reviewedBy: null }));
  }
}
