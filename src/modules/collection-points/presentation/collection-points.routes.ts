import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  collectionPointSchema,
  collectionPointUpdateSchema,
  reviewSchema,
  searchCollectionPointsQuerySchema,
  updateCollectionPointMaterialSettingsSchema,
} from "./collection-points.validators";
import {
  reviewPointCategorySchema,
  updatePointCategoriesSchema,
} from "./validators/point-categories.validators";
import {
  create,
  findApprovedById,
  listMine,
  listPending,
  listPublic,
  review,
  update,
  updateMaterialSettings,
} from "./collection-points.controller";
import {
  listCategoryReviews,
  listPendingCategories,
  reviewCategory,
  updateCategories,
} from "./point-categories.controller";

export const collectionPointsRoutes = Router();

/**
 * @openapi
 * /collection-points:
 *   get:
 *     summary: Search approved collection points for the public map
 *     description: >
 *       Filters are optional and combinable (AND between filters, OR between the waste types of
 *       `wasteType`). With `latitude` and `longitude` the results are ordered by distance and carry
 *       `distanceKm`; adding `radius` also discards points farther than that. Without a reference
 *       point the results are ordered by name.
 *     tags: [Collection Points]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city (case and accent insensitive)
 *       - in: query
 *         name: wasteType
 *         schema:
 *           type: string
 *           example: PLASTIC,GLASS
 *         description: One or more comma-separated active waste category codes from GET /waste-categories (e.g. PLASTIC, GLASS). Unknown or inactive codes return 400.
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Reference latitude for proximity search (requires longitude)
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Reference longitude for proximity search (requires latitude)
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           exclusiveMinimum: 0
 *           maximum: 100
 *         description: Maximum distance in kilometers from the reference point (requires latitude and longitude)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 100
 *         description: Maximum number of points returned
 *     responses:
 *       200:
 *         description: Public collection points (approved only), each with its active operating hours in the hours field
 *         headers:
 *           X-Total-Count:
 *             description: Number of points matching the filters, before `limit` is applied
 *             schema:
 *               type: integer
 *       400:
 *         description: Invalid filter
 */
collectionPointsRoutes.get(
  "/collection-points",
  validate(searchCollectionPointsQuerySchema, "query"),
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
 * /collection-points/admin/pending-categories:
 *   get:
 *     summary: List accepted-category requests awaiting administrator review
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Categories added to points that are pending approval
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not an administrator
 */
collectionPointsRoutes.get(
  "/collection-points/admin/pending-categories",
  authenticate,
  authorize(Role.ADMIN),
  listPendingCategories,
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
 *         description: Point submitted for approval, with its operating hours (field `hours`, read from the OperatingHours table)
 *       400:
 *         description: Malformed body or unknown/inactive category
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a collector
 *       422:
 *         description: Missing or invalid location (coordinates outside Brazil, unverifiable address, or coordinates far from the address)
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
 *         description: Approved collection point, with its active operating hours in the hours field
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
 *             $ref: '#/components/schemas/CollectionPointUpdateInput'
 *     responses:
 *       200:
 *         description: Updated point resubmitted for approval. Operating hours are not changed here; use /collection-points/{id}/operating-hours
 *       400:
 *         description: Malformed body or unknown/inactive category
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a collector or does not own the point
 *       404:
 *         description: Point not found
 *       422:
 *         description: Missing or invalid location (coordinates outside Brazil, unverifiable address, or coordinates far from the address)
 *       503:
 *         description: Address verification service unavailable
 */
collectionPointsRoutes.put(
  "/collection-points/:id",
  authenticate,
  authorize(Role.COLLECTOR),
  validate(collectionPointUpdateSchema),
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

/**
 * @openapi
 * /collection-points/{id}/categories:
 *   put:
 *     summary: Change the accepted waste categories of a point without resubmitting it
 *     description: >
 *       Removed categories take effect immediately and the point stays approved and on the map.
 *       Categories added by the collector stay pending until an administrator approves them and
 *       only then count in the public search; categories added by an administrator are approved
 *       right away (and recorded in the review history). The point must keep at least one
 *       approved category.
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
 *             type: object
 *             required: [wasteCategories]
 *             properties:
 *               wasteCategories:
 *                 type: array
 *                 minItems: 1
 *                 uniqueItems: true
 *                 items: { type: string, example: PLASTIC }
 *     responses:
 *       200:
 *         description: The point's categories with their approval status
 *       400:
 *         description: Malformed body, repeated codes or unknown/inactive category
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not the owner of the point nor an administrator
 *       404:
 *         description: Point not found
 *       422:
 *         description: The point would be left without any approved category
 */
collectionPointsRoutes.put(
  "/collection-points/:id/categories",
  authenticate,
  authorize(Role.COLLECTOR, Role.ADMIN),
  validate(updatePointCategoriesSchema),
  updateCategories,
);

/**
 * @openapi
 * /collection-points/{id}/categories/reviews:
 *   get:
 *     summary: History of administrator decisions on the point's categories
 *     description: >
 *       Newest first, at most 100 entries. Includes approvals, rejections with their reason and
 *       categories added directly by an administrator. Only the point owner or an administrator
 *       may read it; reviewedBy is filled only for administrators (null for the collector).
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Decisions (id, categoryId, categoryName, decision, reason, reviewedAt, reviewedBy)
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not the owner of the point nor an administrator
 *       404:
 *         description: Point not found
 */
collectionPointsRoutes.get(
  "/collection-points/:id/categories/reviews",
  authenticate,
  authorize(Role.COLLECTOR, Role.ADMIN),
  listCategoryReviews,
);

/**
 * @openapi
 * /collection-points/{id}/categories/{categoryId}/review:
 *   patch:
 *     summary: Approve or reject an added category (administrator only)
 *     description: >
 *       Rejecting removes the link between the point and the category and requires a reason
 *       (max 500 chars). Every decision, with its reason, is kept in the category review history
 *       (GET /collection-points/{id}/categories/reviews).
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               rejectionReason: { type: string }
 *     responses:
 *       204:
 *         description: Decision saved
 *       400:
 *         description: Invalid decision or missing rejection reason
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not an administrator
 *       404:
 *         description: Category not found on this point
 *       409:
 *         description: Category is already approved
 */
collectionPointsRoutes.patch(
  "/collection-points/:id/categories/:categoryId/review",
  authenticate,
  authorize(Role.ADMIN),
  validate(reviewPointCategorySchema),
  reviewCategory,
);

/**
 * @openapi
 * /collection-points/{id}/materials/{categoryId}:
 *   patch:
 *     summary: Update reception settings for a collection point material
 *     tags: [Collection Points]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             additionalProperties: false
 *             properties:
 *               capacityKg:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 maximum: 100000
 *                 nullable: true
 *                 description: null removes the capacity limit
 *                 multipleOf: 0.001
 *               isAccepting:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Material reception settings updated
 *       400:
 *         description: Invalid or empty settings body
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Requester is not a collector/administrator, or does not own the point
 *       404:
 *         description: Collection point or point category not found
 */
collectionPointsRoutes.patch(
  "/collection-points/:id/materials/:categoryId",
  authenticate,
  authorize(Role.COLLECTOR, Role.ADMIN),
  validate(updateCollectionPointMaterialSettingsSchema),
  updateMaterialSettings,
);
