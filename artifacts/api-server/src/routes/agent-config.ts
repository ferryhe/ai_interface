import { Router, type IRouter } from "express";
import {
  GetAgentConfigResponse,
  TestAgentConfigConnectionResponse,
  UpdateAgentConfigBody,
  UpdateAgentConfigResponse,
} from "@workspace/api-zod";

import { DbAgentConfigRepository } from "../agent-config/db-repository";
import {
  getAgentConfig,
  getConnectionStatus,
  toPublicAgentConfig,
  updateAgentConfig,
  type AgentConfigRecord,
} from "../agent-config/agent-config-service";

const router: IRouter = Router();
const repository = new DbAgentConfigRepository();

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function configResponse(config: AgentConfigRecord) {
  return {
    config: toPublicAgentConfig(config),
    connection: getConnectionStatus(process.env),
  };
}

router.get("/agent-config", async (_req, res) => {
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

router.post("/agent-config/test-connection", (_req, res) => {
  const data = TestAgentConfigConnectionResponse.parse({
    ...getConnectionStatus(process.env),
    checkedAt: new Date(),
  });
  res.json(data);
});

export default router;
