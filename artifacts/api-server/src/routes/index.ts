import { Router, type IRouter } from "express";
import agentsRouter from "./agents";
import agentConfigRouter from "./agent-config";
import agentRunsRouter from "./agent-runs";
import climateMonitorRouter from "./climate-monitor";
import healthRouter from "./health";
import modulesRouter from "./modules";
import pipelinesRouter from "./pipelines";
import portalAuthRouter from "./portal-auth";
import skillsRouter from "./skills";
import toolAdaptersRouter from "./tool-adapters";

const router: IRouter = Router();

router.use(agentsRouter);
router.use(agentConfigRouter);
router.use(agentRunsRouter);
router.use(climateMonitorRouter);
router.use(healthRouter);
router.use(modulesRouter);
router.use(pipelinesRouter);
router.use(portalAuthRouter);
router.use(skillsRouter);
router.use(toolAdaptersRouter);

export default router;
