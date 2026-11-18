import type { Request, Response } from "express";
import type { z } from "zod";
import { PrismaEducationalContentRepository } from "../infra/repositories/PrismaEducationalContentRepository";
import { CreateEducationalContentUseCase } from "../domain/use-cases/CreateEducationalContentUseCase";
import { ListEducationalContentsUseCase } from "../domain/use-cases/ListEducationalContentsUseCase";
import { FindEducationalContentByIdUseCase } from "../domain/use-cases/FindEducationalContentByIdUseCase";
import { UpdateEducationalContentUseCase } from "../domain/use-cases/UpdateEducationalContentUseCase";
import { DeleteEducationalContentUseCase } from "../domain/use-cases/DeleteEducationalContentUseCase";
import { ListEducationalContentByCategoryUseCase } from "../domain/use-cases/ListEducationalContentsByCategoryUseCase";
import { GetFeaturedEducationalContentUseCase } from "../domain/use-cases/GetFeaturedEducationalContentUseCase";
import { ListManagedEducationalContentsUseCase } from "../domain/use-cases/ListManagedEducationalContentsUseCase";
import { FindManagedEducationalContentUseCase } from "../domain/use-cases/FindManagedEducationalContentUseCase";
import { GetEducationalContentStatsUseCase } from "../domain/use-cases/GetEducationalContentStatsUseCase";
import { PrismaWasteCategoryRepository } from "../../waste-categories/infra/repositories/PrismaWasteCategoryRepository";
import type {
  createEducationalContentSchema,
  listEducationalContentsQuerySchema,
  listManagedEducationalContentsQuerySchema,
  updateEducationalContentSchema,
} from "./educational-content.validators";

const wasteCategoryRepository = new PrismaWasteCategoryRepository();

const educationalContentRepository = new PrismaEducationalContentRepository();

const createEducationalContentUseCase = new CreateEducationalContentUseCase(
  educationalContentRepository,
  wasteCategoryRepository,
);
const listEducationalContentsUseCase = new ListEducationalContentsUseCase(
  educationalContentRepository,
);
const findEducationalContentByIdUseCase = new FindEducationalContentByIdUseCase(
  educationalContentRepository,
);
const updateEducationalContentUseCase = new UpdateEducationalContentUseCase(
  educationalContentRepository,
  wasteCategoryRepository,
);
const deleteEducationalContentUseCase = new DeleteEducationalContentUseCase(
  educationalContentRepository,
);
const ListEducationalContentsByCategoryUseCase = new ListEducationalContentByCategoryUseCase(
  educationalContentRepository,
);
const getFeaturedEducationalContentUseCase = new GetFeaturedEducationalContentUseCase(
  educationalContentRepository,
);
const listManagedEducationalContentsUseCase = new ListManagedEducationalContentsUseCase(
  educationalContentRepository,
);
const findManagedEducationalContentUseCase = new FindManagedEducationalContentUseCase(
  educationalContentRepository,
);
const getEducationalContentStatsUseCase = new GetEducationalContentStatsUseCase(
  educationalContentRepository,
);

export async function createEducationalContent(req: Request, res: Response) {
  const content = await createEducationalContentUseCase.execute(
    req.body as z.infer<typeof createEducationalContentSchema>,
  );
  res.status(201).json(content);
}

export async function listEducationalContents(req: Request, res: Response) {
  const list = await listEducationalContentsUseCase.execute(
    req.query as z.infer<typeof listEducationalContentsQuerySchema>,
  );
  res.status(200).json(list);
}

export async function findEducationalContentById(req: Request<{ id: string }>, res: Response) {
  const content = await findEducationalContentByIdUseCase.execute(req.params.id);
  res.status(200).json(content);
}

export async function updateEducationalContent(req: Request<{ id: string }>, res: Response) {
  const updateContent = await updateEducationalContentUseCase.execute(
    req.params.id,
    req.body as z.infer<typeof updateEducationalContentSchema>,
  );
  res.status(200).json(updateContent);
}

export async function deleteEducationalContent(req: Request<{ id: string }>, res: Response) {
  await deleteEducationalContentUseCase.execute(req.params.id);
  res.status(204).send();
}

export async function listEducationalContentsByCategory(
  req: Request<{ categoryId: string }>,
  res: Response,
) {
  const listContent = await ListEducationalContentsByCategoryUseCase.execute(req.params.categoryId);
  res.status(200).json(listContent);
}

export async function getFeaturedEducationalContent(_req: Request, res: Response) {
  const content = await getFeaturedEducationalContentUseCase.execute();
  res.status(200).json(content);
}

export async function listManagedEducationalContents(req: Request, res: Response) {
  const page = await listManagedEducationalContentsUseCase.execute(
    req.query as unknown as z.infer<typeof listManagedEducationalContentsQuerySchema>,
  );
  res.status(200).json(page);
}

export async function findManagedEducationalContent(req: Request<{ id: string }>, res: Response) {
  const content = await findManagedEducationalContentUseCase.execute(req.params.id);
  res.status(200).json(content);
}

export async function getEducationalContentStats(_req: Request, res: Response) {
  const stats = await getEducationalContentStatsUseCase.execute();
  res.status(200).json(stats);
}
