import { existsSync } from "node:fs";
import { readdir, readFile as readFileFromFs } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { parse } from "yaml";

import type { JsonObject, ToolInteractionKind } from "../modules/ingest-service";
import type {
  SkillArtifactRenderer,
  SkillCategory,
  SkillExecutionKind,
  SkillManifest,
  SkillProjectSource,
  SkillUiMode,
} from "./skill-manifest";

export interface LoadSkillManifestsOptions {
  roots?: string[];
  cwd?: string;
  readFile?: (path: string) => Promise<string>;
  exists?: (path: string) => boolean;
}

const DEFAULT_ROOTS = ["skills/builtin"];
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MAX_OUTPUT_BYTES = 1048576;

const BUILTIN_SKILL_ORDER = new Map(
  [
    "web_listening",
    "doc_to_md",
    "md_to_rag",
    "rag_to_agent",
    "climate_monitor",
  ].map((skillId, index) => [skillId, index]),
);

const skillCategories = ["source", "transform", "index", "agent"] as const;
const projectSources = ["builtin", "external"] as const;
const executionKinds = ["http", "cli", "internal", "mcp"] as const;
const interactionKinds = [
  "question",
  "approval",
  "data_request",
  "blocked",
] as const;
const uiModes = ["html", "renderer", "auto"] as const;
const renderers = ["markdown", "table", "json", "text", "image", "file"] as const;

