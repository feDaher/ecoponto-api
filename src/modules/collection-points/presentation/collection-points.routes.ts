import { Router } from "express";
import { env } from "../../../config/env";
import { prisma } from "../../../config/prisma";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { CollectionPointStatus, Role } from "../../../generated/prisma/enums";
import { AppError } from "../../../shared/errors/AppError";
import { assertOwner } from "../../../shared/security/access-policy";
import { toTime } from "../../../shared/time/time-of-day";
import { ResolveLocationUseCase } from "../../geolocation/domain/use-cases/ResolveLocationUseCase";
import { GooglePlacesClient } from "../../places/infra/http/GooglePlacesClient";
import { SearchCollectionPointsUseCase } from "../domain/use-cases/SearchCollectionPointsUseCase";
import { PrismaCollectionPointSearchRepository } from "../infra/repositories/PrismaCollectionPointSearchRepository";
import {
  activeHoursInclude,
  withFormattedHours,
} from "../infra/repositories/operating-hours.include";
import { toPublicCollectionPoint } from "./collection-points.presenter";
import { PrismaWasteCategoryRepository } from "../../waste-categories/infra/repositories/PrismaWasteCategoryRepository";
import {
  collectionPointSchema,
  collectionPointUpdateSchema,
  reviewSchema,
  searchCollectionPointsQuerySchema,
  type CollectionPointInput,
  type CollectionPointUpdateInput,
  type SearchCollectionPointsQuery,
} from "./collection-points.validators";

export const collectionPointsRoutes = Router();

const pointWithCollector = {
  collector: { select: { id: true, name: true, email: true } },
} as const;

const pointWithCategories = {
  categories: { include: { category: { select: { name: true } } } },
} as const;

const pointWithCategoriesAndHours = { ...pointWithCategories, ...activeHoursInclude };

// Moderation details are internal — never expose them on the public map.
const publicOmit = { rejectionReason: true, reviewedById: true, reviewedAt: true } as const;

const searchCollectionPoints = new SearchCollectionPointsUseCase(
  new PrismaCollectionPointSearchRepository(),
);

const resolveLocation = new ResolveLocationUseCase(new GooglePlacesClient(env.GOOGLE_MAPS_API_KEY));
const wasteCategoryRepository = new PrismaWasteCategoryRepository();

type PointWithCategories = {
  categories: { category: { name: string } }[];
};

function serializePoint<T extends PointWithCategories>(point: T) {
  const { categories, ...pointData } = point;
  return {
    ...pointData,
    wasteCategories: categories.map(({ category }) => category.name).sort(),
  };
}

async function findActiveWasteCategories(codes: string[]) {
  const categories = await wasteCategoryRepository.findActiveByNames(codes);
  const activeCodes = new Set(categories.map(({ name }) => name));
  const invalidCodes = codes.filter((code) => !activeCodes.has(code));

  if (invalidCodes.length > 0) {
    throw new AppError(
      `Categorias de resíduos inexistentes ou inativas: ${invalidCodes.join(", ")}`,
      400,
    );
  }

  return categories;
}

async function withResolvedLocation(body: CollectionPointUpdateInput) {
  const { latitude, longitude, placeId } = body;
  const location = await resolveLocation.execute({ latitude, longitude, placeId });

  return {
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
 *         description: One or more comma-separated active waste category codes from GET /waste-categories (e.g. PLASTIC, GLASS). Unknown or inactive codes return 400.
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
 *         description: Public collection points (approved only), each with its active operating hours in the hours field
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

    const [, { items, total }] = await Promise.all([
      wasteType ? findActiveWasteCategories(wasteType) : undefined,
      searchCollectionPoints.execute({
        city,
        wasteTypes: wasteType,
        origin:
          latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined,
        radiusKm: radius,
        limit,
      }),
    ]);

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
      include: pointWithCategoriesAndHours,
    });
    res.status(200).json(points.map((point) => serializePoint(withFormattedHours(point))));
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
      include: { ...pointWithCollector, ...pointWithCategoriesAndHours },
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json(points.map((point) => serializePoint(withFormattedHours(point))));
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
 *         description: Point submitted for approval, with its operating hours (field `hours`, read from the OperatingHours table)
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
    const { wasteCategories, operatingHours, ...pointData } = req.body as CollectionPointInput;
    const categories = await findActiveWasteCategories(wasteCategories);
    const point = await prisma.collectionPoint.create({
      data: {
        ...pointData,
        ...(await withResolvedLocation(req.body)),
        collectorId: req.user!.id,
        categories: {
          create: categories.map(({ id }) => ({ category: { connect: { id } } })),
        },
        hours: {
          create: operatingHours.map((hour) => ({
            weekday: hour.weekday,
            openTime: toTime(hour.openTime),
            closeTime: toTime(hour.closeTime),
          })),
        },
      },
      include: pointWithCategoriesAndHours,
    });
    res.status(201).json(serializePoint(withFormattedHours(point)));
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
 *         description: Approved collection point, with its active operating hours in the hours field
 *       404:
 *         description: Point not found or not approved
 */
collectionPointsRoutes.get("/collection-points/:id", async (req, res) => {
  const pointId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const point = await prisma.collectionPoint.findFirst({
    where: { id: pointId, status: CollectionPointStatus.APPROVED },
    omit: publicOmit,
    include: pointWithCategoriesAndHours,
  });
  if (!point) throw new AppError("Ponto de coleta não encontrado", 404);
  res.status(200).json(toPublicCollectionPoint(serializePoint(withFormattedHours(point))));
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
 *             $ref: '#/components/schemas/CollectionPointUpdateInput'
 *     responses:
 *       200:
 *         description: Updated point resubmitted for approval. Operating hours are not changed here; use /collection-points/{id}/operating-hours
 *       422:
 *         description: Missing or invalid location
 */
collectionPointsRoutes.put(
  "/collection-points/:id",
  authenticate,
  authorize(Role.COLLECTOR),
  validate(collectionPointUpdateSchema),
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

    // Horários não são alterados aqui: só pelas rotas /collection-points/:id/operating-hours.
    const { wasteCategories, ...pointData } = req.body as CollectionPointUpdateInput;
    const categories = await findActiveWasteCategories(wasteCategories);
    const point = await prisma.collectionPoint.update({
      where: { id: existing.id },
      data: {
        ...pointData,
        ...(await withResolvedLocation(req.body)),
        categories: {
          deleteMany: {},
          create: categories.map(({ id }) => ({ category: { connect: { id } } })),
        },
        status: CollectionPointStatus.PENDING,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
      include: pointWithCategoriesAndHours,
    });
    res.status(200).json(serializePoint(withFormattedHours(point)));
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
      include: pointWithCategories,
    });
    res.status(200).json(serializePoint(point));
  },
);
