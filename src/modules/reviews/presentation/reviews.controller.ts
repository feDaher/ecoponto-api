import type { Request, Response } from "express";
import { DeleteReviewUseCase } from "../domain/use-cases/DeleteReviewUseCase";
import { ListCollectionPointReviewsUseCase } from "../domain/use-cases/ListCollectionPointReviewsUseCase";
import { ListReviewsForModerationUseCase } from "../domain/use-cases/ListReviewsForModerationUseCase";
import { SetReviewVisibilityUseCase } from "../domain/use-cases/SetReviewVisibilityUseCase";
import { PrismaReviewRepository } from "../infra/repositories/PrismaReviewRepository";
import type {
  ListCollectionPointReviewsQuery,
  ListReviewsForModerationQuery,
} from "./reviews.validators";

const reviewRepository = new PrismaReviewRepository();
const listCollectionPointReviewsUseCase = new ListCollectionPointReviewsUseCase(reviewRepository);
const listReviewsForModerationUseCase = new ListReviewsForModerationUseCase(reviewRepository);
const setReviewVisibilityUseCase = new SetReviewVisibilityUseCase(reviewRepository);
const deleteReviewUseCase = new DeleteReviewUseCase(reviewRepository);

export async function listCollectionPointReviews(req: Request, res: Response) {
  const { limit, offset } = req.query as unknown as ListCollectionPointReviewsQuery;

  const page = await listCollectionPointReviewsUseCase.execute({
    collectionPointId: String(req.params.id),
    limit,
    offset,
  });

  res.setHeader("X-Total-Count", String(page.total));
  res.status(200).json(page.items);
}

export async function listReviewsForModeration(req: Request, res: Response) {
  const { limit, offset, visibility, collectionPointId } =
    req.query as unknown as ListReviewsForModerationQuery;

  const page = await listReviewsForModerationUseCase.execute(
    { visibility, collectionPointId },
    { limit, offset },
  );

  res.setHeader("X-Total-Count", String(page.total));
  res.status(200).json(page.items);
}

export async function hideReview(req: Request, res: Response) {
  const review = await setReviewVisibilityUseCase.execute({
    id: String(req.params.id),
    isHidden: true,
  });
  res.status(200).json(review);
}

export async function unhideReview(req: Request, res: Response) {
  const review = await setReviewVisibilityUseCase.execute({
    id: String(req.params.id),
    isHidden: false,
  });
  res.status(200).json(review);
}

export async function deleteReview(req: Request, res: Response) {
  await deleteReviewUseCase.execute(String(req.params.id));
  res.status(204).send();
}
