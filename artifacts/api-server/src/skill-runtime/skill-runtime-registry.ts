import {
  businessSkillDefinitionFromManifest,
  type BusinessSkillDefinition,
} from "../agent-runtime/business-skill-definition";
import type { ModuleDefinition, ModuleId } from "../modules/registry";
import type { ToolAdapterDefinition } from "../tool-adapters/adapter-registry";
import {
  builtinSkillManifests,
  manifestAdapterDefinition,
  type SkillManifest,
} from "./skill-manifest";

export interface SkillRuntimeRegistry {
  listSkills(): SkillManifest[];
  getSkill(skillId: string): SkillManifest | null;
  hasSkill(skillId: string): boolean;
  listSkillIds(): string[];
  listModuleDefinitions(): ModuleDefinition[];
  isKnownModuleId(moduleId: string): boolean;
  listAdapterDefinitions(): ToolAdapterDefinition[];
  getAdapterDefinition(moduleId: ModuleId): ToolAdapterDefinition;
  listBusinessSkillDefinitions(): BusinessSkillDefinition[];
  getBusinessSkillDefinition(moduleId: ModuleId): BusinessSkillDefinition;
}

function cloneSkillManifest(manifest: SkillManifest): SkillManifest {
  return {
    ...manifest,
    project: { ...manifest.project },
    execution: {
      ...manifest.execution,
      requiredEnv: [...manifest.execution.requiredEnv],
      optionalEnv: [...manifest.execution.optionalEnv],
      allowedCommands: [...manifest.execution.allowedCommands],
    },
    inputSchema: { ...manifest.inputSchema },
    outputSchema: { ...manifest.outputSchema },
    interactionKinds: [...manifest.interactionKinds],
    artifactKinds: [...manifest.artifactKinds],
    ui: { ...manifest.ui },
    permissions: { ...manifest.permissions },
  };
}

function moduleDefinitionFromManifest(
  manifest: SkillManifest,
): ModuleDefinition {
  return {
    moduleId: manifest.moduleId,
    displayName: manifest.title ?? manifest.name,
    description: manifest.description,
    category: manifest.category,
    resultKinds: [...manifest.artifactKinds],
  };
}

const builtinBusinessSkillOrder = new Map(
  ["web_listening", "climate_monitor", "doc_to_md", "md_to_rag", "rag_to_agent"].map(
    (skillId, index) => [skillId, index],
  ),
);

function businessSkillOrderIndex(definition: BusinessSkillDefinition): number {
  return (
    builtinBusinessSkillOrder.get(definition.skillId) ?? Number.MAX_SAFE_INTEGER
  );
}

export function createSkillRuntimeRegistry(
  manifests: SkillManifest[] = builtinSkillManifests,
): SkillRuntimeRegistry {
  const order: string[] = [];
  const skillsById = new Map<string, SkillManifest>();

  for (const manifest of manifests) {
    if (!skillsById.has(manifest.skillId)) order.push(manifest.skillId);
    skillsById.set(manifest.skillId, cloneSkillManifest(manifest));
  }

  function listSkills(): SkillManifest[] {
    return order
      .map((skillId) => skillsById.get(skillId))
      .filter((manifest): manifest is SkillManifest => Boolean(manifest))
      .map(cloneSkillManifest);
  }

  function listModuleDefinitions(): ModuleDefinition[] {
    return listSkills().map(moduleDefinitionFromManifest);
  }

  function listAdapterDefinitions(): ToolAdapterDefinition[] {
    return listSkills().map(manifestAdapterDefinition);
  }

  function listBusinessSkillDefinitions(): BusinessSkillDefinition[] {
    return listSkills()
      .map(businessSkillDefinitionFromManifest)
      .sort(
        (left, right) =>
          businessSkillOrderIndex(left) - businessSkillOrderIndex(right),
      );
  }

  return {
    listSkills,
    getSkill: (skillId: string) => {
      const manifest = skillsById.get(skillId);
      return manifest ? cloneSkillManifest(manifest) : null;
    },
    hasSkill: (skillId: string) => skillsById.has(skillId),
    listSkillIds: () => order.filter((skillId) => skillsById.has(skillId)),
    listModuleDefinitions,
    isKnownModuleId: (moduleId: string) =>
      listModuleDefinitions().some(
        (moduleDefinition) => moduleDefinition.moduleId === moduleId,
      ),
    listAdapterDefinitions,
    getAdapterDefinition: (moduleId: ModuleId) => {
      const definition = listAdapterDefinitions().find(
        (adapter) => adapter.moduleId === moduleId,
      );
      if (!definition) {
        throw new Error(`Adapter is not registered: ${String(moduleId)}`);
      }
      return definition;
    },
    listBusinessSkillDefinitions,
    getBusinessSkillDefinition: (moduleId: ModuleId) => {
      const definition = listBusinessSkillDefinitions().find(
        (skill) => skill.moduleId === moduleId,
      );
      if (!definition) {
        throw new Error(`Business skill is not registered: ${moduleId}`);
      }
      return definition;
    },
  };
}

export const defaultSkillRuntimeRegistry = createSkillRuntimeRegistry();
