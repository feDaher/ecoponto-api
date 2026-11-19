import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { auditTrail } from "./middlewares/audit-trail.middleware";
import { errorHandler } from "./middlewares/error-handler.middleware";
import { notFound } from "./middlewares/not-found.middleware";
import { authRoutes } from "./modules/auth/presentation/auth.routes";
import { healthRoutes } from "./modules/health/presentation/health.routes";
import { usersRoutes } from "./modules/users/presentation/users.routes";
import { educationalContentRoutes } from "./modules/educational-content/presentation/educational-content.routes";
import { wasteCategoriesRoutes } from "./modules/waste-categories/presentation/waste-categories.routes";
import { operatingHoursRoutes } from "./modules/operating-hours/presentation/operating-hours.routes";
import { adminRoutes } from "./modules/admin/presentation/admin.routes";
import { collectorRoutes } from "./modules/collector/presentation/collector.routes";
import { citizenRoutes } from "./modules/citizen/presentation/citizen.routes";
import { collectionPointsRoutes } from "./modules/collection-points/presentation/collection-points.routes";
import { placesRoutes } from "./modules/places/presentation/places.routes";
import { reportsRoutes } from "./modules/reports/presentation/reports.routes";
import { auditLogRoutes } from "./modules/audit/presentation/audit-logs.routes";
import { reviewsRoutes } from "./modules/reviews/presentation/reviews.routes";
import { disposalsRoutes } from "./modules/disposals/presentation/disposals.routes";
import { rankingRoutes } from "./modules/ranking/presentation/ranking.routes";

export const app = express();

// Off unless TRUST_PROXY is set: behind a reverse proxy, req.ip (and so every rate limiter)
// would otherwise see the proxy's IP and throttle all users together.
app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS ?? "*", exposedHeaders: ["X-Total-Count"] }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.RATE_LIMIT_MAX,
    // Platform health probes must never be throttled into a false "down".
    skip: (req) => req.path === "/health" || req.path === "/health/ready",
  }),
);
app.use(express.json());
app.use(auditTrail);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(healthRoutes);
app.use(authRoutes);
app.use(usersRoutes);
app.use(educationalContentRoutes);
app.use(wasteCategoriesRoutes);
app.use(operatingHoursRoutes);
app.use(adminRoutes);
app.use(collectorRoutes);
app.use(citizenRoutes);
app.use(collectionPointsRoutes);
app.use(placesRoutes);
app.use(reportsRoutes);
app.use(auditLogRoutes);
app.use(reviewsRoutes);
app.use(disposalsRoutes);
app.use(rankingRoutes);

app.use(notFound);
app.use(errorHandler);
