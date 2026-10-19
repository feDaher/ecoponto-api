import { Router } from "express";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { Role } from "../../../generated/prisma/enums";

export const adminRoutes = Router();

/**
 * @openapi
 * /admin:
 *   get:
 *     summary: Administrator area (Administrator only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted to the administrator
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
adminRoutes.get("/admin", authenticate, authorize(Role.ADMIN), (req, res) => {
  res.status(200).json({ message: "Access granted to administrator", user: req.user });
});
