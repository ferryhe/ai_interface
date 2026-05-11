import { Router, type IRouter } from "express";
import agentConfigRouter from "./agent-config";
import agentRunsRouter from "./agent-runs";
import healthRouter from "./health";
import modulesRouter from "./modules";

const router: IRouter = Router();

router.use(agentConfigRouter);
router.use(agentRunsRouter);
router.use(healthRouter);
router.use(modulesRouter);

export default router;
