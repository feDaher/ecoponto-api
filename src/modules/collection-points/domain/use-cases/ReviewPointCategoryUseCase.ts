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

  async execute({ pointId, categoryId, status, rejectionReason }: Input) {
    if (status === "REJECTED" && !rejectionReason?.trim()) {
      throw new AppError("Informe o motivo da rejeição", 400);
    }

    const categories = await this.repository.findCategoriesByPointId(pointId);
    const entry = categories.find((c) => c.categoryId === categoryId);
    if (!entry) throw new AppError("Categoria não encontrada neste ponto", 404);
    if (entry.isApproved) throw new AppError("Categoria já aprovada", 409);

    // The write only touches a link that is still PENDING: if another admin decided first, 409.
    const reviewed = await this.repository.reviewCategory(pointId, categoryId, status);
    if (!reviewed) throw new AppError("Categoria já revisada", 409);
  }
}
