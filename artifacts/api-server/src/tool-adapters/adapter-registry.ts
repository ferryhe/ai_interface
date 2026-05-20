import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ModuleId } from "../modules/registry";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";

export type ToolAdapterKind = "http" | "cli";
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
  projectFallback?: {
    defaultSiblingPath: string;
    requiredPath: string;
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
    (candidate) => pathExists(join(candidate, fallback.requiredPath)),
  );
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
    ...definition,
    requiredEnv: [...definition.requiredEnv],
    optionalEnv: [...definition.optionalEnv],
    allowedCommands: [...definition.allowedCommands],
    projectFallback: definition.projectFallback
      ? { ...definition.projectFallback }
      : undefined,
    configured,
    status: configured ? "ready" : "missing_required_env",
    missingRequiredEnv,
    configuredOptionalEnv,
  };
}
