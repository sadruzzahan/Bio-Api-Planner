import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireConsent } from "../middlewares/requireConsent";
import healthRouter from "./health";
import { usersReadRouter, usersWriteRouter } from "./users";
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
import consentRouter from "./consent";
import privacyRouter from "./privacy";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);

// All other routes require an authenticated Clerk session.
router.use(requireAuth);

// Pre-consent allow-list. These endpoints MUST work before the user has
// recorded acceptance of the required legal documents:
//  - consent router        (GET /consent, POST /consent — recovery path)
//  - usersReadRouter       (GET /users/me only — frontend reads name/email
//                           to render the consent modal)
//  - privacy router        (DELETE /users/me, GET /users/me/export,
//                           /audit/log — the user must always be able to
//                           leave / export their data, even if they refuse
//                           to consent)
//
// Mutating profile writes (PATCH /users/me) deliberately live BELOW the
// consent gate so a non-consented user cannot make any state-changing
// call other than the explicit consent / deletion / export paths above.
router.use(consentRouter);
router.use(usersReadRouter);
router.use(privacyRouter);

// Server-side consent enforcement. Anything mounted below this line is
// inaccessible until the user has on-file acceptance for every required
// document at its current version.
router.use(requireConsent);

router.use(usersWriteRouter);

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
