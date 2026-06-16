import type { BusinessSkillSetting } from "../agent-config/agent-config-service";
import type { JsonObject } from "../modules/ingest-service";
import type { ModuleId } from "../modules/registry";
import {
  manifestAdapterDefinition,
  type SkillManifest,
} from "../skill-runtime/skill-manifest";
import type { ToolAdapterDefinition } from "../tool-adapters/adapter-registry";

export type SkillAdapterMode =
  | "external_api"
  | "external_cli_or_api"
  | "internal";

export interface BusinessSkillDefinition {
  skillId: string;
  moduleId: ModuleId;
  displayName: string;
  description: string;
  adapter: ToolAdapterDefinition;
  adapterMode: SkillAdapterMode;
  canonicalEntrypoints: string[];
  outputContracts: string[];
  inputSchema: JsonObject;
  permissionDefaults: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
  manifest?: SkillManifest;
}

export function businessSkillDefinitionFromManifest(
  manifest: SkillManifest,
): BusinessSkillDefinition {
  return {
    skillId: manifest.skillId,
    moduleId: manifest.moduleId,
    displayName: manifest.title ?? manifest.name,
    description: manifest.description,
    adapter: manifestAdapterDefinition(manifest),
    adapterMode:
      manifest.execution.kind === "internal"
        ? "internal"
        : manifest.execution.kind === "http"
          ? "external_api"
          : "external_cli_or_api",
    canonicalEntrypoints:
      manifest.execution.allowedCommands.length > 0
        ? [...manifest.execution.allowedCommands]
        : [manifest.execution.adapterId],
    outputContracts: [...manifest.artifactKinds],
    inputSchema: manifest.inputSchema,
    permissionDefaults: {
      approvalRequired: manifest.permissions.approvalRequired,
      canUseNetwork: manifest.permissions.canUseNetwork,
      canWriteDatabase: manifest.permissions.canWriteDatabase,
    },
    manifest,
  };
}

export function getBusinessSkillSetting(
  settings: BusinessSkillSetting[],
  moduleId: ModuleId,
): BusinessSkillSetting | null {
  return settings.find((setting) => setting.moduleId === moduleId) ?? null;
}
