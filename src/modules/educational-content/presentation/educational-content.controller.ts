import type { Request, Response } from "express";
import { PrismaEducationalContentRepository } from "../infra/repositories/PrismaEducationalContentRepository";
import { CreateEducationalContentUseCase } from "../domain/use-cases/CreateEducationalContentUseCase";
import { ListEducationalContentsUseCase } from "../domain/use-cases/ListEducationalContentsUseCase";
import { FindEducationalContentByIdUseCase } from "../domain/use-cases/FindEducationalContentByIdUseCase";
import { UpdateEducationalContentUseCase } from "../domain/use-cases/UpdateEducationalContentUseCase";
import { DeleteEducationalContentUseCase } from "../domain/use-cases/DeleteEducationalContentUseCase";

const educationalContentRepository = new PrismaEducationalContentRepository();
const createEducationaContentUseCase = new CreateEducationalContentUseCase(
  educationalContentRepository,
);
const listEducationalContentsUseCase = new ListEducationalContentsUseCase(
  educationalContentRepository,
);
const findEducationalContentByIdUseCase = new FindEducationalContentByIdUseCase(
  educationalContentRepository,
);
const updateEducationalContentUseCase = new UpdateEducationalContentUseCase(
  educationalContentRepository,
);
const deleteEducationalContentUseCase = new DeleteEducationalContentUseCase(
  educationalContentRepository,
);

export async function createEducationalContent(req: Request, res: Response) {
  const content = await createEducationaContentUseCase.execute(req.body.title, req.body.content);
  res.status(201).json(content);
}

export async function listEducationalContents(req: Request, res: Response) {
  const list = await listEducationalContentsUseCase.execute();
  res.status(200).json(list);
}

export async function findEducationalContentById(req: Request<{ id: string }>, res: Response) {
  const content = await findEducationalContentByIdUseCase.execute(req.params.id);
  res.status(200).json(content);
}

export async function updateEducationalContent(req: Request<{ id: string }>, res: Response) {
  const updateContent = await updateEducationalContentUseCase.execute(req.params.id, req.body);
  res.status(200).json(updateContent);
}

export async function deleteEducationalContent(req: Request<{ id: string }>, res: Response) {
  const deletedContent = await deleteEducationalContentUseCase.execute(req.params.id);
  res.status(200).json(deletedContent);
}
