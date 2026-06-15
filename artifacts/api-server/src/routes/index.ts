import { Router, type IRouter } from "express";
import agentManifestsRouter from "./agent-manifests";
import agentsRouter from "./agents";
import agentConfigRouter from "./agent-config";
import agentRunsRouter from "./agent-runs";
import approvalsRouter from "./approvals";
import climateMonitorRouter from "./climate-monitor";
import healthRouter from "./health";
import missionsRouter from "./missions";
import modulesRouter from "./modules";
import pipelinesRouter from "./pipelines";
import portalAuthRouter from "./portal-auth";
import runInspectorRouter from "./run-inspector";
import skillsRouter from "./skills";
import teamsRouter from "./teams";
import toolAdaptersRouter from "./tool-adapters";

const router: IRouter = Router();

router.use(agentManifestsRouter);
router.use(agentsRouter);
router.use(agentConfigRouter);
router.use(agentRunsRouter);
router.use(approvalsRouter);
router.use(climateMonitorRouter);
router.use(healthRouter);
router.use(missionsRouter);
router.use(modulesRouter);
router.use(pipelinesRouter);
router.use(portalAuthRouter);
router.use(runInspectorRouter);
router.use(skillsRouter);
router.use(teamsRouter);
router.use(toolAdaptersRouter);

export default router;
