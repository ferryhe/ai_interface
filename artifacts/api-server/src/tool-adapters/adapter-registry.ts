import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ModuleId } from "../modules/registry";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";

export type ToolAdapterKind = "http" | "cli" | "mcp";
export type ToolAdapterReadinessStatus = "ready" | "missing_required_env";
export type ToolAdapterWorkingDirectory = "workspace" | "project";

export interface ToolAdapterDefinition {
  adapterId: string;
  moduleId: ModuleId;
  adapterKind: ToolAdapterKind;
  displayName: string;
  description: string;
  sourceRepo: string;
  requiredEnv: string[];
  optionalEnv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  command?: string[];
  workingDirectory?: ToolAdapterWorkingDirectory;
  allowedCommands: string[];
  supportsResume: boolean;
  readinessHint: string;
  mcpServerEnv?: string;
  mcpToolName?: string;
  projectFallback?: {
    defaultSiblingPath: string;
    envPath?: string;
    requiredPaths: string[];
  };
}

export interface ToolAdapterReadiness extends ToolAdapterDefinition {
  configured: boolean;
  status: ToolAdapterReadinessStatus;
  missingRequiredEnv: string[];
  configuredOptionalEnv: string[];
}

export const adapterDefinitions: ToolAdapterDefinition[] =
  defaultSkillRuntimeRegistry.listAdapterDefinitions();

export function getAdapterDefinition(
  moduleId: ModuleId,
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): ToolAdapterDefinition {
  return registry.getAdapterDefinition(moduleId);
}

function hasEnvValue(
  env: Record<string, string | undefined>,
  name: string,
): boolean {
  return Boolean(env[name]?.trim());
}

interface AdapterReadinessOptions {
  cwd?: string;
  pathExists?: (path: string) => boolean;
}

function defaultProjectCandidates(
  defaultSiblingPath: string,
  cwd: string,
): string[] {
  return [
    resolve(cwd, defaultSiblingPath),
    resolve(cwd, "..", defaultSiblingPath),
    resolve(cwd, "..", "..", defaultSiblingPath),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}

function hasReadyProjectFallback(
  definition: ToolAdapterDefinition,
  options: AdapterReadinessOptions,
): boolean {
  const fallback = definition.projectFallback;
  if (!fallback) return false;
  const pathExists = options.pathExists ?? existsSync;
  const cwd = options.cwd ?? process.cwd();
  return defaultProjectCandidates(fallback.defaultSiblingPath, cwd).some(
    (candidate) =>
      pathExists(candidate) &&
      fallback.requiredPaths.every((requiredPath) =>
        pathExists(join(candidate, requiredPath)),
      ),
  );
}

function requiredEnvForReadiness(definition: ToolAdapterDefinition): string[] {
  const requiredEnv = [...definition.requiredEnv];
  if (
    definition.adapterKind === "mcp" &&
    definition.mcpServerEnv &&
    !requiredEnv.includes(definition.mcpServerEnv)
  ) {
    requiredEnv.push(definition.mcpServerEnv);
  }
  return requiredEnv;
}

export function listAdapterReadiness(
  env: Record<string, string | undefined> = process.env,
  options: AdapterReadinessOptions = {},
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): ToolAdapterReadiness[] {
  return registry.listAdapterDefinitions().map((definition) =>
    getAdapterReadiness(definition, env, options),
  );
}

export function getAdapterReadiness(
  definition: ToolAdapterDefinition,
  env: Record<string, string | undefined> = process.env,
  options: AdapterReadinessOptions = {},
): ToolAdapterReadiness {
  const requiredEnv = requiredEnvForReadiness(definition);
  let missingRequiredEnv = requiredEnv.filter(
    (name) => !hasEnvValue(env, name),
  );
  if (
    missingRequiredEnv.length > 0 &&
    hasReadyProjectFallback(definition, options)
  ) {
    const projectEnvPath = definition.projectFallback?.envPath;
    missingRequiredEnv = missingRequiredEnv.filter(
      (name) => name !== projectEnvPath,
    );
  }
  const configuredOptionalEnv = definition.optionalEnv.filter((name) =>
    hasEnvValue(env, name),
  );
  const configured = missingRequiredEnv.length === 0;

  return {
    ...definition,
    requiredEnv,
    optionalEnv: [...definition.optionalEnv],
    allowedCommands: [...definition.allowedCommands],
    projectFallback: definition.projectFallback
      ? {
          ...definition.projectFallback,
          requiredPaths: [...definition.projectFallback.requiredPaths],
        }
      : undefined,
    configured,
    status: configured ? "ready" : "missing_required_env",
    missingRequiredEnv,
    configuredOptionalEnv,
  };
}
