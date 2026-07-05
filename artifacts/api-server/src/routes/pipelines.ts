import { Router, type IRouter } from "express";
import type { Request } from "express";
import {
  GetPipelineRunParams,
  GetPipelineRunResponse,
  ListActuarialPipelineRunsResponse,
  StartPipelineRunBody,
} from "@workspace/api-zod";

import {
  ActuarialPipelineRunnerService,
  type PipelineRunRecord,
  type StartPipelineRunInput,
  type PipelineRunListItem,
} from "../pipelines/runner";
import {
  isLoopbackRemoteAddress,
  localAdminGuardError,
} from "./local-admin-guard";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function parseStartBody(value: unknown): StartPipelineRunInput {
  const body = StartPipelineRunBody.safeParse(value);
  if (!body.success) {
    throw new Error(body.error.message);
  }

  const trimmed = {
    pipelineId: body.data.pipelineId?.trim(),
    inputPath: body.data.inputPath.trim(),
    artifactRoot: body.data.artifactRoot?.trim(),
    runId: body.data.runId?.trim(),
  };

  if (trimmed.inputPath === "") throw new Error("Expected inputPath to be a non-empty string.");
  if (trimmed.pipelineId === "") throw new Error("Expected pipelineId to be a non-empty string.");
  if (trimmed.artifactRoot === "") throw new Error("Expected artifactRoot to be a non-empty string.");
  if (trimmed.runId === "") throw new Error("Expected runId to be a non-empty string.");

  return {
    pipelineId: trimmed.pipelineId,
    inputPath: trimmed.inputPath,
    artifactRoot: trimmed.artifactRoot,
    runId: trimmed.runId,
  };
}

function pipelineCommandGuardError(req: Request): string | null {
  if (req.get("x-ai-interface-command-intent") !== "actuarial-pipeline-run") {
    return "Actuarial pipeline run requires explicit command intent";
  }

  return pipelineLocalRequestGuardError(req, "run");
}

function pipelineLocalRequestGuardError(req: Request, action: string): string | null {
  return localAdminGuardError(req, `actuarial pipeline ${action}`);
}

export const __privatePipelinesRouteGuards = {
  isLoopbackRemoteAddress,
};

function pipelineResponse(run: PipelineRunRecord): PipelineRunRecord {
  return GetPipelineRunResponse.parse(run) as PipelineRunRecord;
}

function pipelineListItemResponse(
  run: PipelineRunListItem | PipelineRunRecord,
): PipelineRunListItem {
  if ("stepCount" in run && "completedStepCount" in run) return run;
  return {
    runId: run.runId,
    pipelineId: run.pipelineId,
    status: run.status,
    governanceStatus: run.governanceStatus,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs: run.durationMs,
    inputPath: run.inputPath,
    artifactRoot: run.artifactRoot,
    stepCount: run.steps.length,
    completedStepCount: run.steps.filter((step) => step.status === "completed").length,
  };
}

export function createPipelinesRouter(
  service: ActuarialPipelineRunnerService = new ActuarialPipelineRunnerService(),
): IRouter {
  const router: IRouter = Router();

  router.post("/pipelines/runs", async (req, res) => {
    const guardError = pipelineCommandGuardError(req);
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    try {
      const body = parseStartBody(req.body);
      const run = await service.startRun(body);
      res.status(201).json(pipelineResponse(run));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(errorResponse(message));
    }
  });

  router.get("/pipelines/runs", (req, res) => {
    const guardError = pipelineLocalRequestGuardError(req, "read");
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    res.json(ListActuarialPipelineRunsResponse.parse({
      runs: service.listRuns().map(pipelineListItemResponse),
    }));
  });

  router.get("/pipelines/runs/:runId", (req, res) => {
    const guardError = pipelineLocalRequestGuardError(req, "read");
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    const params = GetPipelineRunParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }

    const run = service.getRun(params.data.runId);
    if (!run) {
      res.status(404).json(errorResponse(`Pipeline run not found: ${params.data.runId}`));
      return;
    }

    res.json(pipelineResponse(run));
  });

  return router;
}

export default createPipelinesRouter();
