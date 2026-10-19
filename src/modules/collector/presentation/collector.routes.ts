import { Router } from "express";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { Role } from "../../../generated/prisma/enums";

export const collectorRoutes = Router();

/**
 * @openapi
 * /collector:
 *   get:
 *     summary: Collector area (Collector only)
 *     tags: [Collector]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted to the collector
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not a Collector
 */
collectorRoutes.get("/collector", authenticate, authorize(Role.COLLECTOR), (req, res) => {
  res.status(200).json({ message: "Access granted to collector", user: req.user });
});
