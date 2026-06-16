import { existsSync } from "node:fs";
import { readdir, readFile as readFileFromFs } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { parse } from "yaml";

import type {
  AgentId,
  AgentManifest,
  AgentMemoryPromotionMode,
  AgentSource,
  AgentCriticalRule,
  AgentDeliverable,
  AgentWorkflowPhase,
  AgentCommunicationStyle,
  AgentSuccessMetric,
} from "./agent-manifest";
import {
  AGENT_ID_PATTERN,
  defaultAgentManifestValues,
} from "./agent-manifest";

export interface LoadAgentManifestsOptions {
  roots?: string[];
  cwd?: string;
  readFile?: (path: string) => Promise<string>;
  exists?: (path: string) => boolean;
  env?: Record<string, string | undefined>;
}

const DEFAULT_AGENT_ROOTS = [
  "agents/builtin",
  "agents/community",
  "agents/custom",
];
const agentSources = ["builtin", "community", "custom", "external"] as const;
const rootSourceOrder = new Map<AgentSource, number>(
  agentSources.map((source, index) => [source, index]),
);
const plannerModes = ["linear", "dag"] as const;
const failureStrategies = ["fail_fast", "continue_independent"] as const;
const memoryPromotionModes = ["manual", "run_summary", "disabled"] as const;
const providers = ["openai", "anthropic", "ollama", "deterministic"] as const;
const reasoningEfforts = ["none", "low", "medium", "high", "xhigh"] as const;

interface LoadedManifest {
  manifest: AgentManifest;
  path: string;
  rootIndex: number;
  discoveryIndex: number;
}

interface ManifestPath {
  path: string;
  rootIndex: number;
  discoveryIndex: number;
  expectedSource?: AgentSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function manifestError(path: string, message: string): Error {
  return new Error(`${message} in ${path}`);
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw manifestError(path, `Expected ${key} to be a non-empty string`);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  label = key,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw manifestError(path, `Expected ${label} to be a non-empty string`);
  }
  return value;
}

function optionalRecord(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  const value = record[key];
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw manifestError(path, `Expected ${key} to be an object`);
  }
  return value;
}

function optionalBoolean(
  record: Record<string, unknown>,
  key: string,
  defaultValue: boolean,
  path: string,
): boolean {
  const value = record[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== "boolean") {
    throw manifestError(path, `Expected ${key} to be a boolean`);
  }
  return value;
}

function stringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string[] {
  const value = record[key];
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw manifestError(path, `Expected ${key} to be a non-empty string array`);
  }
  return [...value];
}

function allowedValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
  path: string,
): T {
  if (!allowed.includes(value as T)) {
    throw manifestError(path, `Invalid ${label}: ${value}`);
  }
  return value as T;
}

function optionalAllowedValue<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  defaultValue: T,
  label: string,
  path: string,
): T {
  const value = record[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== "string") {
    throw manifestError(path, `Expected ${label} to be a string`);
  }
  return allowedValue(value, allowed, label, path);
}

function normalizeSkills(
  raw: Record<string, unknown>,
  path: string,
): AgentManifest["skills"] {
  const value = raw.skills;
  if (!Array.isArray(value)) {
    throw manifestError(path, "Expected skills to be an array");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw manifestError(path, `Expected skills[${index}] to be an object`);
    }
    return {
      skillId: requiredString(item, "skillId", path),
      required: optionalBoolean(item, "required", false, path),
    };
  });
}

function normalizeHandoffs(
  raw: Record<string, unknown>,
  path: string,
): AgentManifest["handoffs"] {
  const value = raw.handoffs ?? defaultAgentManifestValues.handoffs;
  if (!Array.isArray(value)) {
    throw manifestError(path, "Expected handoffs to be an array");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw manifestError(path, `Expected handoffs[${index}] to be an object`);
    }
    return {
      targetAgentId: requiredString(item, "targetAgentId", path),
      description: requiredString(item, "description", path),
    };
  });
}

function normalizeTests(
  raw: Record<string, unknown>,
  path: string,
): AgentManifest["tests"] {
  const value = raw.tests ?? defaultAgentManifestValues.tests;
  if (!Array.isArray(value)) {
    throw manifestError(path, "Expected tests to be an array");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw manifestError(path, `Expected tests[${index}] to be an object`);
    }
    return {
      name: requiredString(item, "name", path),
      prompt: requiredString(item, "prompt", path),
      expectedSkillIds: stringArray(item, "expectedSkillIds", path),
    };
  });
}

