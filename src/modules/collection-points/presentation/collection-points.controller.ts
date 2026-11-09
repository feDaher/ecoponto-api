import type { Request, Response } from "express";
import { env } from "../../../config/env";
import { GooglePlacesClient } from "../../places/infra/http/GooglePlacesClient";
import { ResolveLocationUseCase } from "../../geolocation/domain/use-cases/ResolveLocationUseCase";
import { PrismaWasteCategoryRepository } from "../../waste-categories/infra/repositories/PrismaWasteCategoryRepository";
import { PrismaCollectionPointRepository } from "../infra/repositories/PrismaCollectionPointRepository";
import { CreateCollectionPointUseCase } from "../domain/use-cases/CreateCollectionPointUseCase";
import { FindApprovedCollectionPointByIdUseCase } from "../domain/use-cases/FindApprovedCollectionPointByIdUseCase";
import { ListMyCollectionPointsUseCase } from "../domain/use-cases/ListMyCollectionPointsUseCase";
import { ListPendingCollectionPointsUseCase } from "../domain/use-cases/ListPendingCollectionPointsUseCase";
import { ListPublicCollectionPointsUseCase } from "../domain/use-cases/ListPublicCollectionPointsUseCase";
import { ReviewCollectionPointUseCase } from "../domain/use-cases/ReviewCollectionPointUseCase";
import { UpdateCollectionPointUseCase } from "../domain/use-cases/UpdateCollectionPointUseCase";
import type { CollectionPoint } from "../domain/entities/CollectionPoint";
import type {
  CollectionPointInput,
  CollectionPointSearchQuery,
} from "./collection-points.validators";

const pointRepository = new PrismaCollectionPointRepository();
const categoryRepository = new PrismaWasteCategoryRepository();
const locationResolver = new ResolveLocationUseCase(
  new GooglePlacesClient(env.GOOGLE_MAPS_API_KEY),
);
const createUseCase = new CreateCollectionPointUseCase(
  pointRepository,
  categoryRepository,
  locationResolver,
);
const updateUseCase = new UpdateCollectionPointUseCase(
  pointRepository,
  categoryRepository,
  locationResolver,
);
const reviewUseCase = new ReviewCollectionPointUseCase(pointRepository);
const listPublicUseCase = new ListPublicCollectionPointsUseCase(
  pointRepository,
  categoryRepository,
);
const findApprovedUseCase = new FindApprovedCollectionPointByIdUseCase(pointRepository);
const listMineUseCase = new ListMyCollectionPointsUseCase(pointRepository);
const listPendingUseCase = new ListPendingCollectionPointsUseCase(pointRepository);

function pointIdFrom(request: Request) {
  const { id } = request.params;
  return Array.isArray(id) ? id[0] : id;
}
function publicResponse(point: CollectionPoint) {
  return { ...point, whatsappContact: point.showWhatsappContact ? point.whatsappContact : null };
}

export async function listPublic(req: Request, res: Response) {
  const points = await listPublicUseCase.execute(
    req.query as unknown as CollectionPointSearchQuery,
  );
  res.status(200).json(points.map(publicResponse));
}
export async function listMine(req: Request, res: Response) {
  res.status(200).json(await listMineUseCase.execute(req.user!.id));
}
export async function listPending(_req: Request, res: Response) {
  res.status(200).json(await listPendingUseCase.execute());
}
export async function create(req: Request, res: Response) {
  const point = await createUseCase.execute({
    ...(req.body as CollectionPointInput),
    collectorId: req.user!.id,
  });
  res.status(201).json(point);
}
export async function findApprovedById(req: Request, res: Response) {
  res.status(200).json(publicResponse(await findApprovedUseCase.execute(pointIdFrom(req))));
}
export async function update(req: Request, res: Response) {
  const point = await updateUseCase.execute({
    ...(req.body as CollectionPointInput),
    id: pointIdFrom(req),
    requester: req.user!,
  });
  res.status(200).json(point);
}
export async function review(req: Request, res: Response) {
  const body = req.body as { status: "APPROVED" | "REJECTED"; rejectionReason?: string };
  const point = await reviewUseCase.execute({
    id: pointIdFrom(req),
    status: body.status,
    rejectionReason: body.rejectionReason,
    reviewerId: req.user!.id,
  });
  res.status(200).json(point);
}
