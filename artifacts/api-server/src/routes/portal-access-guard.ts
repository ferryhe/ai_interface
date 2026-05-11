import type { Request } from "express";

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
