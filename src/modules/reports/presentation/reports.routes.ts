import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  exportReport,
  getByCategory,
  getByPoint,
  getFilterOptions,
  getManifests,
  getSummary,
} from "./reports.controller";
import { exportQuerySchema, manifestQuerySchema, reportQuerySchema } from "./reports.validators";

export const reportsRoutes = Router();

/**
 * @openapi
 * /reports/summary:
 *   get:
 *     summary: KPIs of the selected period (volume, CO2, active collection points)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-31" }
 *       - name: categoryId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - name: region
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [PENDING, CONFIRMED, CANCELLED] }
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Period summary
 *       400:
 *         description: Invalid period
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Role not allowed
 */
reportsRoutes.get(
  "/reports/summary",
  authenticate,
  authorize(Role.ADMIN, Role.COLLECTOR),
  validate(reportQuerySchema, "query"),
  getSummary,
);

/**
 * @openapi
 * /reports/by-category:
 *   get:
 *     summary: Gravimetric breakdown of the disposed volume by category
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-31" }
 *       - name: categoryId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - name: region
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [PENDING, CONFIRMED, CANCELLED] }
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category rows with weight and participation percentage
 *       400:
 *         description: Invalid period
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Role not allowed
 */
reportsRoutes.get(
  "/reports/by-category",
  authenticate,
  authorize(Role.ADMIN, Role.COLLECTOR),
  validate(reportQuerySchema, "query"),
  getByCategory,
);

/**
 * @openapi
 * /reports/by-point:
 *   get:
 *     summary: Disposal density per collection point, with coordinates
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-31" }
 *       - name: categoryId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - name: region
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [PENDING, CONFIRMED, CANCELLED] }
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Collection point rows with weight and percentage
 *       400:
 *         description: Invalid period
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Role not allowed
 */
reportsRoutes.get(
  "/reports/by-point",
  authenticate,
  authorize(Role.ADMIN, Role.COLLECTOR),
  validate(reportQuerySchema, "query"),
  getByPoint,
);

/**
 * @openapi
 * /reports/manifests:
 *   get:
 *     summary: Paginated traceability records of the selected period
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-31" }
 *       - name: categoryId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - name: region
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [PENDING, CONFIRMED, CANCELLED] }
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         required: false
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: pageSize
 *         in: query
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 5 }
 *     responses:
 *       200:
 *         description: Page of manifest rows
 *       400:
 *         description: Invalid period or pagination
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Role not allowed
 */
reportsRoutes.get(
  "/reports/manifests",
  authenticate,
  authorize(Role.ADMIN, Role.COLLECTOR),
  validate(manifestQuerySchema, "query"),
  getManifests,
);

/**
 * @openapi
 * /reports/filter-options:
 *   get:
 *     summary: Options available for the report filters
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories, regions and disposal statuses
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Role not allowed
 */
reportsRoutes.get(
  "/reports/filter-options",
  authenticate,
  authorize(Role.ADMIN, Role.COLLECTOR),
  getFilterOptions,
);

/**
 * @openapi
 * /reports/export:
 *   get:
 *     summary: Export the report as CSV, PDF, GeoJSON or KML
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: from
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-01" }
 *       - name: to
 *         in: query
 *         required: true
 *         schema: { type: string, example: "2025-10-31" }
 *       - name: categoryId
 *         in: query
 *         required: false
 *         schema: { type: string, format: uuid }
 *       - name: region
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [PENDING, CONFIRMED, CANCELLED] }
 *       - name: search
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: scope
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [general, category, geospatial, manifests] }
 *       - name: format
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [csv, pdf, geojson, kml] }
 *     responses:
 *       200:
 *         description: Exported file
 *         content:
 *           text/csv:
 *             schema: { type: string }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *           application/geo+json:
 *             schema: { type: object }
 *       400:
 *         description: Invalid period or unsupported format for the scope
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Role not allowed
 */
reportsRoutes.get(
  "/reports/export",
  authenticate,
  authorize(Role.ADMIN, Role.COLLECTOR),
  validate(exportQuerySchema, "query"),
  exportReport,
);
