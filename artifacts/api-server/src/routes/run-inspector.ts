import { Router, type IRouter, type Request } from "express";
import {
  GetRunTimelineParams,
  GetRunTimelineResponse,
  ListArtifactsQueryParams,
  ListArtifactsResponse,
  ListRunsQueryParams,
  ListRunsResponse,
} from "@workspace/api-zod";

import {
  getAgentRunTimeline,
  listAgentRuns,
  type AgentRuntimeRepository,
} from "../agent-runtime/agent-runtime-service";
import { listArtifacts } from "../modules/ingest-service";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";
import { createLazyRepository } from "./lazy-repository";
import { localAdminGuardError } from "./local-admin-guard";

const DEFAULT_LIMIT = 50;
const REDACTED = "[redacted]";

function errorResponse(message: string): { error: string } {
  return { error: message };
}

function inspectorReadGuardError(req: Request): string | null {
  return localAdminGuardError(req, "run inspector read");
}

function jsonEscaped(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function slashEscaped(value: string): string {
  return value.split("/").join("\\/");
}

function secretVariants(value: string): string[] {
  const slashNormalized = value.split("\\").join("/");
  const candidates = [
    value,
    slashNormalized,
    slashEscaped(value),
    slashEscaped(slashNormalized),
  ];
  return Array.from(
    new Set(
      candidates.flatMap((candidate) => [candidate, jsonEscaped(candidate)]),
    ),
  ).filter(Boolean);
}

function isAbsoluteLocalPath(value: string): boolean {
  return (
    /^[a-z]:[\\/]/i.test(value) ||
    value.startsWith("\\\\") ||
    value.startsWith("/")
  );
}

function isSensitiveEnvKey(key: string): boolean {
  return /(api[_-]?key|token|secret|password|authorization|bearer|credential)/i.test(
    key,
  );
}

function isConfiguredUrlKey(key: string): boolean {
  return /(api[_-]?base[_-]?url|server[_-]?url|mcp.*url|ollama.*url|provider.*url)/i.test(
    key,
  );
}

function isConfiguredPathKey(key: string): boolean {
  return /(^|_)(path|root|dir|directory)$/i.test(key);
}

function configuredSkillEnvNames(registry: SkillRuntimeRegistry): Set<string> {
  const names = new Set<string>();
  for (const adapter of registry.listAdapterDefinitions()) {
    for (const name of adapter.requiredEnv) names.add(name);
    for (const name of adapter.optionalEnv) names.add(name);
    if (adapter.mcpServerEnv) names.add(adapter.mcpServerEnv);
  }
  for (const skill of registry.listSkills()) {
    if (skill.project.envPath) names.add(skill.project.envPath);
  }
  return names;
}

function configuredSecretValues(
  env: Record<string, string | undefined>,
  registry: SkillRuntimeRegistry,
): string[] {
  const values: string[] = [];
  const skillEnvNames = configuredSkillEnvNames(registry);
  for (const [key, rawValue] of Object.entries(env)) {
    const value = rawValue?.trim();
    if (!value) continue;
    if (
      skillEnvNames.has(key) ||
      isSensitiveEnvKey(key) ||
      isConfiguredUrlKey(key) ||
      (isConfiguredPathKey(key) && isAbsoluteLocalPath(value))
    ) {
      values.push(...secretVariants(value));
    }
  }
  return Array.from(new Set(values))
    .filter((value) => value.length >= 3)
    .sort((left, right) => right.length - left.length);
}

function redactHeaderLikeText(value: string): string {
  return value.replace(
    /["']?\b(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|token)\b["']?\s*[:=]\s*["']?(?:bearer\s+)?[^"',\r\n}\]]+["']?/gi,
    REDACTED,
  );
}

function redactText(value: string, secrets: string[]): string {
  let redacted = redactHeaderLikeText(value);
  for (const secret of secrets) {
    redacted = redacted.split(secret).join(REDACTED);
  }
  return redacted;
}

function responseKeyParts(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+|\s+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

function hasKeyPartSequence(parts: string[], sequence: string[]): boolean {
  return parts.some((_, index) =>
    sequence.every((part, offset) => parts[index + offset] === part),
  );
}

function isSensitiveResponseKey(key: string): boolean {
  const parts = responseKeyParts(key);
  if (parts.length === 0) return false;

  const compact = parts.join("");
  const exactSensitiveKeys = new Set([
    "header",
    "headers",
    "authorization",
    "proxyauthorization",
    "cookie",
    "setcookie",
    "xapikey",
    "apikey",
    "providerkey",
    "localproviderurl",
    "mcpserverurl",
    "credential",
    "credentials",
    "password",
    "secret",
    "token",
  ]);
  if (exactSensitiveKeys.has(compact)) return true;

  const sensitiveParts = new Set([
    "authorization",
    "bearer",
    "cookie",
    "credential",
    "credentials",
    "password",
    "passwd",
    "pwd",
    "secret",
  ]);
  if (parts.some((part) => sensitiveParts.has(part))) return true;

  if (
    hasKeyPartSequence(parts, ["api", "key"]) ||
    hasKeyPartSequence(parts, ["x", "api", "key"]) ||
    hasKeyPartSequence(parts, ["provider", "key"])
  ) {
    return true;
  }

  const lastTokenIndex = parts.lastIndexOf("token");
  if (lastTokenIndex === parts.length - 1) {
    const previous = parts[lastTokenIndex - 1];
    const tokenQualifiers = new Set([
      "access",
      "api",
      "auth",
      "bearer",
      "client",
      "id",
      "provider",
      "refresh",
      "session",
    ]);
    return lastTokenIndex === 0 || tokenQualifiers.has(previous ?? "");
  }

  return (
    parts.includes("url") &&
    (parts.includes("local") ||
      parts.includes("mcp") ||
      parts.includes("provider"))
  );
}

function redactJson<T>(value: T, secrets: string[]): T {
  if (typeof value === "string") {
    return redactText(value, secrets) as T;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, secrets)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveResponseKey(key) ? REDACTED : redactJson(item, secrets),
      ]),
    ) as T;
  }
  return value;
}

