import { validate } from "../../../middlewares/validate.middleware";

import {
  createEducationalContentSchema,
  updateEducationalContentSchema,
} from "./educational-content.validators";

import { Router } from "express";

import {
  createEducationalContent,
  deleteEducationalContent,
  findEducationalContentById,
  listEducationalContents,
  updateEducationalContent,
} from "./educational-content.controller";

export const educationalContentRoutes = Router();

/**
 * @openapi
 * /educational-content:
 *   post:
 *     summary: Create educational content
 *     tags: [Educational Content]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Educational content created
 *       400:
 *         description: Invalid request data
 */

educationalContentRoutes.post(
  "/educational-content",
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
 *     summary: Update educational content
 *     tags: [Educational Content]
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
 *         description: Educational content not found
 */

educationalContentRoutes.patch(
  "/educational-content/:id",
  validate(updateEducationalContentSchema),
  updateEducationalContent,
);

/**
 * @openapi
 * /educational-content/{id}:
 *   delete:
 *     summary: Delete educational content
 *     tags: [Educational Content]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Educational content deleted
 *       404:
 *         description: Educational content not found
 */

educationalContentRoutes.delete("/educational-content/:id", deleteEducationalContent);
