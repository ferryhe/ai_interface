import { Router, type IRouter } from "express";
import {
  VerifyPortalAccessBody,
  VerifyPortalAccessResponse,
} from "@workspace/api-zod";

import {
  verifyPortalAccess,
  type AgentConfigRepository,
  type AgentConfigRecord,
} from "../agent-config/agent-config-service";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function createLazyDbAgentConfigRepository(): AgentConfigRepository {
  let repository: AgentConfigRepository | null = null;

  async function getRepository(): Promise<AgentConfigRepository> {
    if (repository) return repository;
    const { DbAgentConfigRepository } = await import(
      "../agent-config/db-repository"
    );
    repository = new DbAgentConfigRepository();
    return repository;
  }

  return {
    async findConfig(configKey: string): Promise<AgentConfigRecord | null> {
      return (await getRepository()).findConfig(configKey);
    },
    async upsertConfig(input): Promise<AgentConfigRecord> {
      return (await getRepository()).upsertConfig(input);
    },
  };
}

export function createPortalAuthRouter(
  agentConfigRepository: AgentConfigRepository,
): IRouter {
  const router: IRouter = Router();

  router.post("/portal-auth/verify", async (req, res) => {
    const body = VerifyPortalAccessBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json(errorResponse(body.error.message));
      return;
    }

    try {
      const verification = await verifyPortalAccess(
        agentConfigRepository,
        body.data.token,
      );
      const data = VerifyPortalAccessResponse.parse({
        ...verification,
        checkedAt: new Date(verification.checkedAt),
      });
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json(errorResponse(message));
    }
  });

  return router;
}

const router = createPortalAuthRouter(createLazyDbAgentConfigRepository());

export default router;
