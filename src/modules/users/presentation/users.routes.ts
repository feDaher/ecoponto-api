import { Router } from "express";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { auditSelf } from "../../../middlewares/audit-trail.middleware";
import { Role } from "../../../generated/prisma/enums";
import {
  listUsers,
  blockUser,
  unblockUser,
  updateUserRole,
  updateOwnProfile,
  deleteOwnAccount,
} from "./users.controller";
import { updateUserRoleSchema } from "./validators/UpdateUserRoleValidator";
import { updateOwnProfileSchema } from "./validators/UpdateOwnProfileValidator";
import { validate } from "../../../middlewares/validate.middleware";

export const usersRoutes = Router();

/**
 * @openapi
 * /users/me:
 *   patch:
 *     summary: Update the authenticated user's own profile (name, phone and city)
 *     description: >
 *       The target is always the token's user. The email is the Firebase login and cannot be
 *       changed here; any field other than name, phone and city is rejected with 400.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [name, phone, city]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 191
 *                 example: Maria da Silva
 *                 description: First and last name; letters, spaces and ' . - only
 *               phone:
 *                 type: string
 *                 example: (33) 99999-9999
 *                 description: With or without mask; stored as digits only (DDD + number, 10 or 11 digits)
 *               city:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 191
 *                 example: Manhuaçu
 *               nickname:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 60
 *                 example: Mari
 *                 description: Optional. Letters, spaces and ' . - only; "" or null clears it; omitted keeps it
 *               preferences:
 *                 type: object
 *                 additionalProperties: false
 *                 description: >
 *                   Optional and partial: only the sent keys change. Turning cooperativeContact on
 *                   records the consent date (LGPD) the first time; turning it off clears it.
 *                 properties:
 *                   collectionAlerts: { type: boolean }
 *                   monthlyReports: { type: boolean }
 *                   cooperativeContact: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated user, in the same shape as the user returned by POST /auth/login
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UserProfile' }
 *       400:
 *         description: Invalid field or unknown field (e.g. email, role)
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Blocked account
 *       404:
 *         description: The token's user does not exist in the database
 *   delete:
 *     summary: Delete the authenticated user's own account (LGPD right to erasure)
 *     description: >
 *       The local row is anonymized (name, email, phone and city replaced, account blocked) so
 *       disposals, reviews and reports stay consistent, and the Firebase account is deleted in the
 *       same transaction: if Firebase fails nothing is anonymized. The last active ADMIN cannot
 *       delete their own account.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account anonymized and Firebase login deleted
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Blocked account
 *       404:
 *         description: The token's user does not exist in the database
 *       409:
 *         description: The user is the last active administrator
 *       502:
 *         description: Firebase could not delete the login; nothing was changed, try again
 */
usersRoutes.patch(
  "/users/me",
  authenticate,
  authorize(Role.CITIZEN, Role.COLLECTOR, Role.ADMIN),
  auditSelf,
  validate(updateOwnProfileSchema),
  updateOwnProfile,
);

usersRoutes.delete(
  "/users/me",
  authenticate,
  authorize(Role.CITIZEN, Role.COLLECTOR, Role.ADMIN),
  auditSelf,
  deleteOwnAccount,
);

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
