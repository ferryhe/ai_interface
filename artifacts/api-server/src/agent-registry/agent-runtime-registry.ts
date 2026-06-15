import { defaultSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import type { SkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import { loadAgentManifests } from "./agent-loader";
import type {
  AgentManifest,
  AgentReadiness,
} from "./agent-manifest";

export interface AgentRuntimeRegistry {
  listAgents(): AgentManifest[];
  listAgentIds(): string[];
  getAgent(agentId: string): AgentManifest | null;
  hasAgent(agentId: string): boolean;
  listSkillIdsForAgent(agentId: string): string[];
  validateSkillReferences(): Array<{
    agentId: string;
    missingSkillIds: string[];
  }>;
}

function cloneAgentManifest(manifest: AgentManifest): AgentManifest {
  return {
    ...manifest,
    provider: manifest.provider ? { ...manifest.provider } : undefined,
    skills: manifest.skills.map((binding) => ({ ...binding })),
    planner: { ...manifest.planner },
    permissions: { ...manifest.permissions },
    memory: { ...manifest.memory },
    handoffs: manifest.handoffs.map((handoff) => ({ ...handoff })),
    tests: manifest.tests.map((test) => ({
      ...test,
      expectedSkillIds: [...test.expectedSkillIds],
    })),
    identity: manifest.identity ? { ...manifest.identity } : undefined,
    criticalRules: manifest.criticalRules ? manifest.criticalRules.map((r) => ({ ...r })) : undefined,
    deliverables: manifest.deliverables ? manifest.deliverables.map((d) => ({ ...d })) : undefined,
    workflow: manifest.workflow ? manifest.workflow.map((w) => ({ ...w, deliverables: [...w.deliverables] })) : undefined,
    communicationStyle: manifest.communicationStyle ? { ...manifest.communicationStyle } : undefined,
    successMetrics: manifest.successMetrics ? manifest.successMetrics.map((m) => ({ ...m })) : undefined,
  };
}

export function createAgentRuntimeRegistry(
  agentManifests: AgentManifest[],
  skillRegistry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): AgentRuntimeRegistry {
  const order: string[] = [];
  const agentsById = new Map<string, AgentManifest>();

  for (const manifest of agentManifests) {
    if (!agentsById.has(manifest.agentId)) order.push(manifest.agentId);
    agentsById.set(manifest.agentId, cloneAgentManifest(manifest));
  }

  function listAgents(): AgentManifest[] {
    return order
      .map((agentId) => agentsById.get(agentId))
      .filter((manifest): manifest is AgentManifest => Boolean(manifest))
      .map(cloneAgentManifest);
  }

  function listSkillIdsForAgent(agentId: string): string[] {
    const manifest = agentsById.get(agentId);
    return manifest ? manifest.skills.map((binding) => binding.skillId) : [];
  }

  function validateSkillReferences(): Array<{
    agentId: string;
    missingSkillIds: string[];
  }> {
    return listAgents()
      .map((manifest) => ({
        agentId: manifest.agentId,
        missingSkillIds: manifest.skills
          .map((binding) => binding.skillId)
          .filter((skillId) => !skillRegistry.hasSkill(skillId)),
      }))
      .filter((item) => item.missingSkillIds.length > 0);
  }

  return {
    listAgents,
    listAgentIds: () => order.filter((agentId) => agentsById.has(agentId)),
    getAgent: (agentId: string) => {
      const manifest = agentsById.get(agentId);
      return manifest ? cloneAgentManifest(manifest) : null;
    },
    hasAgent: (agentId: string) => agentsById.has(agentId),
    listSkillIdsForAgent,
    validateSkillReferences,
  };
}

export function listAgentReadiness(
  registry: AgentRuntimeRegistry,
): AgentReadiness[] {
  const missingByAgentId = new Map(
    registry
      .validateSkillReferences()
      .map((item) => [item.agentId, item.missingSkillIds]),
  );

  return registry.listAgentIds().map((agentId) => {
    const enabledSkillIds = registry.listSkillIdsForAgent(agentId);
    const missingSkillIds = missingByAgentId.get(agentId) ?? [];
    return {
      agentId,
      status: missingSkillIds.length > 0 ? "missing_skills" : "ready",
      missingSkillIds: [...missingSkillIds],
      enabledSkillIds,
    };
  });
}

export const defaultAgentRuntimeRegistry = createAgentRuntimeRegistry(
  await loadAgentManifests(),
  defaultSkillRuntimeRegistry,
);
