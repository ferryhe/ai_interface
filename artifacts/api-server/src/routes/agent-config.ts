import { Router, type IRouter } from "express";
import type { Request } from "express";
import {
  GetAgentConfigResponse,
  TestAgentConfigConnectionResponse,
  UpdateAgentConfigBody,
  UpdateAgentConfigResponse,
} from "@workspace/api-zod";

import {
  getAgentConfig,
  getConnectionStatus,
  toPublicAgentConfig,
  updateAgentConfig,
  type AgentConfigRecord,
  type AgentConfigRepository,
} from "../agent-config/agent-config-service";
import { createLazyRepository } from "./lazy-repository";
import {
  isLoopbackRemoteAddress,
  localAdminGuardError,
} from "./local-admin-guard";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function configResponse(config: AgentConfigRecord) {
  return {
    config: toPublicAgentConfig(config),
    connection: getConnectionStatus(process.env, config),
  };
}

function agentConfigGuardError(req: Request, action: string): string | null {
  if (req.get("x-ai-interface-surface") === "agent-portal") {
    return "Agent config is not available to Portal runtime requests";
  }

  return localAdminGuardError(req, `agent config ${action}`);
}

export const __privateAgentConfigRouteGuards = {
  isLoopbackRemoteAddress,
};

export function createAgentConfigRouter(
  repository: AgentConfigRepository,
): IRouter {
  const router: IRouter = Router();

  router.get("/agent-config", async (req, res) => {
    const guardError = agentConfigGuardError(req, "read");
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    try {
      const config = await getAgentConfig(repository);
      const data = GetAgentConfigResponse.parse(configResponse(config));
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json(errorResponse(message));
    }
  });

  router.put("/agent-config", async (req, res) => {
    const guardError = agentConfigGuardError(req, "write");
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    const body = UpdateAgentConfigBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    try {
      const config = await updateAgentConfig(repository, body.data);
      const data = UpdateAgentConfigResponse.parse(configResponse(config));
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(errorResponse(message));
    }
  });

  router.post("/agent-config/test-connection", async (req, res) => {
    const guardError = agentConfigGuardError(req, "connection test");
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    try {
      const config = await getAgentConfig(repository);
      const data = TestAgentConfigConnectionResponse.parse({
        ...getConnectionStatus(process.env, config),
        checkedAt: new Date(),
      });
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json(errorResponse(message));
    }
  });

  return router;
}

async function loadDbAgentConfigRepository(): Promise<AgentConfigRepository> {
  const { DbAgentConfigRepository } = await import(
    "../agent-config/db-repository"
  );
  return new DbAgentConfigRepository();
}

const router = createAgentConfigRouter(
  createLazyRepository(loadDbAgentConfigRepository),
);

export default router;