interface LoadedManifest {
  manifest: SkillManifest;
  path: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function manifestError(path: string, message: string): Error {
  return new Error(`${message} in ${path}`);
}

function requiredRecord(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw manifestError(path, `Expected ${key} to be an object`);
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
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw manifestError(path, `Expected ${key} to be a non-empty string`);
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

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  defaultValue: number,
  path: string,
): number {
  const value = record[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw manifestError(path, `Expected ${key} to be a finite number`);
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
    value.some((item) => typeof item !== "string")
  ) {
    throw manifestError(path, `Expected ${key} to be a string array`);
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

function allowedStringArray<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  label: string,
  path: string,
): T[] {
  return stringArray(record, key, path).map((value) =>
    allowedValue(value, allowed, label, path),
  );
}

function jsonObject(
  record: Record<string, unknown>,
  key: string,
  path: string,
): JsonObject {
  const value = record[key];
  if (!isRecord(value)) {
    throw manifestError(path, `Expected ${key} to be an object`);
  }
  return value as JsonObject;
}

function normalizeManifest(raw: unknown, path: string): SkillManifest {
  if (!isRecord(raw)) {
    throw manifestError(path, "Expected manifest to be an object");
  }

  const project = requiredRecord(raw, "project", path);
  const execution = requiredRecord(raw, "execution", path);
  const ui = optionalRecord(raw, "ui", path);
  const permissions = optionalRecord(raw, "permissions", path);

  return {
    skillId: requiredString(raw, "skillId", path),
    moduleId: requiredString(raw, "moduleId", path),
    name: requiredString(raw, "name", path),
    title: optionalString(raw, "title", path),
    description: requiredString(raw, "description", path),
    category: allowedValue(
      requiredString(raw, "category", path),
      skillCategories,
      "category",
      path,
    ) as SkillCategory,
    project: {
      source: allowedValue(
        requiredString(project, "source", path),
        projectSources,
        "project.source",
        path,
      ) as SkillProjectSource,
      defaultSiblingPath: requiredString(project, "defaultSiblingPath", path),
      envPath: optionalString(project, "envPath", path),
      repoUrl: optionalString(project, "repoUrl", path),
      packageName: optionalString(project, "packageName", path),
    },
    execution: {
      kind: allowedValue(
        requiredString(execution, "kind", path),
        executionKinds,
        "execution.kind",
        path,
      ) as SkillExecutionKind,
      adapterId: requiredString(execution, "adapterId", path),
      requiredEnv: stringArray(execution, "requiredEnv", path),
      optionalEnv: stringArray(execution, "optionalEnv", path),
      timeoutMs: optionalNumber(
        execution,
        "timeoutMs",
        DEFAULT_TIMEOUT_MS,
        path,
      ),
      maxOutputBytes: optionalNumber(
        execution,
        "maxOutputBytes",
        DEFAULT_MAX_OUTPUT_BYTES,
        path,
      ),
      allowedCommands: stringArray(execution, "allowedCommands", path),
      supportsResume: optionalBoolean(execution, "supportsResume", false, path),
      readinessHint: optionalString(execution, "readinessHint", path),
    },
    inputSchema: jsonObject(raw, "inputSchema", path),
    outputSchema: jsonObject(raw, "outputSchema", path),
    interactionKinds: allowedStringArray(
      raw,
      "interactionKinds",
      interactionKinds,
      "interactionKinds",
      path,
    ) as ToolInteractionKind[],
    artifactKinds: stringArray(raw, "artifactKinds", path),
    ui: {
      mode: optionalAllowedValue(
        ui,
        "mode",
        uiModes,
        "auto",
        "ui.mode",
        path,
      ) as SkillUiMode,
      htmlEntrypoint: optionalString(ui, "htmlEntrypoint", path),
      openOnTrigger: optionalBoolean(ui, "openOnTrigger", false, path),
      preferredRenderer: optionalAllowedValue(
        ui,
        "preferredRenderer",
        renderers,
        "json",
        "ui.preferredRenderer",
        path,
      ) as SkillArtifactRenderer,
    },
    permissions: {
      approvalRequired: optionalBoolean(
        permissions,
        "approvalRequired",
        false,
        path,
      ),
      canUseNetwork: optionalBoolean(permissions, "canUseNetwork", false, path),
      canWriteDatabase: optionalBoolean(
        permissions,
        "canWriteDatabase",
        true,
        path,
      ),
    },
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
    if (pathExists(join(current, "skills", "builtin"))) return current;
    const parent = resolve(current, "..");
    if (parent === current) return resolve(startCwd);
    current = parent;
  }
}

async function findManifestPaths(
  roots: string[],
  cwd: string,
  pathExists: (path: string) => boolean,
): Promise<{ manifestPaths: string[]; resolvedRoots: string[] }> {
  const manifestPaths: string[] = [];
  const resolvedRoots: string[] = [];

  for (const root of roots) {
    const rootPath = resolveFromCwd(cwd, root);
    resolvedRoots.push(rootPath);
    if (!pathExists(rootPath)) continue;

    const entries = await readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(rootPath, entry.name, "skill.yaml");
      if (pathExists(manifestPath)) manifestPaths.push(manifestPath);
    }
  }

  return {
    manifestPaths: manifestPaths.sort((left, right) => left.localeCompare(right)),
    resolvedRoots,
  };
}

function assertUniqueManifests(manifests: LoadedManifest[]): void {
  const bySkillId = new Map<string, LoadedManifest>();
  const byModuleId = new Map<string, LoadedManifest>();

  for (const loaded of manifests) {
    const skillMatch = bySkillId.get(loaded.manifest.skillId);
    if (skillMatch) {
      throw new Error(
        `Duplicate skillId ${loaded.manifest.skillId} in manifests: ${skillMatch.path}, ${loaded.path}`,
      );
    }
    bySkillId.set(loaded.manifest.skillId, loaded);

    const moduleMatch = byModuleId.get(loaded.manifest.moduleId);
    if (moduleMatch) {
      throw new Error(
        `Duplicate moduleId ${loaded.manifest.moduleId} in manifests: ${moduleMatch.path}, ${loaded.path}`,
      );
    }
    byModuleId.set(loaded.manifest.moduleId, loaded);
  }
}

function sortManifests(manifests: LoadedManifest[]): LoadedManifest[] {
  return [...manifests].sort((left, right) => {
    const leftOrder =
      BUILTIN_SKILL_ORDER.get(left.manifest.skillId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      BUILTIN_SKILL_ORDER.get(right.manifest.skillId) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.path.localeCompare(right.path);
  });
}

export async function loadSkillManifests(
  options: LoadSkillManifestsOptions = {},
): Promise<SkillManifest[]> {
  const pathExists = options.exists ?? existsSync;
  const roots = options.roots ?? DEFAULT_ROOTS;
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
      `No skill manifests found under root(s): ${resolvedRoots.join(", ")}`,
    );
  }

  const manifests: LoadedManifest[] = [];

  for (const manifestPath of manifestPaths) {
    try {
      const content = await readFile(manifestPath);
      manifests.push({
        manifest: normalizeManifest(parse(content), manifestPath),
        path: manifestPath,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes(manifestPath)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw manifestError(manifestPath, `Failed to load manifest: ${message}`);
    }
  }

  assertUniqueManifests(manifests);
  return sortManifests(manifests).map((loaded) => loaded.manifest);
}