export function redactInspectorResponse<T>(
  value: T,
  env: Record<string, string | undefined> = process.env,
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): T {
  return redactJson(value, configuredSecretValues(env, registry));
}

const lazyRuntimeRepository = createLazyRepository<AgentRuntimeRepository>(
  async () => {
    const { DbAgentRuntimeRepository } = await import(
      "../agent-runtime/db-repository"
    );
    return new DbAgentRuntimeRepository();
  },
);

export function createRunInspectorRouter(
  repository: AgentRuntimeRepository,
  options: {
    env?: Record<string, string | undefined>;
    registry?: SkillRuntimeRegistry;
  } = {},
): IRouter {
  const router: IRouter = Router();
  const env = options.env ?? process.env;
  const registry = options.registry ?? defaultSkillRuntimeRegistry;

  router.get("/runs", async (req, res) => {
    const guardError = inspectorReadGuardError(req);
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    const query = ListRunsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(errorResponse(query.error.message));
      return;
    }

    try {
      const runs = await listAgentRuns(repository, {
        ...query.data,
        limit: query.data.limit ?? DEFAULT_LIMIT,
      });
      const data = ListRunsResponse.parse(
        redactInspectorResponse({ runs }, env, registry),
      );
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(errorResponse(message));
    }
  });

  router.get("/runs/:pipelineRunId/timeline", async (req, res) => {
    const guardError = inspectorReadGuardError(req);
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    const params = GetRunTimelineParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json(errorResponse(params.error.message));
      return;
    }

    try {
      const timeline = await getAgentRunTimeline(
        repository,
        params.data.pipelineRunId,
      );
      const data = GetRunTimelineResponse.parse(
        redactInspectorResponse(timeline, env, registry),
      );
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(404).json(errorResponse(message));
    }
  });

  router.get("/artifacts", async (req, res) => {
    const guardError = inspectorReadGuardError(req);
    if (guardError) {
      res.status(403).json(errorResponse(guardError));
      return;
    }

    const query = ListArtifactsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(errorResponse(query.error.message));
      return;
    }

    try {
      const artifacts = await listArtifacts(repository, {
        ...query.data,
        limit: query.data.limit ?? DEFAULT_LIMIT,
      });
      const data = ListArtifactsResponse.parse(
        redactInspectorResponse({ artifacts }, env, registry),
      );
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json(errorResponse(message));
    }
  });

  return router;
}

const router = createRunInspectorRouter(lazyRuntimeRepository);

export default router;
