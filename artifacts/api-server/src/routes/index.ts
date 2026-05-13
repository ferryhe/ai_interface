import { Router, type IRouter } from "express";
import agentConfigRouter from "./agent-config";
import agentRunsRouter from "./agent-runs";
import healthRouter from "./health";
import modulesRouter from "./modules";
import portalAuthRouter from "./portal-auth";
import skillsRouter from "./skills";
import toolAdaptersRouter from "./tool-adapters";

const router: IRouter = Router();

router.use(agentConfigRouter);
router.use(agentRunsRouter);
router.use(healthRouter);
router.use(modulesRouter);
router.use(portalAuthRouter);
router.use(skillsRouter);
router.use(toolAdaptersRouter);

export default router;
