import type { NextFunction, Request, Response } from "express";

import {
  verifyPortalAccess,
  type AgentConfigRepository,
} from "../agent-config/agent-config-service";
import type { JsonObject } from "../modules/ingest-service";

const portalSurface = "agent-portal";

function firstHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function readPortalToken(req: Request): string {
  const tokenHeader = firstHeaderValue(req.headers["x-portal-token"]).trim();
  if (tokenHeader) return tokenHeader;

  const authorization = firstHeaderValue(req.headers.authorization).trim();
  const [scheme, ...tokenParts] = authorization.split(/\s+/);
  if (scheme?.toLowerCase() === "bearer") return tokenParts.join(" ").trim();

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requestBodyMetadata(req: Request): JsonObject | undefined {
  const body = req.body as unknown;
  if (!isRecord(body) || !isRecord(body["metadata"])) return undefined;
  return body["metadata"] as JsonObject;
}

function isAllowedPortalRoute(req: Request): boolean {
  const path = req.path;
  const method = req.method.toUpperCase();

  if (method === "POST" && path === "/portal-auth/verify") return true;

  if (method === "POST" && path === "/missions") return true;
  if (method === "GET" && /^\/missions\/[^/]+$/.test(path)) return true;
  if (method === "GET" && /^\/missions\/[^/]+\/board$/.test(path)) return true;
  if (
    method === "POST" &&
    /^\/missions\/[^/]+\/(revise|approve|execute)$/.test(path)
  ) {
    return true;
  }

  if (method === "GET" && path === "/approvals") return true;
  if (
    method === "POST" &&
    /^\/approvals\/[^/]+\/(approve|reject)$/.test(path)
  ) {
    return true;
  }

  if (method === "POST" && path === "/agent-runs") return true;
  if (method === "GET" && /^\/agent-runs\/[^/]+$/.test(path)) return true;
  if (method === "GET" && /^\/module-runs\/[^/]+$/.test(path)) return true;
  if (
    method === "POST" &&
    /^\/module-runs\/[^/]+\/(feedback|resume)$/.test(path)
  ) {
    return true;
  }
  if (method === "GET" && /^\/artifacts\/[^/]+$/.test(path)) return true;

  return false;
}

function errorResponse(message: string): { error: string } {
  return { error: message };
}

export function portalSurfaceDenyByDefault(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isPortalRuntimeRequest(req, requestBodyMetadata(req))) {
    next();
    return;
  }

  if (isAllowedPortalRoute(req)) {
    next();
    return;
  }

  res
    .status(403)
    .json(errorResponse("Portal runtime is not allowed to access this API surface"));
}

export function isPortalRuntimeRequest(
  req: Request,
  metadata?: JsonObject,
): boolean {
  const surface = firstHeaderValue(
    req.headers["x-ai-interface-surface"],
  ).trim();
  return surface === portalSurface || metadata?.["source"] === portalSurface;
}

export async function requirePortalRuntimeAccess(
  req: Request,
  repository: AgentConfigRepository,
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const verification = await verifyPortalAccess(
    repository,
    readPortalToken(req),
  );
  if (verification.authorized) return { allowed: true };
  return {
    allowed: false,
    error: `Portal access denied: ${verification.status}`,
  };
}
