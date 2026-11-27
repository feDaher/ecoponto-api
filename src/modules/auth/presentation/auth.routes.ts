import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Role } from "../../../generated/prisma/enums";
import { auditSelf } from "../../../middlewares/audit-trail.middleware";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { changePassword, login, me, refresh, register } from "./auth.controller";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from "./auth.validators";

export const authRoutes = Router();

// Public credential routes: limit per IP on top of the global limiter to slow down password
// guessing and sign-up spam without blocking the rest of the API.
function authLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos." },
  });
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user (Citizen or Collector)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, phone, city]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *               city:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [CITIZEN, COLLECTOR]
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Invalid body
 *       409:
 *         description: Email already registered
 *       429:
 *         description: Too many attempts from this IP
 */
authRoutes.post("/auth/register", authLimiter(10), validate(registerSchema), register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Firebase ID token and user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 idToken: { type: string }
 *                 refreshToken: { type: string }
 *                 expiresIn: { type: string, example: "3600" }
 *                 user: { $ref: '#/components/schemas/UserProfile' }
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many attempts (this IP or Firebase lockout)
 *       502:
 *         description: Firebase answered with an unexpected error
 *       503:
 *         description: Firebase unreachable or timed out
 */
authRoutes.post("/auth/login", authLimiter(20), validate(loginSchema), login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new ID token (ID tokens expire after one hour)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New idToken, refreshToken and expiresIn (seconds), plus the current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 idToken: { type: string }
 *                 refreshToken: { type: string }
 *                 expiresIn: { type: string, example: "3600" }
 *                 user: { $ref: '#/components/schemas/UserProfile' }
 *       400:
 *         description: Invalid body
 *       401:
 *         description: Refresh token expired or revoked, or user not registered — log in again
 *       403:
 *         description: User account is blocked
 *       429:
 *         description: Too many attempts from this IP
 *       502:
 *         description: Firebase answered with an unexpected error
 *       503:
 *         description: Firebase unreachable or timed out
 */
// Higher limit than login: every signed-in app renews once an hour, and a classroom shares one IP.
authRoutes.post("/auth/refresh", authLimiter(60), validate(refreshSchema), refresh);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Missing, invalid or expired token
 */
authRoutes.get("/auth/me", authenticate, me);

// Same budget as login (20 per 15 min), but counted per user: the route is authenticated and a
// classroom shares one IP, so an IP key would throttle every student together.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `user:${req.user?.id}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos." },
});

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Change the logged-in user's password and get a new session
 *     description: >
 *       Confirms the current password with Firebase, sets the new one, revokes the refresh tokens
 *       of every other session (other devices are logged out) and signs in again with the new
 *       password, returning a session in the same shape as POST /auth/login so the client stays
 *       logged in. Passwords are never logged nor stored in the audit trail.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 maxLength: 128
 *                 description: At least one letter and one number, different from the current password
 *     responses:
 *       200:
 *         description: New session (idToken, refreshToken, expiresIn, user)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 idToken: { type: string }
 *                 refreshToken: { type: string }
 *                 expiresIn: { type: string, example: "3600" }
 *                 user: { $ref: '#/components/schemas/UserProfile' }
 *       400:
 *         description: Validation error (weak password, same as the current one, unknown field)
 *       401:
 *         description: Missing, invalid or expired token
 *       403:
 *         description: Blocked account
 *       422:
 *         description: "Current password is wrong: { message: \"A senha atual está incorreta.\" }"
 *       429:
 *         description: Too many attempts (20 per 15 minutes per user, or Firebase's own lockout)
 *       502:
 *         description: Firebase failed before the change; nothing was changed
 *       503:
 *         description: Firebase unreachable (network or timeout); nothing was changed
 */
authRoutes.post(
  "/auth/change-password",
  authenticate,
  authorize(Role.CITIZEN, Role.COLLECTOR, Role.ADMIN),
  auditSelf,
  changePasswordLimiter,
  validate(changePasswordSchema),
  changePassword,
);
