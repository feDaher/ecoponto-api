import { Router } from "express";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { prisma } from "../../../config/prisma";
import { Role } from "../../../generated/prisma/enums";

export const usersRoutes = Router();

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List all users (Administrator only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 */
usersRoutes.get("/users", authenticate, authorize(Role.ADMIN), async (_req, res) => {
  const users = await prisma.user.findMany();
  res.status(200).json(users);
});
