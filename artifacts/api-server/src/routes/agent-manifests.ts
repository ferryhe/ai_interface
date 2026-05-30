import { Router, type IRouter } from "express";
import type { Request } from "express";
import { isIP } from "node:net";
import { GetAgentsResponse } from "@workspace/api-zod";

import { redactAgentInteropText } from "../agent-registry/mcp-tool-exporter";
import {
  writeAgentManifest,
  type WritableAgentManifest,
} from "../agent-registry/agent-manifest-writer";

export interface CreateAgentManifestsRouterOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

interface CreateAgentManifestBody {
  agentId?: unknown;
  manifest?: unknown;
  overwrite?: unknown;
}

export function errorResponse(message: string): { error: string } {
  return { error: message };
}

export function redactManifestString(value: string): string {
  return redactAgentInteropText(value);
}

export function redactManifestResponseValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactManifestString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactManifestResponseValue(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactManifestResponseValue(item),
      ]),
    ) as T;
  }
  return value;
}

export function redactedErrorResponse(message: string): { error: string } {
  return errorResponse(redactManifestString(message));
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

function isLoopbackRemoteAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const normalized = remoteAddress.trim().toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    return isLoopbackRemoteAddress(normalized.slice("::ffff:".length));
  }
  return isIP(normalized) === 4 && normalized.startsWith("127.");
}

export function manifestWriteGuardError(req: Request): string | null {
  if (req.get("sec-fetch-site") === "cross-site") {
    return "Cross-site agent manifest write requests are not allowed";
  }

  const host = req.get("host");
  if (
    !host ||
    !isLoopbackHost(host) ||
    !isLoopbackRemoteAddress(req.socket.remoteAddress)
  ) {
    return "Agent manifest write requests are only allowed from localhost";
  }

  const origin = req.get("origin");
  if (!origin) return null;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCreateBody(body: unknown): {
  agentId: string;
  manifest: WritableAgentManifest;
  overwrite: boolean | undefined;
} {
  if (!isRecord(body)) {
    throw new Error("Expected JSON object body");
  }

  const input = body as CreateAgentManifestBody;
  if (typeof input.agentId !== "string") {
    throw new Error("Expected agentId to be a string");
  }
  if (!isRecord(input.manifest)) {
    throw new Error("Expected manifest to be an object");
  }
  if (
    input.overwrite !== undefined &&
    typeof input.overwrite !== "boolean"
  ) {
    throw new Error("Expected overwrite to be a boolean");
  }

  return {
    agentId: input.agentId,
    manifest: input.manifest as WritableAgentManifest,
    overwrite: input.overwrite,
  };
}

function validateResponse(manifest: unknown, path: string): {
  manifest: unknown;
  path: string;
} {
  const parsed = GetAgentsResponse.parse({
    agents: [manifest],
    readiness: [],
  });
  return {
    manifest: redactManifestResponseValue(parsed.agents[0]),
    path: redactManifestString(path),
  };
}

export function createAgentManifestsRouter(
  options: CreateAgentManifestsRouterOptions = {},
): IRouter {
  const router: IRouter = Router();
  const env = options.env ?? process.env;

  router.post("/agent-manifests", async (req, res) => {
    if (env.AI_INTERFACE_MANIFEST_WRITE_MODE !== "custom") {
      res
        .status(403)
        .json(
          errorResponse(
            "Agent manifest writes require AI_INTERFACE_MANIFEST_WRITE_MODE=custom",
          ),
        );
      return;
    }

    const guardError = manifestWriteGuardError(req);
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    try {
      const body = parseCreateBody(req.body);
      const result = await writeAgentManifest({
        cwd: options.cwd,
        env,
        agentId: body.agentId,
        manifest: body.manifest,
        overwrite: body.overwrite,
      });
      res.status(201).json(validateResponse(result.manifest, result.path));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(redactedErrorResponse(message));
    }
  });

  return router;
}

export default createAgentManifestsRouter();
