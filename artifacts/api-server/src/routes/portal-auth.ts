import { Router, type IRouter } from "express";
import {
  VerifyPortalAccessBody,
  VerifyPortalAccessResponse,
} from "@workspace/api-zod";

import {
  verifyPortalAccess,
  type AgentConfigRepository,
} from "../agent-config/agent-config-service";
import { createLazyRepository } from "./lazy-repository";

function errorResponse(message: string): { error: string } {
  return { error: message };
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

const router = createPortalAuthRouter(
  createLazyRepository<AgentConfigRepository>(async () => {
    const { DbAgentConfigRepository } = await import(
      "../agent-config/db-repository"
    );
    return new DbAgentConfigRepository();
  }),
);

export default router;
