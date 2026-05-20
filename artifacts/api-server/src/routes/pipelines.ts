import { Router, type IRouter } from "express";
import type { Request } from "express";
import { isIP } from "node:net";

import {
  ActuarialPipelineRunnerService,
  type PipelineRunRecord,
  type StartPipelineRunInput,
} from "../pipelines/runner";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStartBody(value: unknown): StartPipelineRunInput {
  if (!isRecord(value)) {
    throw new Error("Expected request body to be an object.");
  }
  if (typeof value.inputPath !== "string" || value.inputPath.trim() === "") {
    throw new Error("Expected inputPath to be a non-empty string.");
  }
  if (
    value.pipelineId !== undefined &&
    (typeof value.pipelineId !== "string" || value.pipelineId.trim() === "")
  ) {
    throw new Error("Expected pipelineId to be a non-empty string.");
  }
  if (
    value.artifactRoot !== undefined &&
    (typeof value.artifactRoot !== "string" || value.artifactRoot.trim() === "")
  ) {
    throw new Error("Expected artifactRoot to be a non-empty string.");
  }
  if (
    value.runId !== undefined &&
    (typeof value.runId !== "string" || value.runId.trim() === "")
  ) {
    throw new Error("Expected runId to be a non-empty string.");
  }

  return {
    pipelineId:
      typeof value.pipelineId === "string" ? value.pipelineId : undefined,
    inputPath: value.inputPath,
    artifactRoot:
      typeof value.artifactRoot === "string" ? value.artifactRoot : undefined,
    runId: typeof value.runId === "string" ? value.runId : undefined,
  };
}

function hostNameFromHeader(host: string): string | null {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
}

function normalizedHostFromHeader(host: string): string | null {
  try {
    return new URL(`http://${host}`).host;
  } catch {
    return null;
  }
}

function isLoopbackHost(host: string): boolean {
  const hostname = hostNameFromHeader(host);
  const normalizedHostname = hostname?.toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "[::1]" ||
    normalizedHostname === "::1" ||
    (normalizedHostname !== undefined &&
      isIP(normalizedHostname) === 4 &&
      normalizedHostname.startsWith("127."))
  );
}

function isAllowedPipelineCommandHost(host: string | undefined): boolean {
  return Boolean(host && isLoopbackHost(host));
}

function isLoopbackRemoteAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const normalized = remoteAddress.trim().toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    return isLoopbackRemoteAddress(normalized.slice("::ffff:".length));
  }
  return isIP(normalized) === 4 && normalized.startsWith("127.");
}

function pipelineCommandGuardError(req: Request): string | null {
  if (req.get("x-ai-interface-command-intent") !== "actuarial-pipeline-run") {
    return "Actuarial pipeline run requires explicit command intent";
  }

  return pipelineLocalRequestGuardError(req, "run");
}

function pipelineLocalRequestGuardError(req: Request, action: string): string | null {
  if (req.get("sec-fetch-site") === "cross-site") {
    return `Cross-site actuarial pipeline ${action} requests are not allowed`;
  }

  const host = req.get("host");
  if (
    !isAllowedPipelineCommandHost(host) ||
    !isLoopbackRemoteAddress(req.socket.remoteAddress)
  ) {
    return `Actuarial pipeline ${action} requests are only allowed from localhost`;
  }

  const origin = req.get("origin");
  if (!origin || !host) return null;

  try {
    const parsedOrigin = new URL(origin);
    const normalizedHost = normalizedHostFromHeader(host);
    return normalizedHost !== null && parsedOrigin.host === normalizedHost
      ? null
      : "Origin does not match the ai_interface host";
  } catch {
    return "Invalid Origin header";
  }
}

export const __privatePipelinesRouteGuards = {
  isLoopbackRemoteAddress,
};

function pipelineResponse(run: PipelineRunRecord): PipelineRunRecord {
  return run;
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

    res.json({ runs: service.listRuns() });
  });

  router.get("/pipelines/runs/:runId", (req, res) => {
    const guardError = pipelineLocalRequestGuardError(req, "read");
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    const runId = req.params.runId;
    if (!runId) {
      res.status(400).json(errorResponse("Expected runId route param."));
      return;
    }

    const run = service.getRun(runId);
    if (!run) {
      res.status(404).json(errorResponse(`Pipeline run not found: ${runId}`));
      return;
    }

    res.json(pipelineResponse(run));
  });

  return router;
}

export default createPipelinesRouter();
