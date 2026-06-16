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

// ── Nine-segment optional fields ──

export interface AgentIdentity {
  persona: string;
  background: string;
}

export interface AgentCriticalRule {
  id: string;
  description: string;
  severity: "blocker" | "warning";
}

export interface AgentDeliverable {
  name: string;
  format: string;
  description: string;
  successCriteria: string;
}

export interface AgentWorkflowPhase {
  name: string;
  description: string;
  approvalRequired: boolean;
  deliverables: string[];
}

export interface AgentCommunicationStyle {
  tone: string;
  outputFormat: string;
  languagePreference: string;
}

export interface AgentSuccessMetric {
  metric: string;
  target: string;
  measurement: string;
}

/** @deprecated Use AgentSuccessMetric. */
export type AgentSuccessMetrics = AgentSuccessMetric;

export type AgentRuntimeStatus = "runnable" | "template";

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
  // Nine-segment optional fields
  identity?: AgentIdentity;
  criticalRules?: AgentCriticalRule[];
  deliverables?: AgentDeliverable[];
  workflow?: AgentWorkflowPhase[];
  communicationStyle?: AgentCommunicationStyle;
  successMetrics?: AgentSuccessMetric[];
  // Team / status
  teamId?: string;
  runtimeStatus?: AgentRuntimeStatus;
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