function normalizeProvider(
  raw: Record<string, unknown>,
  path: string,
): AgentManifest["provider"] {
  const provider = raw.provider;
  if (provider === undefined) return undefined;
  if (!isRecord(provider)) {
    throw manifestError(path, "Expected provider to be an object");
  }
  return {
    provider:
      provider.provider === undefined
        ? undefined
        : allowedValue(
            requiredString(provider, "provider", path),
            providers,
            "provider.provider",
            path,
          ),
    modelId: optionalString(provider, "modelId", path, "provider.modelId"),
    reasoningEffort:
      provider.reasoningEffort === undefined
        ? undefined
        : allowedValue(
            requiredString(provider, "reasoningEffort", path),
            reasoningEfforts,
            "provider.reasoningEffort",
            path,
          ),
  };
}

function normalizeCriticalRules(
  raw: Record<string, unknown>,
  path: string,
): AgentCriticalRule[] | undefined {
  const value = raw.criticalRules;
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw manifestError(path, "Expected criticalRules to be an array");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw manifestError(path, `Expected criticalRules[${index}] to be an object`);
    }
    const severity = requiredString(item, "severity", path);
    if (!["blocker", "warning"].includes(severity)) {
      throw manifestError(path, `Invalid criticalRules[${index}].severity: ${severity}`);
    }
    return {
      id: requiredString(item, "id", path),
      description: requiredString(item, "description", path),
      severity: severity as "blocker" | "warning",
    };
  });
}

function normalizeDeliverables(
  raw: Record<string, unknown>,
  path: string,
): AgentDeliverable[] | undefined {
  const value = raw.deliverables;
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw manifestError(path, "Expected deliverables to be an array");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw manifestError(path, `Expected deliverables[${index}] to be an object`);
    }
    return {
      name: requiredString(item, "name", path),
      format: requiredString(item, "format", path),
      description: requiredString(item, "description", path),
      successCriteria: requiredString(item, "successCriteria", path),
    };
  });
}

function normalizeWorkflow(
  raw: Record<string, unknown>,
  path: string,
): AgentWorkflowPhase[] | undefined {
  const value = raw.workflow;
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw manifestError(path, "Expected workflow to be an array");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw manifestError(path, `Expected workflow[${index}] to be an object`);
    }
    return {
      name: requiredString(item, "name", path),
      description: requiredString(item, "description", path),
      approvalRequired: optionalBoolean(item, "approvalRequired", false, path),
      deliverables: stringArray(item, "deliverables", path),
    };
  });
}

function normalizeCommunicationStyle(
  raw: Record<string, unknown>,
  path: string,
): AgentCommunicationStyle | undefined {
  const value = raw.communicationStyle;
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw manifestError(path, "Expected communicationStyle to be an object");
  }
  return {
    tone: requiredString(value, "tone", path),
    outputFormat: requiredString(value, "outputFormat", path),
    languagePreference: requiredString(value, "languagePreference", path),
  };
}

function normalizeSuccessMetrics(
  raw: Record<string, unknown>,
  path: string,
): AgentSuccessMetric[] | undefined {
  const value = raw.successMetrics;
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw manifestError(path, "Expected successMetrics to be an array");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw manifestError(path, `Expected successMetrics[${index}] to be an object`);
    }
    return {
      metric: requiredString(item, "metric", path),
      target: requiredString(item, "target", path),
      measurement: requiredString(item, "measurement", path),
    };
  });
}

function normalizeIdentity(
  raw: Record<string, unknown>,
  path: string,
): AgentManifest["identity"] {
  const identity = raw.identity;
  if (identity === undefined) return undefined;
  if (!isRecord(identity)) {
    throw manifestError(path, "Expected identity to be an object");
  }
  return {
    persona: requiredString(identity, "persona", path),
    background: requiredString(identity, "background", path),
  };
}

