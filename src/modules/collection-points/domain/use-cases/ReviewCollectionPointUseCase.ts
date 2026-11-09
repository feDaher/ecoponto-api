import { AppError } from "../../../../shared/errors/AppError";
import type { CollectionPoint, CollectionPointStatus } from "../entities/CollectionPoint";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";
export interface ReviewCollectionPointInput {
  id: string;
  status: Extract<CollectionPointStatus, "APPROVED" | "REJECTED">;
  rejectionReason?: string;
  reviewerId: string;
}
export class ReviewCollectionPointUseCase {
  constructor(private readonly points: ICollectionPointRepository) {}
  async execute(input: ReviewCollectionPointInput): Promise<CollectionPoint> {
    const existing = await this.points.findById(input.id);
    if (!existing) throw new AppError("Ponto de coleta não encontrado", 404);
    if (existing.status !== "PENDING")
      throw new AppError("Apenas pontos de coleta pendentes podem ser revisados", 400);
    return this.points.review(input.id, {
      status: input.status,
      rejectionReason: input.status === "REJECTED" ? input.rejectionReason! : null,
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
    });
  }
}
