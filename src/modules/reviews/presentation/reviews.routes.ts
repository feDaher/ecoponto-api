import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  deleteReview,
  hideReview,
  listCollectionPointReviews,
  listReviewsForModeration,
  unhideReview,
} from "./reviews.controller";
import {
  collectionPointIdParamsSchema,
  listCollectionPointReviewsQuerySchema,
  listReviewsForModerationQuerySchema,
  reviewIdParamsSchema,
} from "./reviews.validators";

export const reviewsRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     PublicReview:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         rating: { type: integer, minimum: 1, maximum: 5 }
 *         comment: { type: string, nullable: true }
 *         authorName: { type: string, description: "First name only (LGPD)" }
 *         createdAt: { type: string, format: date-time }
 *     ModerationReview:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         rating: { type: integer, minimum: 1, maximum: 5 }
 *         comment: { type: string, nullable: true }
 *         isHidden: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         author:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *         collectionPoint:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 */

/**
 * @openapi
 * /collection-points/{id}/reviews:
 *   get:
 *     summary: List the visible reviews of an approved collection point (public)
 *     description: Hidden reviews never appear here. Newest first.
 *     tags: [Reviews]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: offset, schema: { type: integer, minimum: 0, maximum: 10000, default: 0 } }
 *     responses:
 *       200:
 *         description: Visible reviews
 *         headers:
 *           X-Total-Count:
 *             schema: { type: integer }
 *             description: Number of visible reviews of the point
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: "#/components/schemas/PublicReview" }
 *       400:
 *         description: Invalid id or query parameters
 *       404:
 *         description: Collection point not found or not approved
 */
reviewsRoutes.get(
  "/collection-points/:id/reviews",
  validate(collectionPointIdParamsSchema, "params"),
  validate(listCollectionPointReviewsQuerySchema, "query"),
  listCollectionPointReviews,
);

/**
 * @openapi
 * /admin/reviews:
 *   get:
 *     summary: List reviews for moderation, including hidden ones (Administrator only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: visibility, schema: { type: string, enum: [visible, hidden, all], default: all } }
 *       - { in: query, name: collectionPointId, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: offset, schema: { type: integer, minimum: 0, maximum: 10000, default: 0 } }
 *     responses:
 *       200:
 *         description: Reviews, newest first
 *         headers:
 *           X-Total-Count:
 *             schema: { type: integer }
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: "#/components/schemas/ModerationReview" }
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
reviewsRoutes.get(
  "/admin/reviews",
  authenticate,
  authorize(Role.ADMIN),
  validate(listReviewsForModerationQuerySchema, "query"),
  listReviewsForModeration,
);

/**
 * @openapi
 * /admin/reviews/{id}/hide:
 *   patch:
 *     summary: Hide a review from the public page (Administrator only)
 *     description: Takes effect immediately on GET /collection-points/{id}/reviews. Reversible with /unhide. Idempotent.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Review hidden
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ModerationReview" }
 *       400: { description: Invalid id }
 *       401: { description: Missing, invalid or expired token }
 *       403: { description: Authenticated user is not an Administrator }
 *       404: { description: Review not found }
 */
reviewsRoutes.patch(
  "/admin/reviews/:id/hide",
  authenticate,
  authorize(Role.ADMIN),
  validate(reviewIdParamsSchema, "params"),
  hideReview,
);

/**
 * @openapi
 * /admin/reviews/{id}/unhide:
 *   patch:
 *     summary: Show a previously hidden review again (Administrator only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Review visible again
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ModerationReview" }
 *       400: { description: Invalid id }
 *       401: { description: Missing, invalid or expired token }
 *       403: { description: Authenticated user is not an Administrator }
 *       404: { description: Review not found }
 */
reviewsRoutes.patch(
  "/admin/reviews/:id/unhide",
  authenticate,
  authorize(Role.ADMIN),
  validate(reviewIdParamsSchema, "params"),
  unhideReview,
);

/**
 * @openapi
 * /admin/reviews/{id}:
 *   delete:
 *     summary: Permanently delete a review (Administrator only)
 *     description: Prefer hiding; delete only content that must not be kept.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204: { description: Review deleted }
 *       400: { description: Invalid id }
 *       401: { description: Missing, invalid or expired token }
 *       403: { description: Authenticated user is not an Administrator }
 *       404: { description: Review not found }
 */
reviewsRoutes.delete(
  "/admin/reviews/:id",
  authenticate,
  authorize(Role.ADMIN),
  validate(reviewIdParamsSchema, "params"),
  deleteReview,
);
