import type { NextFunction, Request, Response } from "express";
import { isIP } from "node:net";

function errorResponse(message: string): { error: string } {
  return { error: message };
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

function firstForwardedHost(value: string | undefined): string | null {
  const host = value?.split(",", 1)[0]?.trim();
  return host || null;
}

function forwardedForAddresses(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

function trustedForwardedHost(req: Request): string | null {
  const forwardedHost = firstForwardedHost(req.get("x-forwarded-host"));
  if (!forwardedHost) return null;

  const forwardedFor = forwardedForAddresses(req.get("x-forwarded-for"));
  if (
    forwardedFor.length === 0 ||
    forwardedFor.some((address) => !isLoopbackRemoteAddress(address))
  ) {
    return null;
  }

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite !== "same-origin") return null;

  return forwardedHost;
}

function normalizedRequestHostCandidates(req: Request): string[] {
  return [req.get("host"), trustedForwardedHost(req)].flatMap((host) => {
    if (!host) return [];
    const normalized = normalizedHostFromHeader(host);
    return normalized ? [normalized] : [];
  });
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

export function isLoopbackRemoteAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const normalized = remoteAddress.trim().toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    return isLoopbackRemoteAddress(normalized.slice("::ffff:".length));
  }
  return isIP(normalized) === 4 && normalized.startsWith("127.");
}

export function localAdminGuardError(req: Request, action: string): string | null {
  const surface = req.get("x-ai-interface-surface")?.trim().toLowerCase();
  if (surface === "agent-portal") {
    return `Portal runtime is not allowed to access ${action} requests`;
  }

  if (req.get("sec-fetch-site") === "cross-site") {
    return `Cross-site ${action} requests are not allowed`;
  }

  const host = req.get("host");
  if (
    !host ||
    !isLoopbackHost(host) ||
    !isLoopbackRemoteAddress(req.socket.remoteAddress)
  ) {
    return `${action} requests are only allowed from localhost`;
  }

  const forwardedFor = forwardedForAddresses(req.get("x-forwarded-for"));
  if (forwardedFor.some((address) => !isLoopbackRemoteAddress(address))) {
    return `${action} requests are only allowed from localhost`;
  }

  const origin = req.get("origin");
  if (!origin) return null;

  try {
    const parsedOrigin = new URL(origin);
    const allowedHosts = normalizedRequestHostCandidates(req);
    return allowedHosts.includes(parsedOrigin.host)
      ? null
      : "Origin does not match the ai_interface host";
  } catch {
    return "Invalid Origin header";
  }
}

function isLocalAdminReadSurface(req: Request): boolean {
  if (req.method !== "GET") return false;
  const path = req.path;
  return (
    path === "/agents" ||
    path.startsWith("/agents/") ||
    path === "/skills" ||
    path === "/teams" ||
    path === "/tool-adapters" ||
    path === "/modules" ||
    path === "/climate-monitor/status"
  );
}

export function localAdminSurfaceGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isLocalAdminReadSurface(req)) {
    next();
    return;
  }

  const guardError = localAdminGuardError(req, "local admin read");
  if (guardError) {
    res.status(403).json(errorResponse(guardError));
    return;
  }

  next();
}
