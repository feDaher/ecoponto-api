import type { Request, Response } from "express";
import type { z } from "zod";
import { PrismaWasteCategoryRepository } from "../../waste-categories/infra/repositories/PrismaWasteCategoryRepository";
import { CreateDisposalUseCase } from "../domain/use-cases/CreateDisposalUseCase";
import { GetCitizenSummaryUseCase } from "../domain/use-cases/GetCitizenSummaryUseCase";
import { GetDisposalByIdUseCase } from "../domain/use-cases/GetDisposalByIdUseCase";
import {
  ListCitizenDisposalsUseCase,
  ListCollectorDisposalsUseCase,
} from "../domain/use-cases/ListDisposalsUseCases";
import { UpdateDisposalStatusUseCase } from "../domain/use-cases/UpdateDisposalStatusUseCase";
import { PrismaDisposalRepository } from "../infra/repositories/PrismaDisposalRepository";
import type { listDisposalsQuerySchema, summaryQuerySchema } from "./disposals.validators";

const disposalRepository = new PrismaDisposalRepository();
const wasteCategoryRepository = new PrismaWasteCategoryRepository();

const createDisposalUseCase = new CreateDisposalUseCase(
  disposalRepository,
  wasteCategoryRepository,
);
const listCitizenDisposalsUseCase = new ListCitizenDisposalsUseCase(disposalRepository);
const listCollectorDisposalsUseCase = new ListCollectorDisposalsUseCase(disposalRepository);
const getDisposalByIdUseCase = new GetDisposalByIdUseCase(disposalRepository);
const updateDisposalStatusUseCase = new UpdateDisposalStatusUseCase(disposalRepository);
const getCitizenSummaryUseCase = new GetCitizenSummaryUseCase(disposalRepository);

// `validate(..., "query")` already replaced req.query with the parsed (typed) values.
const parsedQuery = <T extends z.ZodType>(req: Request) => req.query as unknown as z.output<T>;

function splitListQuery(req: Request) {
  const { page, pageSize, ...filters } = parsedQuery<typeof listDisposalsQuerySchema>(req);
  return { filters, page, pageSize };
}

export async function createDisposal(req: Request, res: Response) {
  // The citizen is always the authenticated user: a client-sent citizenId is never accepted.
  const disposal = await createDisposalUseCase.execute({ ...req.body, citizenId: req.user!.id });
  res.status(201).json(disposal);
}

export async function listMyDisposals(req: Request, res: Response) {
  const result = await listCitizenDisposalsUseCase.execute({
    userId: req.user!.id,
    ...splitListQuery(req),
  });
  res.status(200).json(result);
}

export async function getMySummary(req: Request, res: Response) {
  const summary = await getCitizenSummaryUseCase.execute({
    citizenId: req.user!.id,
    ...parsedQuery<typeof summaryQuerySchema>(req),
  });
  res.status(200).json(summary);
}

export async function listReceivedDisposals(req: Request, res: Response) {
  const result = await listCollectorDisposalsUseCase.execute({
    userId: req.user!.id,
    ...splitListQuery(req),
  });
  res.status(200).json(result);
}

export async function getDisposal(req: Request, res: Response) {
  const disposal = await getDisposalByIdUseCase.execute({
    id: String(req.params.id),
    requester: { id: req.user!.id, role: req.user!.role },
  });
  res.status(200).json(disposal);
}

export async function updateDisposalStatus(req: Request, res: Response) {
  const disposal = await updateDisposalStatusUseCase.execute({
    id: String(req.params.id),
    status: req.body.status,
    requester: { id: req.user!.id, role: req.user!.role },
  });
  res.status(200).json(disposal);
}
