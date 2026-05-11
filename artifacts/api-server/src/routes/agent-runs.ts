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

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function createLazyDbAgentRuntimeRepository(): AgentRuntimeRepository {
  let repository: AgentRuntimeRepository | null = null;

  async function getRepository(): Promise<AgentRuntimeRepository> {
    if (repository) return repository;
    const { DbAgentRuntimeRepository } =
      await import("../agent-runtime/db-repository");
    repository = new DbAgentRuntimeRepository();
    return repository;
  }

  return {
    async createThread(input) {
      return (await getRepository()).createThread(input);
    },
    async findThreadById(id) {
      return (await getRepository()).findThreadById(id);
    },
    async createMessage(input) {
      return (await getRepository()).createMessage(input);
    },
    async listMessages(threadId) {
      return (await getRepository()).listMessages(threadId);
    },
    async createPipelineRun(input) {
      return (await getRepository()).createPipelineRun(input);
    },
    async updatePipelineRun(id, input) {
      return (await getRepository()).updatePipelineRun(id, input);
    },
    async findPipelineRunById(id) {
      return (await getRepository()).findPipelineRunById(id);
    },
    async listModuleRunsByPipelineRunId(pipelineRunId) {
      return (await getRepository()).listModuleRunsByPipelineRunId(
        pipelineRunId,
      );
    },
    async findModuleRunByExternalId(moduleId, externalRunId) {
      return (await getRepository()).findModuleRunByExternalId(
        moduleId,
        externalRunId,
      );
    },
    async createModuleRun(input) {
      return (await getRepository()).createModuleRun(input);
    },
    async updateModuleRun(id, input) {
      return (await getRepository()).updateModuleRun(id, input);
    },
    async consumeResumableInteraction(id, interactionId, interaction) {
      return (await getRepository()).consumeResumableInteraction(
        id,
        interactionId,
        interaction,
      );
    },
    async pipelineRunExists(id) {
      return (await getRepository()).pipelineRunExists(id);
    },
    async findModuleRunById(id) {
      return (await getRepository()).findModuleRunById(id);
    },
    async createRunEvent(input) {
      return (await getRepository()).createRunEvent(input);
    },
    async createArtifact(input) {
      return (await getRepository()).createArtifact(input);
    },
    async findArtifactById(id) {
      return (await getRepository()).findArtifactById(id);
    },
    async listRunEvents(moduleRunId) {
      return (await getRepository()).listRunEvents(moduleRunId);
    },
    async listRunArtifacts(moduleRunId) {
      return (await getRepository()).listRunArtifacts(moduleRunId);
    },
  };
}

function createLazyDbAgentConfigRepository(): AgentConfigRepository {
  let repository: AgentConfigRepository | null = null;

  async function getRepository(): Promise<AgentConfigRepository> {
    if (repository) return repository;
    const { DbAgentConfigRepository } =
      await import("../agent-config/db-repository");
    repository = new DbAgentConfigRepository();
    return repository;
  }

  return {
    async findConfig(configKey) {
      return (await getRepository()).findConfig(configKey);
    },
    async upsertConfig(input) {
      return (await getRepository()).upsertConfig(input);
    },
  };
}

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
  createLazyDbAgentRuntimeRepository(),
  createLazyDbAgentConfigRepository(),
);

export default router;
