import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { getMyRanking, getRanking } from "./ranking.controller";
import { myRankingQuerySchema, rankingQuerySchema } from "./ranking.validators";

export const rankingRoutes = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     RankingEntry:
 *       type: object
 *       properties:
 *         position: { type: integer, description: "Competition ranking: ties share the position" }
 *         name: { type: string, description: "First name only (LGPD)" }
 *         city: { type: string }
 *         points: { type: integer, description: "Sum of the citizen's CONFIRMED disposals" }
 */

/**
 * @openapi
 * /ranking:
 *   get:
 *     summary: Public ranking of citizens by confirmed disposal points (RB09)
 *     description: >
 *       Only CONFIRMED disposals count, as in /disposals/me/summary. No user ids are exposed;
 *       a signed-in citizen finds their own standing at /ranking/me.
 *     tags: [Ranking]
 *     parameters:
 *       - { in: query, name: city, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200:
 *         description: Highest scores first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: "#/components/schemas/RankingEntry" }
 *       400:
 *         description: Invalid query parameters
 */
rankingRoutes.get("/ranking", validate(rankingQuerySchema, "query"), getRanking);

/**
 * @openapi
 * /ranking/me:
 *   get:
 *     summary: The authenticated citizen's own ranking position (Citizen only)
 *     tags: [Ranking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: city, schema: { type: string, maxLength: 100 } }
 *     responses:
 *       200:
 *         description: Position (null while the citizen has no confirmed points), name, city and points
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not a Citizen
 */
rankingRoutes.get(
  "/ranking/me",
  authenticate,
  authorize(Role.CITIZEN),
  validate(myRankingQuerySchema, "query"),
  getMyRanking,
);
