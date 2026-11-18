import { AppError } from "../../../../shared/errors/AppError";
import type { CollectionPoint } from "../entities/CollectionPoint";
import type { ICollectionPointRepository } from "../repositories/ICollectionPointRepository";
export class FindApprovedCollectionPointByIdUseCase {
  constructor(private readonly points: ICollectionPointRepository) {}
  async execute(id: string): Promise<CollectionPoint> {
    const point = await this.points.findApprovedById(id);
    if (!point) throw new AppError("Ponto de coleta não encontrado", 404);
    return point;
  }
}
