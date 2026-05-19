import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { JsonObject, ToolInteractionKind } from "../modules/ingest-service";
import type { ModuleId } from "../modules/registry";
import type { ToolAdapterDefinition } from "../tool-adapters/adapter-registry";
import { loadSkillManifests } from "./skill-loader";

export type SkillId = string;

export type SkillCategory = "source" | "transform" | "index" | "agent";

export type SkillToolAdapterKind = "http" | "cli";

export type SkillExecutionKind = SkillToolAdapterKind | "internal" | "mcp";

export type SkillArtifactRenderer =
  | "markdown"
  | "table"
  | "json"
  | "text"
  | "image"
  | "file";

export type SkillUiMode = "html" | "renderer" | "auto";

export type SkillProjectSource = "builtin" | "external";

export type SkillProjectReadinessStatus = "ready" | "not_configured";

export interface SkillProjectMetadata {
  source: SkillProjectSource;
  defaultSiblingPath: string;
  envPath?: string;
  repoUrl?: string;
  packageName?: string;
}

export interface SkillUi {
  mode: SkillUiMode;
  htmlEntrypoint?: string;
  openOnTrigger: boolean;
  preferredRenderer: SkillArtifactRenderer;
}

export interface SkillExecution {
  kind: SkillExecutionKind;
  adapterId: string;
  requiredEnv: string[];
  optionalEnv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  allowedCommands: string[];
  supportsResume: boolean;
  readinessHint?: string;
}

export interface SkillPermissionDefaults {
  approvalRequired: boolean;
  canUseNetwork: boolean;
  canWriteDatabase: boolean;
}

export interface SkillManifest {
  skillId: SkillId;
  moduleId: ModuleId;
  name: string;
  title?: string;
  description: string;
  category: SkillCategory;
  project: SkillProjectMetadata;
  execution: SkillExecution;
  inputSchema: JsonObject;
  outputSchema: JsonObject;
  interactionKinds: ToolInteractionKind[];
  artifactKinds: string[];
  ui: SkillUi;
  permissions: SkillPermissionDefaults;
}

export interface SkillManifestRegistry {
  listSkills(): SkillManifest[];
  getSkill(skillId: string): SkillManifest | null;
  hasSkill(skillId: string): boolean;
  listSkillIds(): string[];
}

export interface SkillReadiness {
  skillId: string;
  project: {
    status: SkillProjectReadinessStatus;
    configuredBy: string | null;
    defaultSiblingPath: string;
  };
  adapter: {
    status: "ready" | "missing_required_env";
    configured: boolean;
    adapterId: string;
    missingRequiredEnv: string[];
    configuredOptionalEnv: string[];
  };
  ui: {
    mode: SkillUiMode;
    hasHtml: boolean;
    openOnTrigger: boolean;
    preferredRenderer: SkillArtifactRenderer;
  };
}

export const builtinSkillManifests: SkillManifest[] =
  await loadSkillManifests();

export function createSkillManifestRegistry(
  customManifests: SkillManifest[] = [],
): SkillManifestRegistry {
  const order: string[] = [];
  const byId = new Map<string, SkillManifest>();

  for (const manifest of [...builtinSkillManifests, ...customManifests]) {
    if (!byId.has(manifest.skillId)) order.push(manifest.skillId);
    byId.set(manifest.skillId, manifest);
  }

  return {
    listSkills: () =>
      order
        .map((skillId) => byId.get(skillId))
        .filter((manifest): manifest is SkillManifest => Boolean(manifest)),
    getSkill: (skillId: string) => byId.get(skillId) ?? null,
    hasSkill: (skillId: string) => byId.has(skillId),
    listSkillIds: () => order.filter((skillId) => byId.has(skillId)),
  };
}

export function manifestAdapterDefinition(
  manifest: SkillManifest,
): ToolAdapterDefinition {
  const builtinAdapterText: Record<
    string,
    { displayName: string; description: string }
  > = {
    web_listening: {
      displayName: "Web Listening CLI Adapter",
      description: "Metadata contract for the Web Listening CLI module adapter.",
    },
    doc_to_md: {
      displayName: "Doc to Markdown HTTP Adapter",
      description:
        "Metadata contract for the Doc to Markdown HTTP module adapter.",
    },
    md_to_rag: {
      displayName: "Markdown to RAG CLI Adapter",
      description:
        "Metadata contract for the Markdown to RAG CLI module adapter.",
    },
    rag_to_agent: {
      displayName: "RAG to Agent HTTP Adapter",
      description: "Metadata contract for the RAG to Agent HTTP module adapter.",
    },
    climate_monitor: {
      displayName: "Climate Monitor CLI Adapter",
      description: "Fixed CLI contract for the climate monitor wiki runner.",
    },
  };
  const adapterText = builtinAdapterText[manifest.skillId];
  return {
    adapterId: manifest.execution.adapterId,
    moduleId: manifest.moduleId,
    adapterKind:
      manifest.execution.kind === "http" || manifest.execution.kind === "cli"
        ? manifest.execution.kind
        : "cli",
    displayName:
      adapterText?.displayName ?? `${manifest.title ?? manifest.name} Adapter`,
    description: adapterText?.description ?? manifest.description,
    sourceRepo: manifest.project.repoUrl ?? manifest.project.packageName ?? "",
    requiredEnv: [...manifest.execution.requiredEnv],
    optionalEnv: [...manifest.execution.optionalEnv],
    timeoutMs: manifest.execution.timeoutMs,
    maxOutputBytes: manifest.execution.maxOutputBytes,
    allowedCommands: [...manifest.execution.allowedCommands],
    supportsResume: manifest.execution.supportsResume,
    readinessHint:
      manifest.execution.readinessHint ??
      `Configure ${manifest.execution.adapterId} to enable skill handoffs.`,
    projectFallback:
      manifest.moduleId === "climate_monitor"
        ? {
            defaultSiblingPath: manifest.project.defaultSiblingPath,
            requiredPath: "scripts/run_climate_monitor.py",
          }
        : undefined,
  };
}

