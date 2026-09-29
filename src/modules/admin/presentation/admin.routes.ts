import { Router } from "express";

import { authenticate } from "../../../middlewares/authenticate.middleware";
import { authorize } from "../../../middlewares/authorize.middleware";

const router = Router();

router.get("/admin", authenticate, authorize("ADMIN"), (req, res) => {
  res.json({
    message: "Acesso permitido para administrador",
  });
});

export { router as adminRoutes };
