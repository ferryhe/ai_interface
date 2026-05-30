import { Router, type IRouter } from "express";
import {
  ApproveMissionBody,
  ApproveMissionParams,
  ApproveMissionResponse,
  CreateMissionBody,
  ExecuteMissionBody,
  ExecuteMissionParams,
  ExecuteMissionResponse,
  GetMissionParams,
  GetMissionResponse,
  ReviseMissionBody,
  ReviseMissionParams,
  ReviseMissionResponse,
} from "@workspace/api-zod";

import type { AgentConfigRepository } from "../agent-config/agent-config-service";
import {
  MissionRevisionConflictError,
  MissionValidationError,
  type MissionRepository,
} from "../mission/mission-repository";
import {
  approveMissionService,
  createMissionService,
  executeMissionService,
  getMissionService,
  reviseMissionService,
} from "../mission/mission-service";
import { createLazyRepository } from "./lazy-repository";
import {
  isPortalRuntimeRequest,
  requirePortalRuntimeAccess,
} from "./portal-access-guard";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function errorStatus(error: unknown): number {
  if (error instanceof MissionRevisionConflictError) {
    return error.statusCode;
  }
  if (error instanceof MissionValidationError) {
    return error.statusCode;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) {
    return 404;
  }
  if (error instanceof Error && error.name === "ZodError") {
    return 400;
  }
  return 500;
}

const lazyMissionRepository = createLazyRepository<MissionRepository>(async () => {
  const { DbMissionRepository } = await import("../mission/db-mission-repository");
  return new DbMissionRepository();
});

const lazyConfigRepository = createLazyRepository<AgentConfigRepository>(async () => {
  const { DbAgentConfigRepository } = await import("../agent-config/db-repository");
  return new DbAgentConfigRepository();
});

export function createMissionsRouter(
  repository: MissionRepository,
  configRepository: AgentConfigRepository,
): IRouter {
  const router: IRouter = Router();

  router.post("/missions", async (req, res) => {
    const body = CreateMissionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
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
      const created = await createMissionService(repository, body.data);
      res.status(201).json(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  router.get("/missions/:missionId", async (req, res) => {
    const params = GetMissionParams.safeParse(req.params);
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
      const mission = await getMissionService(repository, params.data.missionId);
      const data = GetMissionResponse.parse(mission);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  router.post("/missions/:missionId/revise", async (req, res) => {
    const params = ReviseMissionParams.safeParse(req.params);
    const body = ReviseMissionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      const errorMessage = !params.success
        ? params.error.message
        : body.error!.message;
      res.status(400).json(errorResponse(errorMessage));
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
      const revised = await reviseMissionService(
        repository,
        params.data.missionId,
        body.data,
      );
      const data = ReviseMissionResponse.parse(revised);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  router.post("/missions/:missionId/approve", async (req, res) => {
    const params = ApproveMissionParams.safeParse(req.params);
    const body = ApproveMissionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      const errorMessage = !params.success
        ? params.error.message
        : body.error!.message;
      res.status(400).json(errorResponse(errorMessage));
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
      const approved = await approveMissionService(
        repository,
        params.data.missionId,
        body.data,
      );
      const data = ApproveMissionResponse.parse(approved);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  router.post("/missions/:missionId/execute", async (req, res) => {
    const params = ExecuteMissionParams.safeParse(req.params);
    const body = ExecuteMissionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      const errorMessage = !params.success
        ? params.error.message
        : body.error!.message;
      res.status(400).json(errorResponse(errorMessage));
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
      const executed = await executeMissionService(
        repository,
        params.data.missionId,
        body.data,
      );
      const data = ExecuteMissionResponse.parse({
        ...executed,
        executionReadiness: {
          ready: false,
          status: "stubbed",
          message:
            "Mission execution has been marked as executing, but runtime orchestration is not connected yet.",
        },
      });
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(errorStatus(error)).json(errorResponse(message));
    }
  });

  return router;
}

const router = createMissionsRouter(lazyMissionRepository, lazyConfigRepository);

export default router;
