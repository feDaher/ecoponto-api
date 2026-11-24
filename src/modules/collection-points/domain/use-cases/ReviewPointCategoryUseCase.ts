import { AppError } from "../../../../shared/errors/AppError";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";

interface Input {
  pointId: string;
  categoryId: string;
  adminId: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

export class ReviewPointCategoryUseCase {
  constructor(private readonly repository: ICollectionPointRepository) {}

  async execute({ pointId, categoryId, adminId, status, rejectionReason }: Input) {
    const reason = rejectionReason?.trim();
    if (status === "REJECTED" && !reason) {
      throw new AppError("Informe o motivo da rejeição", 400);
    }

    const categories = await this.repository.findCategoriesByPointId(pointId);
    const entry = categories.find((c) => c.categoryId === categoryId);
    if (!entry) throw new AppError("Categoria não encontrada neste ponto", 404);
    if (entry.isApproved) throw new AppError("Categoria já aprovada", 409);

    // The write only touches a link that is still PENDING: if another admin decided first, 409.
    // The decision (and the reason, for a rejection) goes to the review history in the same
    // transaction, since rejecting deletes the link itself.
    const reviewed = await this.repository.reviewCategory(pointId, categoryId, {
      decision: status,
      reason: status === "REJECTED" ? reason! : null,
      reviewedById: adminId,
    });
    if (!reviewed) throw new AppError("Categoria já revisada", 409);
  }
}
