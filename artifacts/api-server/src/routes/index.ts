import { Router, type IRouter } from "express";
import agentConfigRouter from "./agent-config";
import healthRouter from "./health";
import modulesRouter from "./modules";

const router: IRouter = Router();

router.use(agentConfigRouter);
router.use(healthRouter);
router.use(modulesRouter);

export default router;
