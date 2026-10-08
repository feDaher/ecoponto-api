import type { Request, Response } from "express";
import { CreateOperatingHoursUseCase } from "../domain/use-cases/CreateOperatingHoursUseCase";
import { DeleteOperatingHoursUseCase } from "../domain/use-cases/DeleteOperatingHoursUseCase";
import { ListOperatingHoursByCollectionPointUseCase } from "../domain/use-cases/ListOperatingHoursByCollectionPointUseCase";
import { UpdateOperatingHoursUseCase } from "../domain/use-cases/UpdateOperatingHoursUseCase";
import { PrismaOperatingHoursRepository } from "../infra/repositories/PrismaOperatingHoursRepository";

const operatingHoursRepository = new PrismaOperatingHoursRepository();
const createOperatingHoursUseCase = new CreateOperatingHoursUseCase(operatingHoursRepository);
const listOperatingHoursUseCase = new ListOperatingHoursByCollectionPointUseCase(
  operatingHoursRepository,
);
const updateOperatingHoursUseCase = new UpdateOperatingHoursUseCase(operatingHoursRepository);
const deleteOperatingHoursUseCase = new DeleteOperatingHoursUseCase(operatingHoursRepository);

export async function createOperatingHours(req: Request, res: Response) {
  const operatingHours = await createOperatingHoursUseCase.execute({
    collectionPointId: String(req.params.collectionPointId),
    ...req.body,
  });
  res.status(201).json(operatingHours);
}

export async function listOperatingHoursByCollectionPoint(req: Request, res: Response) {
  const operatingHours = await listOperatingHoursUseCase.execute({
    collectionPointId: String(req.params.collectionPointId),
  });
  res.status(200).json(operatingHours);
}

export async function updateOperatingHours(req: Request, res: Response) {
  const operatingHours = await updateOperatingHoursUseCase.execute({
    id: String(req.params.id),
    ...req.body,
  });
  res.status(200).json(operatingHours);
}

export async function deleteOperatingHours(req: Request, res: Response) {
  await deleteOperatingHoursUseCase.execute({ id: String(req.params.id) });
  res.status(204).send();
}
