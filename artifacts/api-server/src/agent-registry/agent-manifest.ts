import type {
  AgentProvider,
  AgentReasoningEffort,
} from "../agent-config/agent-config-service";
import type {
  AgentRuntimePlanMode,
  DagFailureStrategy,
} from "../agent-runtime/agent-runtime-service";
import type { SkillId } from "../skill-runtime/skill-manifest";

export type AgentId = string;
export type AgentSource = "builtin" | "community" | "custom" | "external";
export type AgentMemoryPromotionMode = "manual" | "run_summary" | "disabled";

export interface AgentSkillBinding {
  skillId: SkillId;
  required: boolean;
}

export interface AgentHandoff {
  targetAgentId: AgentId;
  description: string;
}

export interface AgentManifest {
  agentId: AgentId;
  name: string;
  title?: string;
  description: string;
  source: AgentSource;
  instructions: string;
  skills: AgentSkillBinding[];
  provider?: {
    provider?: AgentProvider;
    modelId?: string;
    reasoningEffort?: AgentReasoningEffort;
  };
  planner: {
    mode: AgentRuntimePlanMode;
    failureStrategy: DagFailureStrategy;
  };
  permissions: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
  memory: {
    promotionMode: AgentMemoryPromotionMode;
  };
  handoffs: AgentHandoff[];
  tests: Array<{
    name: string;
    prompt: string;
    expectedSkillIds: SkillId[];
  }>;
}

export interface AgentReadiness {
  agentId: AgentId;
  status: "ready" | "missing_skills";
  missingSkillIds: SkillId[];
  enabledSkillIds: SkillId[];
}

export const AGENT_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export const defaultAgentManifestValues = {
  planner: {
    mode: "linear",
    failureStrategy: "fail_fast",
  },
  permissions: {
    approvalRequired: false,
    canUseNetwork: false,
    canWriteDatabase: true,
  },
  memory: {
    promotionMode: "run_summary",
  },
  handoffs: [],
  tests: [],
} as const;
