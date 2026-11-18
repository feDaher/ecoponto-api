import { Router } from "express";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { Role } from "../../../generated/prisma/enums";
import { listUsers, blockUser, unblockUser, updateUserRole } from "./users.controller";
import { updateUserRoleSchema } from "./validators/UpdateUserRoleValidator";
import { validate } from "../../../middlewares/validate.middleware";

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

usersRoutes.get("/users", authenticate, authorize(Role.ADMIN), listUsers);

/**
 * @swagger
 * /users/{id}/block:
 *   patch:
 *     summary: Bloquear usuário
 *     description: Permite que um administrador bloqueie um usuário.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Usuário bloqueado com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 */
usersRoutes.patch("/users/:id/block", authenticate, authorize(Role.ADMIN), blockUser);

/**
 * @swagger
 * /users/{id}/unblock:
 *   patch:
 *     summary: Desbloquear usuário
 *     description: Permite que um administrador desbloqueie um usuário.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Usuário desbloqueado com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 */
usersRoutes.patch("/users/:id/unblock", authenticate, authorize(Role.ADMIN), unblockUser);

/**
 * @openapi
 * /users/{id}/role:
 *   patch:
 *     summary: Update user role (Administrator only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [CITIZEN, COLLECTOR, ADMIN]
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Invalid role or request
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Authenticated user is not an Administrator
 *       404:
 *         description: User not found
 */
usersRoutes.patch(
  "/users/:id/role",
  authenticate,
  authorize(Role.ADMIN),
  validate(updateUserRoleSchema),
  updateUserRole,
);
