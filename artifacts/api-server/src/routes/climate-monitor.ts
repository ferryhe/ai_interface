import { Router, type IRouter } from "express";
import type { Request } from "express";
import { isIP } from "node:net";
import {
  CreateClimateMonitorRunResponse,
  GetClimateMonitorStatusResponse,
} from "@workspace/api-zod";

import {
  ClimateMonitorLiveRunDisabledError,
  ClimateMonitorNotConfiguredError,
  ClimateMonitorProcessError,
  ClimateMonitorRunError,
  getClimateMonitorStatus,
  runClimateMonitor,
  type ClimateMonitorRunInput,
  type ClimateMonitorRunResult,
  type ClimateMonitorStatus,
} from "../climate-monitor/service";

interface ClimateMonitorRouterDependencies {
  getStatus?: () => Promise<ClimateMonitorStatus>;
  startRun?: (input: ClimateMonitorRunInput) => Promise<ClimateMonitorRunResult>;
}

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(
  body: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ClimateMonitorRunError(`${name} must be a string`);
  }
  return value;
}

function parseRunBody(body: unknown): ClimateMonitorRunInput {
  if (!isRecord(body)) {
    throw new ClimateMonitorRunError("Request body must be a JSON object");
  }

  const rawDryRun = body["dryRun"] ?? body["dry_run"];
  if (rawDryRun !== undefined && typeof rawDryRun !== "boolean") {
    throw new ClimateMonitorRunError("dryRun must be a boolean");
  }

  return {
    dryRun: rawDryRun,
    date: optionalString(body, "date"),
    manifestFixture: optionalString(body, "manifestFixture"),
    researchFixture: optionalString(body, "researchFixture"),
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

function isAllowedClimateCommandHost(host: string | undefined): boolean {
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

function climateCommandGuardError(req: Request): string | null {
  if (req.get("x-ai-interface-command-intent") !== "climate-monitor-run") {
    return "Climate monitor run requires explicit command intent";
  }

  if (req.get("sec-fetch-site") === "cross-site") {
    return "Cross-site climate monitor run requests are not allowed";
  }

  const host = req.get("host");
  if (
    !isAllowedClimateCommandHost(host) ||
    !isLoopbackRemoteAddress(req.socket.remoteAddress)
  ) {
    return "Climate monitor runs are only allowed from localhost";
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

export const __privateClimateMonitorRouteGuards = {
  isLoopbackRemoteAddress,
};

export function createClimateMonitorRouter(
  dependencies: ClimateMonitorRouterDependencies = {},
): IRouter {
  const router: IRouter = Router();
  const getStatus = dependencies.getStatus ?? getClimateMonitorStatus;
  const startRun = dependencies.startRun ?? runClimateMonitor;

  router.get("/climate-monitor/status", async (_req, res) => {
    try {
      const data = GetClimateMonitorStatusResponse.parse(await getStatus());
      res.json(data);
    } catch {
      res
        .status(500)
        .json(errorResponse("Failed to read climate monitor status"));
    }
  });

  router.post("/climate-monitor/runs", async (req, res) => {
    const guardError = climateCommandGuardError(req);
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    let input: ClimateMonitorRunInput;
    try {
      input = parseRunBody(req.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(errorResponse(message));
      return;
    }

    try {
      const data = CreateClimateMonitorRunResponse.parse(await startRun(input));
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof ClimateMonitorLiveRunDisabledError) {
        res.status(403).json(errorResponse(message));
        return;
      }
      if (error instanceof ClimateMonitorProcessError) {
        res.status(500).json(errorResponse(message));
        return;
      }
      if (
        error instanceof ClimateMonitorNotConfiguredError ||
        error instanceof ClimateMonitorRunError
      ) {
        res.status(400).json(errorResponse(message));
        return;
      }
      res.status(500).json(errorResponse("Failed to run climate monitor"));
    }
  });

  return router;
}

export default createClimateMonitorRouter();