function hasEnvValue(
  env: Record<string, string | undefined>,
  name: string,
): boolean {
  return Boolean(env[name]?.trim());
}

function projectCandidatePath(
  project: SkillProjectMetadata,
  env: Record<string, string | undefined>,
  pathExistsFn: (path: string) => boolean,
  cwd: string,
): { candidatePath: string; configuredBy: string | null } {
  if (project.envPath && hasEnvValue(env, project.envPath)) {
    return {
      candidatePath: env[project.envPath]!.trim(),
      configuredBy: project.envPath,
    };
  }

  const defaultCandidates = defaultProjectCandidates(
    project.defaultSiblingPath,
    cwd,
  );
  const readyDefault = defaultCandidates.find(pathExistsFn);
  return {
    candidatePath:
      readyDefault ??
      defaultCandidates[0] ??
      resolve(cwd, project.defaultSiblingPath),
    configuredBy: project.defaultSiblingPath ? "defaultSiblingPath" : null,
  };
}

function defaultProjectCandidates(
  defaultSiblingPathValue: string,
  cwd: string,
): string[] {
  return [
    resolve(cwd, defaultSiblingPathValue),
    resolve(cwd, "..", defaultSiblingPathValue),
    resolve(cwd, "..", "..", defaultSiblingPathValue),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}

function hasReadyProjectFallback(
  definition: ToolAdapterDefinition,
  options: {
    cwd: string;
    pathExists: (path: string) => boolean;
  },
): boolean {
  const fallback = definition.projectFallback;
  if (!fallback) return false;
  return defaultProjectCandidates(fallback.defaultSiblingPath, options.cwd).some(
    (candidate) => options.pathExists(join(candidate, fallback.requiredPath)),
  );
}

function adapterReadiness(
  definition: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
  options: {
    cwd: string;
    pathExists: (path: string) => boolean;
  },
): {
  status: "ready" | "missing_required_env";
  configured: boolean;
  missingRequiredEnv: string[];
  configuredOptionalEnv: string[];
} {
  let missingRequiredEnv = definition.requiredEnv.filter(
    (name) => !hasEnvValue(env, name),
  );
  if (
    missingRequiredEnv.length > 0 &&
    hasReadyProjectFallback(definition, options)
  ) {
    missingRequiredEnv = [];
  }

  const configuredOptionalEnv = definition.optionalEnv.filter((name) =>
    hasEnvValue(env, name),
  );
  const configured = missingRequiredEnv.length === 0;
  return {
    status: configured ? "ready" : "missing_required_env",
    configured,
    missingRequiredEnv,
    configuredOptionalEnv,
  };
}

export function listSkillReadiness(
  registry: SkillManifestRegistry,
  options: {
    env?: Record<string, string | undefined>;
    pathExists?: (path: string) => boolean;
    cwd?: string;
  } = {},
): SkillReadiness[] {
  const env = options.env ?? process.env;
  const pathExists = options.pathExists ?? existsSync;
  const cwd = options.cwd ?? process.cwd();

  return registry.listSkills().map((manifest) => {
    const project = projectCandidatePath(
      manifest.project,
      env,
      pathExists,
      cwd,
    );
    const adapterReadinessResult = adapterReadiness(
      manifestAdapterDefinition(manifest),
      env,
      { cwd, pathExists },
    );

    return {
      skillId: manifest.skillId,
      project: {
        status: pathExists(project.candidatePath) ? "ready" : "not_configured",
        configuredBy: project.configuredBy,
        defaultSiblingPath: manifest.project.defaultSiblingPath,
      },
      adapter: {
        status: adapterReadinessResult.status,
        configured: adapterReadinessResult.configured,
        adapterId: manifest.execution.adapterId,
        missingRequiredEnv: [...adapterReadinessResult.missingRequiredEnv],
        configuredOptionalEnv: [
          ...adapterReadinessResult.configuredOptionalEnv,
        ],
      },
      ui: {
        mode: manifest.ui.mode,
        hasHtml: Boolean(manifest.ui.htmlEntrypoint),
        openOnTrigger: manifest.ui.openOnTrigger,
        preferredRenderer: manifest.ui.preferredRenderer,
      },
    };
  });
}
