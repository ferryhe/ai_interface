import { Router, type IRouter } from "express";
import healthRouter from "./health";
import modulesRouter from "./modules";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modulesRouter);

export default router;
