import { Router } from "express";
import { prisma } from "../../../config/prisma";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../../shared/errors/AppError";

export const reviewsRoutes = Router();

// Lista somente as avaliações visíveis ao público
reviewsRoutes.get("/reviews", async (_req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        isHidden: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(reviews);
  } catch (error) {
    next(error);
  }
});
// Oculta uma avaliação — somente administradores
reviewsRoutes.patch(
  "/admin/reviews/:id/hide",
  authenticate,
  authorize(Role.ADMIN),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);

      const review = await prisma.review.findUnique({
        where: { id },
      });

      if (!review) {
        throw new AppError("Avaliação não encontrada", 404);
      }

      const updatedReview = await prisma.review.update({
        where: { id },
        data: { isHidden: true },
      });

      res.status(200).json(updatedReview);
    } catch (error) {
      next(error);
    }
  },
);

// Remove definitivamente uma avaliação — somente administradores
reviewsRoutes.delete(
  "/admin/reviews/:id",
  authenticate,
  authorize(Role.ADMIN),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);

      const review = await prisma.review.findUnique({
        where: { id },
      });

      if (!review) {
        throw new AppError("Avaliação não encontrada", 404);
      }

      await prisma.review.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
