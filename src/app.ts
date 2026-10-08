import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { errorHandler } from "./middlewares/error-handler.middleware";
import { notFound } from "./middlewares/not-found.middleware";
import { authRoutes } from "./modules/auth/presentation/auth.routes";
import { healthRoutes } from "./modules/health/presentation/health.routes";
import { usersRoutes } from "./modules/users/presentation/users.routes";
import { adminRoutes } from "./modules/admin/presentation/admin.routes";
import { collectorRoutes } from "./modules/collector/presentation/collector.routes";
import { citizenRoutes } from "./modules/citizen/presentation/citizen.routes";
import { collectionPointsRoutes } from "./modules/collection-points/presentation/collection-points.routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
  }),
);
app.use(express.json());

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(healthRoutes);
app.use(authRoutes);
app.use(usersRoutes);
app.use(adminRoutes);
app.use(collectorRoutes);
app.use(citizenRoutes);
app.use(collectionPointsRoutes);

app.use(notFound);
app.use(errorHandler);
