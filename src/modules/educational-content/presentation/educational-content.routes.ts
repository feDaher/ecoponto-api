import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import {
  createEducationalContentSchema,
  listEducationalContentsQuerySchema,
  listManagedEducationalContentsQuerySchema,
  updateEducationalContentSchema,
} from "./educational-content.validators";
import {
  createEducationalContent,
  deleteEducationalContent,
  findEducationalContentById,
  findManagedEducationalContent,
  getEducationalContentStats,
  getFeaturedEducationalContent,
  listEducationalContents,
  listManagedEducationalContents,
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
 *             $ref: '#/components/schemas/EducationalContentInput'
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
 *       409:
 *         description: Slug already in use
 *       422:
 *         description: Only published content can be featured, or the slug has no letters or digits
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
 *     summary: List published educational contents
 *     tags: [Educational Content]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by waste category id
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [DISPOSAL_GUIDE, DIY_TUTORIAL, QUICK_FACT, COMMUNITY_EVENT]
 *         description: Filter by format
 *     responses:
 *       200:
 *         description: Published contents, newest first
 *       400:
 *         description: Invalid query parameters
 */
educationalContentRoutes.get(
  "/educational-content",
  validate(listEducationalContentsQuerySchema, "query"),
  listEducationalContents,
);

/**
 * @openapi
 * /educational-content/featured:
 *   get:
 *     summary: Get the content pinned on the citizen home
 *     tags: [Educational Content]
 *     responses:
 *       200:
 *         description: Featured content
 *       404:
 *         description: No featured content
 */
educationalContentRoutes.get("/educational-content/featured", getFeaturedEducationalContent);

/**
 * @openapi
 * /educational-content/category/{categoryId}:
 *   get:
 *     summary: List published educational contents by category
 *     tags: [Educational Content]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Published contents from the selected category, newest first
 */
educationalContentRoutes.get(
  "/educational-content/category/:categoryId",
  listEducationalContentsByCategory,
);

/**
 * @openapi
 * /educational-content/{id}:
 *   get:
 *     summary: Get a published educational content by ID and count one view
 *     tags: [Educational Content]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Educational content found; viewCount already includes this view
 *       404:
 *         description: Educational content not found or not published
 */
educationalContentRoutes.get("/educational-content/:id", findEducationalContentById);

/**
 * @openapi
 * /educational-content/{id}:
 *   patch:
 *     summary: Update educational content (Administrator only)
 *     description: Partial update. Send at least one field.
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
 *             $ref: '#/components/schemas/EducationalContentInput'
 *     responses:
 *       200:
 *         description: Educational content updated
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Educational content or category not found
 *       409:
 *         description: Slug already in use
 *       422:
 *         description: Only published content can be featured, or the slug has no letters or digits
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

/**
 * @openapi
 * /admin/educational-content:
 *   get:
 *     summary: List educational contents in every status (Administrator only)
 *     tags: [Educational Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches title or slug
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING_REVIEW, PUBLISHED]
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [DISPOSAL_GUIDE, DIY_TUTORIAL, QUICK_FACT, COMMUNITY_EVENT]
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [ESSENTIAL, INTERMEDIATE, ADVANCED]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, views, title]
 *           default: recent
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
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: One page of the editorial catalog
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
educationalContentRoutes.get(
  "/admin/educational-content",
  authenticate,
  authorize(Role.ADMIN),
  validate(listManagedEducationalContentsQuerySchema, "query"),
  listManagedEducationalContents,
);

/**
 * @openapi
 * /admin/educational-content/stats:
 *   get:
 *     summary: Indicators for the editorial panel (Administrator only)
 *     tags: [Educational Content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Totals by status, views, contents added this month and counts by format
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
educationalContentRoutes.get(
  "/admin/educational-content/stats",
  authenticate,
  authorize(Role.ADMIN),
  getEducationalContentStats,
);

/**
 * @openapi
 * /admin/educational-content/{id}:
 *   get:
 *     summary: Get educational content in any status, without counting a view (Administrator only)
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
 *       200:
 *         description: Educational content found
 *       404:
 *         description: Educational content not found
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
educationalContentRoutes.get(
  "/admin/educational-content/:id",
  authenticate,
  authorize(Role.ADMIN),
  findManagedEducationalContent,
);
