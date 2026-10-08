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

/**
 * @openapi
 * /collection-points:
 *   get:
 *     summary: List approved collection points for the public map
 *     tags: [Collection Points]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Public collection points (approved only)
 */
collectionPointsRoutes.get("/collection-points", async (req, res) => {
  const city = typeof req.query.city === "string" ? req.query.city : undefined;
  const points = await prisma.collectionPoint.findMany({
    where: {
      status: CollectionPointStatus.APPROVED,
      ...(city ? { city: { equals: city } } : {}),
    },
    omit: publicOmit,
    orderBy: { name: "asc" },
  });
  res.status(200).json(
    points.map((point) => ({
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
