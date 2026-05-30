export type MissionRiskLevel = "low" | "medium" | "high";
export type MissionStatus =
  | "draft"
  | "needs_confirmation"
  | "approved"
  | "in_progress"
  | "completed"
  | "failed";
export type MissionStepStatus =
  | "pending"
  | "waiting_approval"
  | "running"
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled";
export type MissionReviewMode = "draft_for_review" | "plan_only";
export type MissionExecutionMode = "plan_only" | "execute_ready";

export interface MissionStepApproval {
  required: boolean;
  reason: string;
  riskLevel: MissionRiskLevel;
}

export interface MissionPlanStep {
  stepId: string;
  title: string;
  objective: string;
  skillId?: string;
  moduleId?: string;
  assignedAgentId?: string;
  roleId?: string;
  dependsOn: string[];
  status: MissionStepStatus;
  approval?: MissionStepApproval;
}

export interface MissionPlan {
  missionId: string;
  title: string;
  userGoal: string;
  summary: string;
  status: MissionStatus;
  riskLevel: MissionRiskLevel;
  steps: MissionPlanStep[];
  warnings: string[];
  nonGoals: string[];
}

export interface MissionRecord {
  missionId: string;
  title: string;
  userGoal: string;
  status: MissionStatus;
  riskLevel: MissionRiskLevel;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionRevisionRecord {
  revisionId: string;
  missionId: string;
  revisionNumber: number;
  status: string;
  plan: MissionPlan;
  createdAt: string;
}

export interface MissionExecutionReadiness {
  ready: boolean;
  status: "approved" | "stubbed";
  message: string;
  revisionId?: string;
}

export interface MissionBundle {
  mission: MissionRecord;
  revision: MissionRevisionRecord;
  plan: MissionPlan;
}

export interface MissionExecuteResult {
  mission: MissionRecord;
  pipelineRun: unknown | null;
  thread: unknown | null;
  moduleRuns: unknown[];
  executionReadiness: MissionExecutionReadiness;
}
