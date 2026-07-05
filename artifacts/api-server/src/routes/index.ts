import { Router, type IRouter } from "express";
import { InMemoryAgentConfigRepository } from "../agent-config/agent-config-service";
import { InMemoryAgentRuntimeRepository } from "../agent-runtime/agent-runtime-service";
import { InMemoryMissionRepository } from "../mission/in-memory-mission-repository";
import { createAgentConfigRouter } from "./agent-config";
import agentManifestsRouter from "./agent-manifests";
import agentRunsRouter, { createAgentRunsRouter } from "./agent-runs";
import agentsRouter from "./agents";
import agentConfigRouter from "./agent-config";
import { createApprovalsRouter } from "./approvals";
import approvalsRouter from "./approvals";
import climateMonitorRouter from "./climate-monitor";
import healthRouter from "./health";
import { createMissionsRouter } from "./missions";
import missionsRouter from "./missions";
import { createModulesRouter } from "./modules";
import modulesRouter from "./modules";
import pipelinesRouter from "./pipelines";
import { createPortalAuthRouter } from "./portal-auth";
import portalAuthRouter from "./portal-auth";
import { portalSurfaceDenyByDefault } from "./portal-access-guard";
import { localAdminSurfaceGuard } from "./local-admin-guard";
import { createRunInspectorRouter } from "./run-inspector";
import runInspectorRouter from "./run-inspector";
import skillsRouter from "./skills";
import teamsRouter from "./teams";
import toolAdaptersRouter from "./tool-adapters";

export function createDatabaseRouter(): IRouter {
  const router: IRouter = Router();

  router.use(portalSurfaceDenyByDefault);
  router.use(localAdminSurfaceGuard);

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

  return router;
}

export function createMemoryRouter(): IRouter {
  const router: IRouter = Router();
  const configRepository = new InMemoryAgentConfigRepository();
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const missionRepository = new InMemoryMissionRepository();

  router.use(portalSurfaceDenyByDefault);
  router.use(localAdminSurfaceGuard);

  router.use(agentManifestsRouter);
  router.use(agentsRouter);
  router.use(createAgentConfigRouter(configRepository));
  router.use(createAgentRunsRouter(runtimeRepository, configRepository));
  router.use(createApprovalsRouter(runtimeRepository, configRepository));
  router.use(climateMonitorRouter);
  router.use(healthRouter);
  router.use(
    createMissionsRouter(
      missionRepository,
      configRepository,
      runtimeRepository,
    ),
  );
  router.use(createModulesRouter(runtimeRepository, configRepository));
  router.use(pipelinesRouter);
  router.use(createPortalAuthRouter(configRepository));
  router.use(createRunInspectorRouter(runtimeRepository));
  router.use(skillsRouter);
  router.use(teamsRouter);
  router.use(toolAdaptersRouter);

  return router;
}

export function createApiRouter(
  env: Record<string, string | undefined> = process.env,
): IRouter {
  return env["AI_INTERFACE_REPOSITORY_MODE"] === "memory"
    ? createMemoryRouter()
    : createDatabaseRouter();
}

const router = createApiRouter();

export default router;
