import { Router, type IRouter } from "express";
import {
  CreateAgentRunBody,
  CreateAgentRunResponse,
  GetAgentRunParams,
  GetAgentRunResponse,
} from "@workspace/api-zod";

import { DbAgentConfigRepository } from "../agent-config/db-repository";
import { DbAgentRuntimeRepository } from "../agent-runtime/db-repository";
import {
  createAgentRun,
  getAgentRunDetail,
} from "../agent-runtime/agent-runtime-service";

const router: IRouter = Router();
const runtimeRepository = new DbAgentRuntimeRepository();
const configRepository = new DbAgentConfigRepository();

function errorResponse(message: string): { error: string } {
  return { error: message };
}

router.post("/agent-runs", async (req, res) => {
  const body = CreateAgentRunBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
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

export default router;
