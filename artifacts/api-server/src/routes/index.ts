import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import healthRouter from "./health";
import usersRouter from "./users";
import biometricsRouter from "./biometrics";
import sleepRouter from "./sleep";
import glucoseRouter from "./glucose";
import activityRouter from "./activity";
import stateRouter from "./state";
import interventionsRouter from "./interventions";
import mealsRouter from "./meals";
import supplementsRouter from "./supplements";
import integrationsRouter from "./integrations";
import dashboardRouter from "./dashboard";
import insightsRouter from "./insights";
import chatRouter from "./chat";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);

// All other routes require an authenticated Clerk session.
router.use(requireAuth);
router.use(usersRouter);
router.use(biometricsRouter);
router.use(sleepRouter);
router.use(glucoseRouter);
router.use(activityRouter);
router.use(stateRouter);
router.use(interventionsRouter);
router.use(mealsRouter);
router.use(supplementsRouter);
router.use(integrationsRouter);
router.use(dashboardRouter);
router.use(insightsRouter);
router.use(chatRouter);

export default router;
