import type { Request, Response } from "express";
import { PrismaCollectionPointRepository } from "../infra/repositories/PrismaCollectionPointRepository";
import { UpdatePointCategoriesUseCase } from "../domain/use-cases/UpdatePointCategoriesUseCase";
import { ListPendingCategoriesUseCase } from "../domain/use-cases/ListPendingCategoriesUseCase";
import { ReviewPointCategoryUseCase } from "../domain/use-cases/ReviewPointCategoryUseCase";

const pointRepository = new PrismaCollectionPointRepository();
const updateCategoriesUseCase = new UpdatePointCategoriesUseCase(pointRepository);
const listPendingCategoriesUseCase = new ListPendingCategoriesUseCase(pointRepository);
const reviewCategoryUseCase = new ReviewPointCategoryUseCase(pointRepository);

function paramFrom(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function updateCategories(req: Request, res: Response) {
  const result = await updateCategoriesUseCase.execute({
    pointId: paramFrom(req, "id"),
    actor: { id: req.user!.id, role: req.user!.role },
    wasteCategories: req.body.wasteCategories,
  });
  res.status(200).json(result);
}

export async function listPendingCategories(_req: Request, res: Response) {
  res.status(200).json(await listPendingCategoriesUseCase.execute());
}

export async function reviewCategory(req: Request, res: Response) {
  await reviewCategoryUseCase.execute({
    pointId: paramFrom(req, "id"),
    categoryId: paramFrom(req, "categoryId"),
    adminId: req.user!.id,
    status: req.body.status,
    rejectionReason: req.body.rejectionReason,
  });
  res.status(204).send();
}
