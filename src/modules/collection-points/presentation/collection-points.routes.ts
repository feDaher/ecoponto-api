import { Router } from "express";
import { env } from "../../../config/env";
import { prisma } from "../../../config/prisma";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { CollectionPointStatus, Role } from "../../../generated/prisma/enums";
import { AppError } from "../../../shared/errors/AppError";
import { assertOwner } from "../../../shared/security/access-policy";
import { ResolveLocationUseCase } from "../../geolocation/domain/use-cases/ResolveLocationUseCase";
import { GooglePlacesClient } from "../../places/infra/http/GooglePlacesClient";
import { SearchCollectionPointsUseCase } from "../domain/use-cases/SearchCollectionPointsUseCase";
import { PrismaCollectionPointSearchRepository } from "../infra/repositories/PrismaCollectionPointSearchRepository";
import { toPublicCollectionPoint } from "./collection-points.presenter";
import {
  collectionPointSchema,
  reviewSchema,
  searchCollectionPointsQuerySchema,
  type CollectionPointInput,
  type SearchCollectionPointsQuery,
} from "./collection-points.validators";

export const collectionPointsRoutes = Router();

const pointWithCollector = {
  collector: { select: { id: true, name: true, email: true } },
} as const;

// Moderation details are internal — never expose them on the public map.
const publicOmit = { rejectionReason: true, reviewedById: true, reviewedAt: true } as const;

const searchCollectionPoints = new SearchCollectionPointsUseCase(
  new PrismaCollectionPointSearchRepository(),
);

const resolveLocation = new ResolveLocationUseCase(new GooglePlacesClient(env.GOOGLE_MAPS_API_KEY));

async function withResolvedLocation(body: CollectionPointInput) {
  const { latitude, longitude, placeId, ...point } = body;
  const location = await resolveLocation.execute({ latitude, longitude, placeId });

  return {
    ...point,
    latitude: location.latitude,
    longitude: location.longitude,
    locationSource: location.source,
    placeId: location.placeId,
  };
}

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
 *         description: One or more comma-separated waste types (PLASTIC, PAPER, METALS, GLASS, COOKING_OIL, ELECTRONICS, BATTERIES, CELL_PHONES, COMPUTERS, PRINTERS, TELEVISIONS)
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
 *         description: Public collection points (approved only)
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
  async (req, res) => {
    const { city, wasteType, latitude, longitude, radius, limit } =
      req.query as unknown as SearchCollectionPointsQuery;

    const { items, total } = await searchCollectionPoints.execute({
      city,
      wasteTypes: wasteType,
      origin:
        latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined,
      radiusKm: radius,
      limit,
    });

    res.setHeader("X-Total-Count", String(total));
    res.status(200).json(
      items.map(({ point, distanceKm }) => ({
        ...toPublicCollectionPoint(point),
        ...(distanceKm === null ? {} : { distanceKm: Math.round(distanceKm * 100) / 100 }),
      })),
    );
  },
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
 */
collectionPointsRoutes.get(
  "/collection-points/mine",
  authenticate,
  authorize(Role.COLLECTOR),
  async (req, res) => {
    const points = await prisma.collectionPoint.findMany({
      where: { collectorId: req.user!.id },
      orderBy: { updatedAt: "desc" },
    });
    res.status(200).json(points);
  },
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
 */
collectionPointsRoutes.get(
  "/collection-points/admin/pending",
  authenticate,
  authorize(Role.ADMIN),
  async (_req, res) => {
    const points = await prisma.collectionPoint.findMany({
      where: { status: CollectionPointStatus.PENDING },
      include: pointWithCollector,
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json(points);
  },
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
 *         description: Point submitted for approval
 *       400:
 *         description: Malformed request body
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
  async (req, res) => {
    const point = await prisma.collectionPoint.create({
      data: { ...(await withResolvedLocation(req.body)), collectorId: req.user!.id },
    });
    res.status(201).json(point);
  },
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
 *         description: Approved collection point
 *       404:
 *         description: Point not found or not approved
 */
collectionPointsRoutes.get("/collection-points/:id", async (req, res) => {
  const pointId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const point = await prisma.collectionPoint.findFirst({
    where: { id: pointId, status: CollectionPointStatus.APPROVED },
    omit: publicOmit,
  });
  if (!point) throw new AppError("Ponto de coleta não encontrado", 404);
  res.status(200).json(toPublicCollectionPoint(point));
});

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
 *             $ref: '#/components/schemas/CollectionPointInput'
 *     responses:
 *       200:
 *         description: Updated point resubmitted for approval
 *       422:
 *         description: Missing or invalid location
 */
collectionPointsRoutes.put(
  "/collection-points/:id",
  authenticate,
  authorize(Role.COLLECTOR),
  validate(collectionPointSchema),
  async (req, res) => {
    const pointId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await prisma.collectionPoint.findUnique({
      where: { id: pointId },
    });
    if (!existing) throw new AppError("Ponto de coleta não encontrado", 404);
    assertOwner(
      req.user!,
      existing.collectorId,
      "Você só pode atualizar seus próprios pontos de coleta",
    );

    const point = await prisma.collectionPoint.update({
      where: { id: existing.id },
      data: {
        ...(await withResolvedLocation(req.body)),
        status: CollectionPointStatus.PENDING,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
        hoursConfirmedAt: new Date(),
        isOutdated: false,
      },
    });
    res.status(200).json(point);
  },
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
 *         description: Invalid decision or reason missing
 */
collectionPointsRoutes.patch(
  "/collection-points/:id/review",
  authenticate,
  authorize(Role.ADMIN),
  validate(reviewSchema),
  async (req, res) => {
    const pointId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await prisma.collectionPoint.findUnique({
      where: { id: pointId },
    });
    if (!existing) throw new AppError("Ponto de coleta não encontrado", 404);
    if (existing.status !== CollectionPointStatus.PENDING) {
      throw new AppError("Apenas pontos de coleta pendentes podem ser revisados", 400);
    }

    const point = await prisma.collectionPoint.update({
      where: { id: existing.id },
      data: {
        status: req.body.status,
        rejectionReason:
          req.body.status === CollectionPointStatus.REJECTED ? req.body.rejectionReason : null,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });
    res.status(200).json(point);
  },
);