function normalizeManifest(raw: unknown, path: string): AgentManifest {
  if (!isRecord(raw)) {
    throw manifestError(path, "Expected manifest to be an object");
  }

  const agentId = requiredString(raw, "agentId", path);
  if (!AGENT_ID_PATTERN.test(agentId)) {
    throw manifestError(path, `Invalid agentId: ${agentId}`);
  }

  const planner = optionalRecord(raw, "planner", path);
  const permissions = optionalRecord(raw, "permissions", path);
  const memory = optionalRecord(raw, "memory", path);
  const provider = normalizeProvider(raw, path);

  return {
    agentId,
    name: requiredString(raw, "name", path),
    title: optionalString(raw, "title", path),
    description: requiredString(raw, "description", path),
    source: allowedValue(
      requiredString(raw, "source", path),
      agentSources,
      "source",
      path,
    ),
    instructions: requiredString(raw, "instructions", path),
    skills: normalizeSkills(raw, path),
    ...(provider ? { provider } : {}),
    planner: {
      mode: optionalAllowedValue(
        planner,
        "mode",
        plannerModes,
        defaultAgentManifestValues.planner.mode,
        "planner.mode",
        path,
      ),
      failureStrategy: optionalAllowedValue(
        planner,
        "failureStrategy",
        failureStrategies,
        defaultAgentManifestValues.planner.failureStrategy,
        "planner.failureStrategy",
        path,
      ),
    },
    permissions: {
      approvalRequired: optionalBoolean(
        permissions,
        "approvalRequired",
        defaultAgentManifestValues.permissions.approvalRequired,
        path,
      ),
      canUseNetwork: optionalBoolean(
        permissions,
        "canUseNetwork",
        defaultAgentManifestValues.permissions.canUseNetwork,
        path,
      ),
      canWriteDatabase: optionalBoolean(
        permissions,
        "canWriteDatabase",
        defaultAgentManifestValues.permissions.canWriteDatabase,
        path,
      ),
    },
    memory: {
      promotionMode: optionalAllowedValue(
        memory,
        "promotionMode",
        memoryPromotionModes,
        defaultAgentManifestValues.memory
          .promotionMode as AgentMemoryPromotionMode,
        "memory.promotionMode",
        path,
      ),
    },
    handoffs: normalizeHandoffs(raw, path),
    tests: normalizeTests(raw, path),
    identity: normalizeIdentity(raw, path),
    criticalRules: normalizeCriticalRules(raw, path),
    deliverables: normalizeDeliverables(raw, path),
    workflow: normalizeWorkflow(raw, path),
    communicationStyle: normalizeCommunicationStyle(raw, path),
    successMetrics: normalizeSuccessMetrics(raw, path),
    teamId: optionalString(raw, "teamId", path),
    runtimeStatus: optionalAllowedValue(
      raw,
      "runtimeStatus",
      ["runnable", "template"] as const,
      "runnable",
      "runtimeStatus",
      path,
    ),
  };
}

function resolveFromCwd(cwd: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(cwd, path);
}

function defaultCwd(
  pathExists: (path: string) => boolean,
  startCwd: string,
): string {
  let current = resolve(startCwd);
  while (true) {
    if (pathExists(join(current, "agents", "builtin"))) return current;
    const parent = resolve(current, "..");
    if (parent === current) return resolve(startCwd);
    current = parent;
  }
}

function expectedSourceForRoot(rootPath: string): AgentSource | undefined {
  const segments = resolve(rootPath)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  const parent = segments[segments.length - 2];
  const leaf = segments[segments.length - 1];
  if (parent !== "agents") return undefined;
  if (leaf === "builtin" || leaf === "community" || leaf === "custom") {
    return leaf;
  }
  return undefined;
}

