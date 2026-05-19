import type { BusinessSkillSetting } from "../agent-config/agent-config-service";
import type { ModuleId } from "../modules/registry";
import { defaultSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import {
  businessSkillDefinitionFromManifest,
  getBusinessSkillSetting,
  type BusinessSkillDefinition,
  type SkillAdapterMode,
} from "./business-skill-definition";

export {
  businessSkillDefinitionFromManifest,
  getBusinessSkillSetting,
  type BusinessSkillDefinition,
  type SkillAdapterMode,
};

export const businessSkillDefinitions: BusinessSkillDefinition[] =
  defaultSkillRuntimeRegistry.listBusinessSkillDefinitions();

export function getBusinessSkillDefinition(
  moduleId: ModuleId,
): BusinessSkillDefinition {
  return defaultSkillRuntimeRegistry.getBusinessSkillDefinition(moduleId);
}

export function listEnabledBusinessSkillDefinitions(
  settings: BusinessSkillSetting[],
): BusinessSkillDefinition[] {
  const enabledModuleIds = new Set(
    settings
      .filter((setting) => setting.enabled)
      .map((setting) => setting.moduleId),
  );

  return defaultSkillRuntimeRegistry
    .listBusinessSkillDefinitions()
    .filter((definition) => enabledModuleIds.has(definition.moduleId));
}
