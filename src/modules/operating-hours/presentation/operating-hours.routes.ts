import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  createOperatingHours,
  deleteOperatingHours,
  listOperatingHoursByCollectionPoint,
  updateOperatingHours,
} from "./operating-hours.controller";
import {
  createOperatingHoursSchema,
  updateOperatingHoursSchema,
} from "./operating-hours.validators";

export const operatingHoursRoutes = Router();

/**
 * @openapi
 * /collection-points/{collectionPointId}/operating-hours:
 *   get:
 *     summary: List the operating hours of a collection point (public)
 *     tags: [Operating Hours]
 *     parameters:
 *       - in: path
 *         name: collectionPointId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of operating hours
 */
operatingHoursRoutes.get(
  "/collection-points/:collectionPointId/operating-hours",
  listOperatingHoursByCollectionPoint,
);

/**
 * @openapi
 * /collection-points/{collectionPointId}/operating-hours:
 *   post:
 *     summary: Create an operating hours entry (Collector or Administrator)
 *     tags: [Operating Hours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectionPointId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [weekday, openTime, closeTime]
 *             properties:
 *               weekday:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               openTime:
 *                 type: string
 *                 example: "08:00"
 *               closeTime:
 *                 type: string
 *                 example: "18:00"
 *     responses:
 *       201:
 *         description: Operating hours created
 *       400:
 *         description: Invalid data or opening time not before closing time
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a Collector or Administrator
 */
operatingHoursRoutes.post(
  "/collection-points/:collectionPointId/operating-hours",
  authenticate,
  authorize(Role.COLLECTOR, Role.ADMIN),
  validate(createOperatingHoursSchema),
  createOperatingHours,
);

/**
 * @openapi
 * /operating-hours/{id}:
 *   put:
 *     summary: Update an operating hours entry (Collector or Administrator)
 *     tags: [Operating Hours]
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
 *             properties:
 *               weekday:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               openTime:
 *                 type: string
 *                 example: "08:00"
 *               closeTime:
 *                 type: string
 *                 example: "18:00"
 *     responses:
 *       200:
 *         description: Operating hours updated
 *       400:
 *         description: Invalid data or opening time not before closing time
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a Collector or Administrator
 *       404:
 *         description: Operating hours not found
 */
operatingHoursRoutes.put(
  "/operating-hours/:id",
  authenticate,
  authorize(Role.COLLECTOR, Role.ADMIN),
  validate(updateOperatingHoursSchema),
  updateOperatingHours,
);

/**
 * @openapi
 * /operating-hours/{id}:
 *   delete:
 *     summary: Delete an operating hours entry (Collector or Administrator)
 *     tags: [Operating Hours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Operating hours deleted
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: User is not a Collector or Administrator
 *       404:
 *         description: Operating hours not found
 */
operatingHoursRoutes.delete(
  "/operating-hours/:id",
  authenticate,
  authorize(Role.COLLECTOR, Role.ADMIN),
  deleteOperatingHours,
);
