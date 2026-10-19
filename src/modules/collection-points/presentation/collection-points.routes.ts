import { Router } from "express";
import { prisma } from "../../../config/prisma";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { CollectionPointStatus, Role } from "../../../generated/prisma/enums";
import { AppError } from "../../../shared/errors/AppError";
import { collectionPointSchema, reviewSchema } from "./collection-points.validators";

export const collectionPointsRoutes = Router();

const pointWithCollector = {
  collector: { select: { id: true, name: true, email: true } },
} as const;

// Moderation details are internal — never expose them on the public map.
const publicOmit = { rejectionReason: true, reviewedById: true, reviewedAt: true } as const;

const wasteTypes = [
  "PLASTIC",
  "PAPER",
  "METALS",
  "GLASS",
  "COOKING_OIL",
  "ELECTRONICS",
  "BATTERIES",
  "CELL_PHONES",
  "COMPUTERS",
  "PRINTERS",
  "TELEVISIONS",
] as const;

const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * @openapi
 * /collection-points:
 *   get:
 *     summary: List approved collection points for the public map
 *     tags: [Collection Points]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: wasteType
 *         schema:
 *           type: string
 *           enum: [PLASTIC, PAPER, METALS, GLASS, COOKING_OIL, ELECTRONICS, BATTERIES, CELL_PHONES, COMPUTERS, PRINTERS, TELEVISIONS]
 *         description: Filter by waste type
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: Latitude de referência para busca por proximidade
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: Longitude de referência para busca por proximidade
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Raio máximo da busca em quilômetros
 *     responses:
 *       200:
 *         description: Public collection points (approved only)
 */
collectionPointsRoutes.get("/collection-points", async (req, res) => {
  const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;

  const wasteType =
    typeof req.query.wasteType === "string" ? req.query.wasteType.trim() : undefined;

  const wasteTypeNames: Record<string, string> = {
    PLASTIC: "Plástico",
    PAPER: "Papel",
    METALS: "Metais",
    GLASS: "Vidro",
    COOKING_OIL: "Óleo de cozinha",
    ELECTRONICS: "Eletrônicos",
    BATTERIES: "Pilhas e baterias",
    CELL_PHONES: "Celulares",
    COMPUTERS: "Computadores",
    PRINTERS: "Impressoras",
    TELEVISIONS: "Televisões",
  };

  if (wasteType && !wasteTypes.includes(wasteType as (typeof wasteTypes)[number])) {
    throw new AppError(`Tipo de resíduo inválido. Valores aceitos: ${wasteTypes.join(", ")}`, 400);
  }
  const wasteTypeName = wasteType ? wasteTypeNames[wasteType] : undefined;

  const latitude = typeof req.query.latitude === "string" ? Number(req.query.latitude) : undefined;

  const longitude =
    typeof req.query.longitude === "string" ? Number(req.query.longitude) : undefined;

  const radius = typeof req.query.radius === "string" ? Number(req.query.radius) : undefined;
  if (
    (latitude !== undefined && !Number.isFinite(latitude)) ||
    (longitude !== undefined && !Number.isFinite(longitude)) ||
    (radius !== undefined && (!Number.isFinite(radius) || radius <= 0))
  ) {
    throw new AppError("Latitude, longitude ou raio inválido.", 400);
  }

  if (
    (latitude === undefined) !== (longitude === undefined) ||
    (radius !== undefined && (latitude === undefined || longitude === undefined))
  ) {
    throw new AppError("Informe latitude e longitude juntas; o raio exige ambas.", 400);
  }

  if (
    (latitude !== undefined && (latitude < -90 || latitude > 90)) ||
    (longitude !== undefined && (longitude < -180 || longitude > 180))
  ) {
    throw new AppError("Coordenadas fora dos limites válidos.", 400);
  }
  const points = await prisma.collectionPoint.findMany({
    where: {
      status: CollectionPointStatus.APPROVED,
      ...(city ? { city: { equals: city } } : {}),
      ...(wasteType
        ? {
            categories: {
              some: {
                category: {
                  name: {
                    equals: wasteTypeName,
                  },
                  active: true,
                },
              },
            },
          }
        : {}),
    },

    omit: publicOmit,
    orderBy: { name: "asc" },
  });
  const filteredPoints =
    latitude !== undefined && longitude !== undefined && radius !== undefined
      ? points.filter((point) => {
          if (point.latitude == null || point.longitude == null) {
            return false;
          }

          const distance = calculateDistanceKm(
            latitude,
            longitude,
            Number(point.latitude),
            Number(point.longitude),
          );

          return distance <= radius;
        })
      : points;
  res.status(200).json(
    filteredPoints.map((point) => ({
      ...point,
      whatsappContact: point.showWhatsappContact ? point.whatsappContact : null,
    })),
  );
});

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
 */
collectionPointsRoutes.post(
  "/collection-points",
  authenticate,
  authorize(Role.COLLECTOR),
  validate(collectionPointSchema),
  async (req, res) => {
    const point = await prisma.collectionPoint.create({
      data: { ...req.body, collectorId: req.user!.id },
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
  res.status(200).json({
    ...point,
    whatsappContact: point.showWhatsappContact ? point.whatsappContact : null,
  });
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
    if (existing.collectorId !== req.user!.id) {
      throw new AppError("Você só pode atualizar seus próprios pontos de coleta", 403);
    }

    const point = await prisma.collectionPoint.update({
      where: { id: existing.id },
      data: {
        ...req.body,
        status: CollectionPointStatus.PENDING,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
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
