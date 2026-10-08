import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../../../middlewares/validate.middleware";
import { autocomplete, details } from "./places.controller";
import {
  autocompleteQuerySchema,
  placeDetailsParamsSchema,
  placeDetailsQuerySchema,
} from "./places.validators";

export const placesRoutes = Router();

// Public routes that spend paid Google quota: limit per IP on top of the global limiter.
function placesLimiter(limit: number) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Muitas buscas em pouco tempo. Tente novamente em instantes." },
  });
}

/**
 * @openapi
 * /places/autocomplete:
 *   get:
 *     summary: Suggest addresses in Brazil for the map search box
 *     tags: [Places]
 *     parameters:
 *       - in: query
 *         name: input
 *         required: true
 *         schema: { type: string, minLength: 3, maxLength: 200 }
 *       - in: query
 *         name: sessionToken
 *         description: Same token for the whole search, reused on GET /places/{placeId}
 *         schema: { type: string, pattern: '^[A-Za-z0-9_-]{1,36}$' }
 *       - in: query
 *         name: latitude
 *         description: Bias origin; send together with longitude (defaults to Manhuaçu)
 *         schema: { type: number, minimum: -90, maximum: 90 }
 *       - in: query
 *         name: longitude
 *         schema: { type: number, minimum: -180, maximum: 180 }
 *     responses:
 *       200:
 *         description: Suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   placeId: { type: string }
 *                   title: { type: string }
 *                   subtitle: { type: string }
 *       400:
 *         description: Invalid query
 *       429:
 *         description: Too many requests
 *       503:
 *         description: Address search unavailable
 */
placesRoutes.get(
  "/places/autocomplete",
  placesLimiter(30),
  validate(autocompleteQuerySchema, "query"),
  autocomplete,
);

/**
 * @openapi
 * /places/{placeId}:
 *   get:
 *     summary: Resolve a suggested place into coordinates
 *     tags: [Places]
 *     parameters:
 *       - in: path
 *         name: placeId
 *         required: true
 *         schema: { type: string, pattern: '^[A-Za-z0-9_-]{1,512}$' }
 *       - in: query
 *         name: sessionToken
 *         schema: { type: string, pattern: '^[A-Za-z0-9_-]{1,36}$' }
 *     responses:
 *       200:
 *         description: Place location
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 label: { type: string }
 *                 latitude: { type: number }
 *                 longitude: { type: number }
 *                 viewport:
 *                   type: object
 *                   properties:
 *                     southWest:
 *                       type: object
 *                       properties:
 *                         latitude: { type: number }
 *                         longitude: { type: number }
 *                     northEast:
 *                       type: object
 *                       properties:
 *                         latitude: { type: number }
 *                         longitude: { type: number }
 *       400:
 *         description: Invalid place id or query
 *       404:
 *         description: Place not found
 *       429:
 *         description: Too many requests
 *       503:
 *         description: Address search unavailable
 */
placesRoutes.get(
  "/places/:placeId",
  placesLimiter(15),
  validate(placeDetailsParamsSchema, "params"),
  validate(placeDetailsQuerySchema, "query"),
  details,
);
