import { Router } from "express";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { Role } from "../../../generated/prisma/enums";

export const citizenRoutes = Router();

/**
 * @openapi
 * /citizen:
 *   get:
 *     summary: Citizen area (Citizen only)
 *     tags: [Citizen]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted to the citizen
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not a Citizen
 */
citizenRoutes.get("/citizen", authenticate, authorize(Role.CITIZEN), (req, res) => {
  res.status(200).json({ message: "Access granted to citizen", user: req.user });
});
