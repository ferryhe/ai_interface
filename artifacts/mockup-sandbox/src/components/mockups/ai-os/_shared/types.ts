export type AgentRunStatus = "running" | "waiting" | "done" | "paused";

export type TimelineStatus = "done" | "active" | "waiting" | "queued";

export type TimelineKind =
  | "plan"
  | "tool"
  | "change"
  | "test"
  | "preview"
  | "decision";

export type InspectorView = "changes" | "code" | "logs" | "preview";

export type MainDockView = "preview" | "agent" | "deploy" | "tool" | "tasks";

export type ToolSlotId =
  | "git"
  | "console"
  | "secrets"
  | "database"
  | "packages"
  | "search"
  | "debugger";

export interface AgentTask {
  id: string;
  title: string;
  project: string;
  status: AgentRunStatus;
  progress: number;
  updatedAt: string;
  model: string;
  priority: "high" | "normal" | "low";
}

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  status: TimelineStatus;
  title: string;
  detail: string;
  time: string;
  artifact?: string;
  files?: string[];
  requiresApproval?: boolean;
}

export interface FileChange {
  path: string;
  summary: string;
  additions: number;
  deletions: number;
  status: "created" | "modified" | "review";
}

export interface RuntimeSignal {
  label: string;
  value: string;
  state: "good" | "warn" | "neutral";
}

export interface InspectorFile {
  path: string;
  language: string;
  lines: string[];
}

export type AgentSource = "builtin" | "community" | "custom" | "external";

export type AgentReadinessStatus = "ready" | "missing_skills";

export type AgentPlannerMode = "linear" | "dag";

export type AgentFailureStrategy = "fail_fast" | "continue_independent";

export type AgentMemoryPromotionMode = "manual" | "run_summary" | "disabled";

export type WorkbenchRunStatus =
  | "pending"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "approval_required"
  | "waiting_for_user"
  | "waiting_for_data"
  | "blocked"
  | "skipped";

export interface AgentSkillBinding {
  skillId: string;
  required: boolean;
}

export interface AgentHandoff {
  targetAgentId: string;
  description: string;
}

export interface AgentManifestPreview {
  agentId: string;
  name: string;
  title?: string;
  description: string;
  source: AgentSource;
  instructions: string;
  skills: AgentSkillBinding[];
  planner: {
    mode: AgentPlannerMode;
    failureStrategy: AgentFailureStrategy;
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
    expectedSkillIds: string[];
  }>;
}

export interface AgentReadiness {
  agentId: string;
  status: AgentReadinessStatus;
  missingSkillIds: string[];
  enabledSkillIds: string[];
}

export interface WorkbenchSkillOption {
  skillId: string;
  name: string;
  description: string;
}

export interface WorkbenchRunStep {
  id: string;
  order: number;
  moduleId: string;
  title: string;
  status: WorkbenchRunStatus;
  summary: string;
  activeSkillId?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface WorkbenchRunEvent {
  id: string;
  time: string;
  type: string;
  status: WorkbenchRunStatus;
  title: string;
  detail: string;
}

export interface WorkbenchRunInspection {
  pipelineRunId: string;
  title: string;
  agentId?: string;
  status: WorkbenchRunStatus;
  activeSkillId?: string;
  updatedAt: string;
  moduleSteps: WorkbenchRunStep[];
  events: WorkbenchRunEvent[];
  raw: unknown;
}

export interface WorkbenchArtifact {
  id: string;
  title: string;
  kind: string;
  summary: string;
  moduleRunId: string;
  moduleId: string;
  createdAt: string;
  content?: unknown;
  raw?: unknown;
}

export interface WorkbenchArtifactModuleGroup {
  moduleRunId: string;
  moduleId: string;
  artifacts: WorkbenchArtifact[];
}

export interface WorkbenchArtifactPipelineGroup {
  pipelineRunId: string;
  title: string;
  moduleGroups: WorkbenchArtifactModuleGroup[];
}
