import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  createEducationalContentSchema,
  updateEducationalContentSchema,
} from "./educational-content.validators";
import {
  createEducationalContent,
  deleteEducationalContent,
  findEducationalContentById,
  listEducationalContents,
  updateEducationalContent,
  listEducationalContentsByCategory,
} from "./educational-content.controller";

export const educationalContentRoutes = Router();

/**
 * @openapi
 * /educational-content:
 *   post:
 *     summary: Create educational content (Administrator only)
 *     tags: [Educational Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryId, title, content]
 *             properties:
 *               categoryId:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Educational content created
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 *       404:
 *         description: Category not found or inactive
 */
educationalContentRoutes.post(
  "/educational-content",
  authenticate,
  authorize(Role.ADMIN),
  validate(createEducationalContentSchema),
  createEducationalContent,
);

/**
 * @openapi
 * /educational-content:
 *   get:
 *     summary: List all educational contents
 *     tags: [Educational Content]
 *     responses:
 *       200:
 *         description: Educational contents list
 */
educationalContentRoutes.get("/educational-content", listEducationalContents);

/**
 * @openapi
 * /educational-content/category/{categoryId}:
 *   get:
 *     summary: List educational contents by category
 *     tags: [Educational Content]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Educational contents from the selected category
 */
educationalContentRoutes.get(
  "/educational-content/category/:categoryId",
  listEducationalContentsByCategory,
);

/**
 * @openapi
 * /educational-content/{id}:
 *   get:
 *     summary: Get educational content by ID
 *     tags: [Educational Content]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Educational content found
 *       404:
 *         description: Educational content not found
 */
educationalContentRoutes.get("/educational-content/:id", findEducationalContentById);

/**
 * @openapi
 * /educational-content/{id}:
 *   patch:
 *     summary: Update educational content (Administrator only)
 *     tags: [Educational Content]
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
 *               categoryId:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Educational content updated
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Educational content or category not found
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
educationalContentRoutes.patch(
  "/educational-content/:id",
  authenticate,
  authorize(Role.ADMIN),
  validate(updateEducationalContentSchema),
  updateEducationalContent,
);

/**
 * @openapi
 * /educational-content/{id}:
 *   delete:
 *     summary: Delete educational content (Administrator only)
 *     tags: [Educational Content]
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
 *         description: Educational content deleted
 *       404:
 *         description: Educational content not found
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
educationalContentRoutes.delete(
  "/educational-content/:id",
  authenticate,
  authorize(Role.ADMIN),
  deleteEducationalContent,
);
