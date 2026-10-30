import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  createDisposal,
  getDisposal,
  getMySummary,
  listMyDisposals,
  listReceivedDisposals,
  updateDisposalStatus,
} from "./disposals.controller";
import {
  createDisposalSchema,
  listDisposalsQuerySchema,
  summaryQuerySchema,
  updateDisposalStatusSchema,
} from "./disposals.validators";

export const disposalsRoutes = Router();

/**
 * @openapi
 * /disposals:
 *   post:
 *     summary: Log a recycling disposal (Citizen only)
 *     description: >
 *       Creates a disposal in PENDING status with 0 points. Points are only granted when the
 *       collector of the point confirms the delivery. The point must be APPROVED and must accept
 *       the waste category.
 *     tags: [Disposals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collectionPointId, categoryId, weightKg]
 *             properties:
 *               collectionPointId:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               weightKg:
 *                 type: number
 *                 minimum: 0.001
 *                 maximum: 1000
 *                 example: 2.5
 *               disposedAt:
 *                 type: string
 *                 format: date-time
 *                 description: Defaults to now. Cannot be in the future.
 *     responses:
 *       201:
 *         description: Disposal logged (PENDING)
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not a Citizen
 *       404:
 *         description: Collection point (not approved or unknown) or waste category not found
 *       422:
 *         description: The collection point does not accept this waste category
 */
disposalsRoutes.post(
  "/disposals",
  authenticate,
  authorize(Role.CITIZEN),
  validate(createDisposalSchema),
  createDisposal,
);

/**
 * @openapi
 * /disposals/me/summary:
 *   get:
 *     summary: Recycling totals of the logged citizen (Citizen only)
 *     description: Counts only CONFIRMED disposals. Totals overall and per waste category.
 *     tags: [Disposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: totalDisposals, totalWeightKg, totalPoints and byCategory
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not a Citizen
 */
disposalsRoutes.get(
  "/disposals/me/summary",
  authenticate,
  authorize(Role.CITIZEN),
  validate(summaryQuerySchema, "query"),
  getMySummary,
);

/**
 * @openapi
 * /disposals/me:
 *   get:
 *     summary: Recycling history of the logged citizen (Citizen only)
 *     description: Paginated, newest first. Only the requester's own records are returned.
 *     tags: [Disposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: collectionPointId
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: items, page, pageSize, total and totalPages
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not a Citizen
 */
disposalsRoutes.get(
  "/disposals/me",
  authenticate,
  authorize(Role.CITIZEN),
  validate(listDisposalsQuerySchema, "query"),
  listMyDisposals,
);

/**
 * @openapi
 * /disposals/received:
 *   get:
 *     summary: Disposals delivered to the collector's own points (Collector only)
 *     description: Same filters and pagination as /disposals/me. Use status=PENDING to find what is waiting for confirmation. Only the citizen's name is exposed.
 *     tags: [Disposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: collectionPointId
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: items, page, pageSize, total and totalPages
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not a Collector
 */
disposalsRoutes.get(
  "/disposals/received",
  authenticate,
  authorize(Role.COLLECTOR),
  validate(listDisposalsQuerySchema, "query"),
  listReceivedDisposals,
);

/**
 * @openapi
 * /disposals/{id}:
 *   get:
 *     summary: Disposal detail (the citizen who logged it, the owner of the point or an Administrator)
 *     tags: [Disposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The disposal
 *       401:
 *         description: Missing, invalid or expired token
 *       404:
 *         description: Not found (also returned when the requester is not allowed to see it)
 */
disposalsRoutes.get("/disposals/:id", authenticate, getDisposal);

/**
 * @openapi
 * /disposals/{id}/status:
 *   patch:
 *     summary: Confirm or cancel a pending disposal (owner of the point or Administrator)
 *     description: CONFIRMED grants points to the citizen (10 per kg, minimum 1); CANCELLED grants none. Only PENDING disposals can change.
 *     tags: [Disposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CONFIRMED, CANCELLED]
 *     responses:
 *       200:
 *         description: Updated disposal
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Not a Collector/Administrator, or the point belongs to another collector
 *       404:
 *         description: Disposal not found
 *       409:
 *         description: Disposal is no longer PENDING
 */
disposalsRoutes.patch(
  "/disposals/:id/status",
  authenticate,
  authorize(Role.COLLECTOR, Role.ADMIN),
  validate(updateDisposalStatusSchema),
  updateDisposalStatus,
);