async function findManifestPaths(
  roots: string[],
  cwd: string,
  pathExists: (path: string) => boolean,
): Promise<{ manifestPaths: ManifestPath[]; resolvedRoots: string[] }> {
  const manifestPaths: ManifestPath[] = [];
  const resolvedRoots: string[] = [];
  let discoveryIndex = 0;

  for (const [rootIndex, root] of roots.entries()) {
    const rootPath = resolveFromCwd(cwd, root);
    const expectedSource = expectedSourceForRoot(rootPath);
    resolvedRoots.push(rootPath);
    if (!pathExists(rootPath)) continue;

    const entries = (await readdir(rootPath, { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(rootPath, entry.name, "agent.yaml");
      if (pathExists(manifestPath)) {
        manifestPaths.push({
          path: manifestPath,
          rootIndex,
          discoveryIndex,
          expectedSource,
        });
        discoveryIndex += 1;
      }
    }
  }

  return { manifestPaths, resolvedRoots };
}

function assertManifestSourceMatchesRoot(
  manifest: AgentManifest,
  path: string,
  expectedSource?: AgentSource,
): void {
  if (!expectedSource || manifest.source === expectedSource) return;
  throw manifestError(
    path,
    `source mismatch: expected ${expectedSource} from root, found ${manifest.source}`,
  );
}

function overrideError(
  loaded: LoadedManifest,
  existing: LoadedManifest,
  message: string,
): Error {
  return new Error(`${message} in manifests: ${existing.path}, ${loaded.path}`);
}

function selectManifests(
  manifests: LoadedManifest[],
  env: Record<string, string | undefined>,
): LoadedManifest[] {
  const byAgentId = new Map<AgentId, LoadedManifest>();
  const selected: LoadedManifest[] = [];
  const allowBuiltinOverride =
    env.AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE === "1";

  for (const loaded of manifests) {
    const existing = byAgentId.get(loaded.manifest.agentId);
    if (!existing) {
      byAgentId.set(loaded.manifest.agentId, loaded);
      selected.push(loaded);
      continue;
    }

    const existingSource = existing.manifest.source;
    const loadedSource = loaded.manifest.source;
    const { agentId } = loaded.manifest;

    if (existingSource === "builtin" && loadedSource === "community") {
      throw overrideError(
        loaded,
        existing,
        `community cannot override builtin agentId ${agentId}`,
      );
    }

    if (existingSource === "builtin" && loadedSource === "custom") {
      if (!allowBuiltinOverride) {
        throw overrideError(
          loaded,
          existing,
          `custom cannot override builtin agentId ${agentId}; set AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE=1 to allow local override`,
        );
      }
      byAgentId.set(agentId, loaded);
      selected[selected.indexOf(existing)] = loaded;
      continue;
    }

    if (existingSource === "community" && loadedSource === "custom") {
      byAgentId.set(agentId, loaded);
      selected[selected.indexOf(existing)] = loaded;
      continue;
    }

    throw overrideError(loaded, existing, `Duplicate agentId ${agentId}`);
  }

  return selected;
}

function sortManifests(manifests: LoadedManifest[]): LoadedManifest[] {
  return [...manifests].sort((left, right) => {
    if (left.rootIndex !== right.rootIndex) {
      return left.rootIndex - right.rootIndex;
    }
    const leftSourceOrder =
      rootSourceOrder.get(left.manifest.source) ?? Number.MAX_SAFE_INTEGER;
    const rightSourceOrder =
      rootSourceOrder.get(right.manifest.source) ?? Number.MAX_SAFE_INTEGER;
    if (leftSourceOrder !== rightSourceOrder) {
      return leftSourceOrder - rightSourceOrder;
    }
    return left.discoveryIndex - right.discoveryIndex;
  });
}

export async function loadAgentManifests(
  options: LoadAgentManifestsOptions = {},
): Promise<AgentManifest[]> {
  const pathExists = options.exists ?? existsSync;
  const roots = options.roots ?? DEFAULT_AGENT_ROOTS;
  const env = options.env ?? process.env;
  const requestedCwd = resolve(options.cwd ?? process.cwd());
  const cwd = options.roots
    ? requestedCwd
    : defaultCwd(pathExists, requestedCwd);
  const readFile =
    options.readFile ??
    ((path: string) => readFileFromFs(path, { encoding: "utf8" }));

  const { manifestPaths, resolvedRoots } = await findManifestPaths(
    roots,
    cwd,
    pathExists,
  );
  if (manifestPaths.length === 0) {
    throw new Error(
      `No agent manifests found under root(s): ${resolvedRoots.join(", ")}`,
    );
  }

  const manifests: LoadedManifest[] = [];
  for (const manifestPath of manifestPaths) {
    try {
      const content = await readFile(manifestPath.path);
      const manifest = normalizeManifest(parse(content), manifestPath.path);
      assertManifestSourceMatchesRoot(
        manifest,
        manifestPath.path,
        manifestPath.expectedSource,
      );
      manifests.push({
        manifest,
        path: manifestPath.path,
        rootIndex: manifestPath.rootIndex,
        discoveryIndex: manifestPath.discoveryIndex,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes(manifestPath.path)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw manifestError(
        manifestPath.path,
        `Failed to load manifest: ${message}`,
      );
    }
  }

  return sortManifests(selectManifests(manifests, env)).map(
    (loaded) => loaded.manifest,
  );
}
