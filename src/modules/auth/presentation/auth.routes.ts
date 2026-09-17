import { Router } from "express";
import { authenticate } from "../../../middlewares/authenticate.middleware";
import { validate } from "../../../middlewares/validate.middleware";
import { login, me, register } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validators";

export const authRoutes = Router();

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
 *       409:
 *         description: Email already registered
 */
authRoutes.post("/auth/register", validate(registerSchema), register);

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
 */
authRoutes.post("/auth/login", validate(loginSchema), login);

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
