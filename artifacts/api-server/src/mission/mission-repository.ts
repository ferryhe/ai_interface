import type { MissionPlan, MissionPlanStatus, MissionRiskLevel } from "./mission-plan";

export type MissionRevisionStatus = "draft" | "approved" | "superseded" | "executed";

export interface MissionRecord {
  missionId: string;
  title: string;
  userGoal: string;
  status: MissionPlanStatus;
  riskLevel: MissionRiskLevel;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MissionPlanRevisionRecord {
  revisionId: string;
  missionId: string;
  revisionNumber: number;
  status: MissionRevisionStatus;
  plan: MissionPlan;
  createdAt: Date;
}

export interface MissionExecutionLinkRecord {
  missionId: string;
  revisionId: string;
  threadId: string | null;
  pipelineRunId: string | null;
  sourceAgentRunId: string | null;
  executedAt: Date | null;
}

export interface CreateMissionInput {
  missionId: string;
  title: string;
  userGoal: string;
  status?: MissionPlanStatus;
  riskLevel: MissionRiskLevel;
  plan: MissionPlan;
}

export interface CreateMissionRevisionInput {
  missionId: string;
  plan: MissionPlan;
}

export interface ApproveMissionRevisionInput {
  missionId: string;
  revisionId: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface LinkMissionExecutionInput {
  missionId: string;
  revisionId: string;
  threadId?: string | null;
  pipelineRunId?: string | null;
  sourceAgentRunId?: string | null;
  executedAt?: Date | null;
}

export class MissionRevisionConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "MissionRevisionConflictError";
  }
}

export interface MissionRepository {
  createMission(input: CreateMissionInput): Promise<{
    mission: MissionRecord;
    revision: MissionPlanRevisionRecord;
  }>;
  createRevision(input: CreateMissionRevisionInput): Promise<MissionPlanRevisionRecord>;
  approveRevision(input: ApproveMissionRevisionInput): Promise<{
    mission: MissionRecord;
    revision: MissionPlanRevisionRecord;
  }>;
  linkExecution(input: LinkMissionExecutionInput): Promise<MissionExecutionLinkRecord>;
  findMission(missionId: string): Promise<MissionRecord | null>;
  findRevision(revisionId: string): Promise<MissionPlanRevisionRecord | null>;
  findLatestRevision(missionId: string): Promise<MissionPlanRevisionRecord | null>;
  listRevisions(missionId: string): Promise<MissionPlanRevisionRecord[]>;
}
