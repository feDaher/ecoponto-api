import type { Request, Response } from "express";
import { CreateWasteCategoryUseCase } from "../domain/use-cases/CreateWasteCategoryUseCase";
import { DeactivateWasteCategoryUseCase } from "../domain/use-cases/DeactivateWasteCategoryUseCase";
import { ListWasteCategoriesUseCase } from "../domain/use-cases/ListWasteCategoriesUseCase";
import { UpdateWasteCategoryUseCase } from "../domain/use-cases/UpdateWasteCategoryUseCase";
import { PrismaWasteCategoryRepository } from "../infra/repositories/PrismaWasteCategoryRepository";

const wasteCategoryRepository = new PrismaWasteCategoryRepository();
const createWasteCategoryUseCase = new CreateWasteCategoryUseCase(wasteCategoryRepository);
const listWasteCategoriesUseCase = new ListWasteCategoriesUseCase(wasteCategoryRepository);
const updateWasteCategoryUseCase = new UpdateWasteCategoryUseCase(wasteCategoryRepository);
const deactivateWasteCategoryUseCase = new DeactivateWasteCategoryUseCase(wasteCategoryRepository);

export async function createWasteCategory(req: Request, res: Response) {
  const category = await createWasteCategoryUseCase.execute(req.body);
  res.status(201).json(category);
}

export async function listWasteCategories(_req: Request, res: Response) {
  const categories = await listWasteCategoriesUseCase.execute();
  res.status(200).json(categories);
}

export async function updateWasteCategory(req: Request, res: Response) {
  const category = await updateWasteCategoryUseCase.execute({
    id: String(req.params.id),
    name: req.body.name,
  });
  res.status(200).json(category);
}

export async function deactivateWasteCategory(req: Request, res: Response) {
  await deactivateWasteCategoryUseCase.execute({ id: String(req.params.id) });
  res.status(204).send();
}
