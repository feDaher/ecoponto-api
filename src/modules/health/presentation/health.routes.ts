import { Router } from "express";
import { prisma } from "../../../config/prisma";

export const healthRoutes = Router();

const READY_TIMEOUT_MS = 3_000;

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness check (process is up; does not touch the database)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
healthRoutes.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     summary: Readiness check (the database answers)
 *     description: For load balancers and deploy platforms. Answers 503 when MySQL does not respond within 3 s.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Ready to serve traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 database:
 *                   type: string
 *                   example: up
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Database unavailable
 */
healthRoutes.get("/health/ready", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("database ping timed out")), READY_TIMEOUT_MS);
  });

  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    res.status(200).json({ status: "ok", database: "up", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[health] database not ready:", error instanceof Error ? error.message : error);
    res
      .status(503)
      .json({ status: "unavailable", database: "down", timestamp: new Date().toISOString() });
  } finally {
    clearTimeout(timer);
  }
});
