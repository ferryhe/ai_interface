import { Router, type IRouter } from "express";
import {
  CreateAgentRunBody,
  CreateAgentRunResponse,
  GetAgentRunParams,
  GetAgentRunResponse,
} from "@workspace/api-zod";

import {
  createAgentRun,
  getAgentRunDetail,
  type AgentRuntimeRepository,
} from "../agent-runtime/agent-runtime-service";
import type { AgentConfigRepository } from "../agent-config/agent-config-service";
import {
  isPortalRuntimeRequest,
  requirePortalRuntimeAccess,
} from "./portal-access-guard";
import { createLazyRepository } from "./lazy-repository";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

const lazyRuntimeRepository = createLazyRepository<AgentRuntimeRepository>(
  async () => {
    const { DbAgentRuntimeRepository } = await import(
      "../agent-runtime/db-repository"
    );
    return new DbAgentRuntimeRepository();
  },
);

const lazyConfigRepository = createLazyRepository<AgentConfigRepository>(
  async () => {
    const { DbAgentConfigRepository } = await import(
      "../agent-config/db-repository"
    );
    return new DbAgentConfigRepository();
  },
);

export function createAgentRunsRouter(
  runtimeRepository: AgentRuntimeRepository,
  configRepository: AgentConfigRepository,
): IRouter {
  const router: IRouter = Router();

  router.post("/agent-runs", async (req, res) => {
    const body = CreateAgentRunBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    if (isPortalRuntimeRequest(req, body.data.metadata)) {
      const access = await requirePortalRuntimeAccess(req, configRepository);
      if (!access.allowed) {
        res.status(403).json(errorResponse(access.error));
        return;
      }
    }

    try {
      const result = await createAgentRun(
        runtimeRepository,
        configRepository,
        body.data,
      );
      const data = CreateAgentRunResponse.parse(result);
      res.status(201).json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(errorResponse(message));
    }
  });

  router.get("/agent-runs/:pipelineRunId", async (req, res) => {
    const params = GetAgentRunParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }

    if (isPortalRuntimeRequest(req)) {
      const access = await requirePortalRuntimeAccess(req, configRepository);
      if (!access.allowed) {
        res.status(403).json(errorResponse(access.error));
        return;
      }
    }

    try {
      const detail = await getAgentRunDetail(
        runtimeRepository,
        params.data.pipelineRunId,
      );
      const data = GetAgentRunResponse.parse(detail);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  return router;
}

const router = createAgentRunsRouter(
  lazyRuntimeRepository,
  lazyConfigRepository,
);

export default router;
