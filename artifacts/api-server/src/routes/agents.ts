import { Router, type IRouter } from "express";
import { GetAgentsResponse } from "@workspace/api-zod";

import {
  defaultAgentRuntimeRegistry,
  listAgentReadiness,
  type AgentRuntimeRegistry,
} from "../agent-registry/agent-runtime-registry";

export function createAgentsRouter(
  registry: AgentRuntimeRegistry = defaultAgentRuntimeRegistry,
): IRouter {
  const router: IRouter = Router();

  router.get("/agents", (_req, res) => {
    const data = GetAgentsResponse.parse({
      agents: registry.listAgents(),
      readiness: listAgentReadiness(registry),
    });
    res.json(data);
  });

  return router;
}

export default createAgentsRouter();
