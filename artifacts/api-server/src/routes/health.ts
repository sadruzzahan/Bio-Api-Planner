import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function healthHandler(_req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
}

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

export default router;
