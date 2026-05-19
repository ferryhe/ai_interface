import { defaultSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";

export type ModuleId = string;

export interface ModuleDefinition {
  moduleId: ModuleId;
  displayName: string;
  description: string;
  category: "source" | "transform" | "index" | "agent";
  resultKinds: string[];
}

export const moduleRegistry: ModuleDefinition[] =
  defaultSkillRuntimeRegistry.listModuleDefinitions();

export function isKnownModuleId(moduleId: string): moduleId is ModuleId {
  return defaultSkillRuntimeRegistry.isKnownModuleId(moduleId);
}
