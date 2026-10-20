import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  createWasteCategory,
  deactivateWasteCategory,
  listWasteCategories,
  updateWasteCategory,
} from "./waste-categories.controller";
import {
  createWasteCategorySchema,
  updateWasteCategorySchema,
} from "./waste-categories.validators";

export const wasteCategoriesRoutes = Router();

/**
 * @openapi
 * /waste-categories:
 *   get:
 *     summary: List active waste categories (public)
 *     tags: [Waste Categories]
 *     responses:
 *       200:
 *         description: List of active waste categories
 */
wasteCategoriesRoutes.get("/waste-categories", listWasteCategories);

/**
 * @openapi
 * /waste-categories:
 *   post:
 *     summary: Create a waste category (Administrator only)
 *     tags: [Waste Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Waste category created
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 *       409:
 *         description: Waste category already exists
 */
wasteCategoriesRoutes.post(
  "/waste-categories",
  authenticate,
  authorize(Role.ADMIN),
  validate(createWasteCategorySchema),
  createWasteCategory,
);

/**
 * @openapi
 * /waste-categories/{id}:
 *   put:
 *     summary: Update a waste category (Administrator only)
 *     tags: [Waste Categories]
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Waste category updated
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 *       404:
 *         description: Waste category not found
 *       409:
 *         description: Waste category already exists
 */
wasteCategoriesRoutes.put(
  "/waste-categories/:id",
  authenticate,
  authorize(Role.ADMIN),
  validate(updateWasteCategorySchema),
  updateWasteCategory,
);

/**
 * @openapi
 * /waste-categories/{id}:
 *   delete:
 *     summary: Deactivate a waste category (Administrator only)
 *     tags: [Waste Categories]
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
 *         description: Waste category deactivated
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 *       404:
 *         description: Waste category not found
 */
wasteCategoriesRoutes.delete(
  "/waste-categories/:id",
  authenticate,
  authorize(Role.ADMIN),
  deactivateWasteCategory,
);
