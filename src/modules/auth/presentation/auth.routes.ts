import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { login, me, register } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validators";

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
