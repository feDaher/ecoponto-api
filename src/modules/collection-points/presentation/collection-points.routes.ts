import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  collectionPointSchema,
  collectionPointSearchSchema,
  reviewSchema,
} from "./collection-points.validators";
import {
  create,
  findApprovedById,
  listMine,
  listPending,
  listPublic,
  review,
  update,
} from "./collection-points.controller";

export const collectionPointsRoutes = Router();

/**
 * @openapi
 * /collection-points:
 *   get:
 *     summary: List approved collection points for the public map
 *     tags: [Collection Points]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *         description: Filter by city
 *       - in: query
 *         name: wasteType
 *         schema: { type: string, example: PLASTIC }
 *         description: Filter by waste type
 *       - in: query
 *         name: latitude
 *         schema: { type: number }
 *         description: Latitude of the search origin
 *       - in: query
 *         name: longitude
 *         schema: { type: number }
 *         description: Longitude of the search origin
 *       - in: query
 *         name: radius
 *         schema: { type: number, exclusiveMinimum: 0 }
 *         description: Maximum search radius in kilometers
 *     responses:
 *       200:
 *         description: Public collection points (approved only)
 *       400:
 *         description: Invalid search filters
 */
collectionPointsRoutes.get(
  "/collection-points",
  validate(collectionPointSearchSchema, "query"),
  listPublic,
);

/**
 * @openapi
 * /collection-points/mine:
 *   get:
 *     summary: List the authenticated collector's points
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The collector's points, including moderation status
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a collector
 */
collectionPointsRoutes.get(
  "/collection-points/mine",
  authenticate,
  authorize(Role.COLLECTOR),
  listMine,
);

/**
 * @openapi
 * /collection-points/admin/pending:
 *   get:
 *     summary: List points awaiting administrator review
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Points pending approval
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not an administrator
 */
collectionPointsRoutes.get(
  "/collection-points/admin/pending",
  authenticate,
  authorize(Role.ADMIN),
  listPending,
);

/**
 * @openapi
 * /collection-points:
 *   post:
 *     summary: Register a collection point (collector only)
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CollectionPointInput'
 *     responses:
 *       201:
 *         description: Point submitted for approval
 *       400:
 *         description: Malformed body or unknown/inactive category
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a collector
 *       422:
 *         description: Missing or invalid location
 *       503:
 *         description: Address verification service unavailable
 */
collectionPointsRoutes.post(
  "/collection-points",
  authenticate,
  authorize(Role.COLLECTOR),
  validate(collectionPointSchema),
  create,
);

/**
 * @openapi
 * /collection-points/{id}:
 *   get:
 *     summary: Get an approved collection point
 *     tags: [Collection Points]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Approved collection point
 *       404:
 *         description: Point not found or not approved
 */
collectionPointsRoutes.get("/collection-points/:id", findApprovedById);

/**
 * @openapi
 * /collection-points/{id}:
 *   put:
 *     summary: Update a point owned by the authenticated collector
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CollectionPointInput'
 *     responses:
 *       200:
 *         description: Updated point resubmitted for approval
 *       400:
 *         description: Malformed body or unknown/inactive category
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a collector or does not own the point
 *       404:
 *         description: Point not found
 *       422:
 *         description: Missing or invalid location
 *       503:
 *         description: Address verification service unavailable
 */
collectionPointsRoutes.put(
  "/collection-points/:id",
  authenticate,
  authorize(Role.COLLECTOR),
  validate(collectionPointSchema),
  update,
);

/**
 * @openapi
 * /collection-points/{id}/review:
 *   patch:
 *     summary: Approve or reject a point (administrator only)
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CollectionPointReview'
 *     responses:
 *       200:
 *         description: Moderation decision saved
 *       400:
 *         description: Invalid decision, missing reason or point is not pending
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not an administrator
 *       404:
 *         description: Point not found
 */
collectionPointsRoutes.patch(
  "/collection-points/:id/review",
  authenticate,
  authorize(Role.ADMIN),
  validate(reviewSchema),
  review,
);
