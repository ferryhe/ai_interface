import { Router, type IRouter } from "express";
import {
  CreateModuleRunArtifactBody,
  CreateModuleRunArtifactParams,
  CreateModuleRunBody,
  CreateModuleRunEventBody,
  CreateModuleRunEventParams,
  CreateModuleRunInteractionBody,
  CreateModuleRunInteractionParams,
  CreateModuleRunResponse,
  GetArtifactParams,
  GetArtifactResponse,
  GetModuleRunParams,
  GetModuleRunResponse,
  ListModulesResponse,
  ResumeModuleRunExecutionParams,
  ResumeModuleRunExecutionResponse,
  SubmitModuleRunFeedbackBody,
  SubmitModuleRunFeedbackParams,
  UpdateModuleRunBody,
  UpdateModuleRunParams,
  UpdateModuleRunResponse,
} from "@workspace/api-zod";

import type { AgentConfigRepository } from "../agent-config/agent-config-service";
import {
  createModuleRun,
  getModuleRunDetail,
  type ModuleRunRepository,
  recordModuleRunArtifact,
  recordModuleRunEvent,
  requestModuleRunInteraction,
  submitModuleRunFeedback,
  updateModuleRun,
} from "../modules/ingest-service";
import { moduleRegistry } from "../modules/registry";
import {
  ModuleRunResumeConflictError,
  resumeModuleRunExecution,
} from "../tool-adapters/resume-service";
import {
  isPortalRuntimeRequest,
  requirePortalRuntimeAccess,
} from "./portal-access-guard";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function createLazyDbModuleRunRepository(): ModuleRunRepository {
  let repository: ModuleRunRepository | null = null;

  async function getRepository(): Promise<ModuleRunRepository> {
    if (repository) return repository;
    const { DbModuleRunRepository } = await import("../modules/db-repository");
    repository = new DbModuleRunRepository();
    return repository;
  }

  return {
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

export function createModulesRouter(
  repository: ModuleRunRepository,
  agentConfigRepository: AgentConfigRepository,
): IRouter {
  const router: IRouter = Router();

  router.get("/modules", (_req, res) => {
    const data = ListModulesResponse.parse({ modules: moduleRegistry });
    res.json(data);
  });

  router.post("/module-runs", async (req, res) => {
    const body = CreateModuleRunBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    try {
      const result = await createModuleRun(repository, body.data);
      const data = CreateModuleRunResponse.parse(result);
      res.status(result.created ? 201 : 200).json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(errorResponse(message));
    }
  });

  router.get("/module-runs/:runId", async (req, res) => {
    const params = GetModuleRunParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }

    try {
      const detail = await getModuleRunDetail(repository, params.data.runId);
      const data = GetModuleRunResponse.parse(detail);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  router.patch("/module-runs/:runId", async (req, res) => {
    const params = UpdateModuleRunParams.safeParse(req.params);
    const body = UpdateModuleRunBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    try {
      const updated = await updateModuleRun(
        repository,
        params.data.runId,
        body.data,
      );
      const data = UpdateModuleRunResponse.parse(updated);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  router.post("/module-runs/:runId/events", async (req, res) => {
    const params = CreateModuleRunEventParams.safeParse(req.params);
    const body = CreateModuleRunEventBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    try {
      const event = await recordModuleRunEvent(
        repository,
        params.data.runId,
        body.data,
      );
      res.status(201).json(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  router.post("/module-runs/:runId/artifacts", async (req, res) => {
    const params = CreateModuleRunArtifactParams.safeParse(req.params);
    const body = CreateModuleRunArtifactBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    try {
      const artifact = await recordModuleRunArtifact(
        repository,
        params.data.runId,
        body.data,
      );
      const data = GetArtifactResponse.parse(artifact);
      res.status(201).json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  router.post("/module-runs/:runId/interactions", async (req, res) => {
    const params = CreateModuleRunInteractionParams.safeParse(req.params);
    const body = CreateModuleRunInteractionBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    try {
      const result = await requestModuleRunInteraction(
        repository,
        params.data.runId,
        body.data,
      );
      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  router.post("/module-runs/:runId/feedback", async (req, res) => {
    const params = SubmitModuleRunFeedbackParams.safeParse(req.params);
    const body = SubmitModuleRunFeedbackBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    if (isPortalRuntimeRequest(req, body.data.metadata)) {
      const access = await requirePortalRuntimeAccess(
        req,
        agentConfigRepository,
      );
      if (!access.allowed) {
        res.status(403).json(errorResponse(access.error));
        return;
      }
    }

    try {
      const result = await submitModuleRunFeedback(
        repository,
        params.data.runId,
        body.data,
      );
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  router.post("/module-runs/:runId/resume", async (req, res) => {
    const params = ResumeModuleRunExecutionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }

    if (isPortalRuntimeRequest(req)) {
      const access = await requirePortalRuntimeAccess(
        req,
        agentConfigRepository,
      );
      if (!access.allowed) {
        res.status(403).json(errorResponse(access.error));
        return;
      }
    }

    try {
      const result = await resumeModuleRunExecution(
        repository,
        params.data.runId,
      );
      const data = ResumeModuleRunExecutionResponse.parse(result);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("Module run not found")) {
        res.status(404).json(errorResponse(message));
        return;
      }
      if (error instanceof ModuleRunResumeConflictError) {
        res.status(409).json(errorResponse(message));
        return;
      }
      res
        .status(500)
        .json(errorResponse("Failed to resume module run execution"));
    }
  });

  router.get("/artifacts/:artifactId", async (req, res) => {
    const params = GetArtifactParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }

    const artifact = await repository.findArtifactById(params.data.artifactId);
    if (!artifact) {
      res
        .status(404)
        .json(errorResponse(`Artifact not found: ${params.data.artifactId}`));
      return;
    }

    const data = GetArtifactResponse.parse(artifact);
    res.json(data);
  });

  return router;
}

const router = createModulesRouter(
  createLazyDbModuleRunRepository(),
  createLazyDbAgentConfigRepository(),
);

export default router;
