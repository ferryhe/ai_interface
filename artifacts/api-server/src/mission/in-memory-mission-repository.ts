import { randomUUID } from "node:crypto";

import { validateMissionPlan, type MissionPlanStatus } from "./mission-plan";
import {
  MissionRevisionConflictError,
  type ApproveMissionRevisionInput,
  type CreateMissionInput,
  type CreateMissionRevisionInput,
  type LinkMissionExecutionInput,
  type MissionExecutionLinkRecord,
  type MissionExecutionStatus,
  type MissionPlanRevisionRecord,
  type MissionRecord,
  type MissionRepository,
} from "./mission-repository";

function clonePlan<T>(value: T): T {
  return structuredClone(value);
}

function validateInputPlanMissionId(input: CreateMissionInput | CreateMissionRevisionInput): ReturnType<typeof validateMissionPlan> {
  const plan = validateMissionPlan(clonePlan(input.plan));
  if (plan.missionId !== input.missionId) {
    throw new Error(
      `Mission plan missionId ${plan.missionId} does not match input missionId ${input.missionId}.`,
    );
  }
  return plan;
}

function validateMissionHeaderMatchesPlan(input: CreateMissionInput, plan: ReturnType<typeof validateMissionPlan>): void {
  if (input.title !== plan.title) {
    throw new Error(`Mission header title ${input.title} does not match plan title ${plan.title}.`);
  }
  if (input.userGoal !== plan.userGoal) {
    throw new Error(`Mission header userGoal ${input.userGoal} does not match plan userGoal ${plan.userGoal}.`);
  }
  if (input.riskLevel !== plan.riskLevel) {
    throw new Error(
      `Mission header riskLevel ${input.riskLevel} does not match plan riskLevel ${plan.riskLevel}.`,
    );
  }
}

function missionPlanWithStatus(
  plan: ReturnType<typeof validateMissionPlan>,
  missionStatus: MissionPlanStatus,
): ReturnType<typeof validateMissionPlan> {
  return {
    ...plan,
    status: missionStatus,
  };
}

function normalizeMission(input: CreateMissionInput, now: Date): MissionRecord {
  return {
    missionId: input.missionId,
    title: input.title,
    userGoal: input.userGoal,
    status: input.status ?? "needs_confirmation",
    riskLevel: input.riskLevel,
    approvedAt: null,
    approvedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

function cloneMission(mission: MissionRecord): MissionRecord {
  return {
    ...mission,
    approvedAt: mission.approvedAt ? new Date(mission.approvedAt) : null,
    createdAt: new Date(mission.createdAt),
    updatedAt: new Date(mission.updatedAt),
  };
}

function cloneRevision(revision: MissionPlanRevisionRecord): MissionPlanRevisionRecord {
  return {
    ...revision,
    plan: clonePlan(revision.plan),
    createdAt: new Date(revision.createdAt),
  };
}

function cloneExecutionLink(link: MissionExecutionLinkRecord): MissionExecutionLinkRecord {
  return {
    ...link,
    executedAt: link.executedAt ? new Date(link.executedAt) : null,
  };
}

export class InMemoryMissionRepository implements MissionRepository {
  private readonly missions = new Map<string, MissionRecord>();
  private readonly revisionsByMission = new Map<string, MissionPlanRevisionRecord[]>();
  private readonly revisionsById = new Map<string, MissionPlanRevisionRecord>();
  private readonly executionLinks = new Map<string, MissionExecutionLinkRecord>();

  async createMission(input: CreateMissionInput): Promise<{
    mission: MissionRecord;
    revision: MissionPlanRevisionRecord;
  }> {
    const now = new Date();
    const plan = validateInputPlanMissionId(input);
    validateMissionHeaderMatchesPlan(input, plan);
    if (this.missions.has(input.missionId)) {
      throw new Error(`Mission already exists: ${input.missionId}`);
    }
    const mission = normalizeMission(input, now);
    const revision = this.createRevisionRecord(
      {
        missionId: input.missionId,
        plan: missionPlanWithStatus(plan, "needs_confirmation"),
      },
      1,
      now,
      "draft",
      "needs_confirmation",
    );

    this.missions.set(mission.missionId, mission);
    this.revisionsByMission.set(mission.missionId, [revision]);
    this.revisionsById.set(revision.revisionId, revision);

    return {
      mission: cloneMission(mission),
      revision: cloneRevision(revision),
    };
  }

  async createRevision(input: CreateMissionRevisionInput): Promise<MissionPlanRevisionRecord> {
    const plan = validateInputPlanMissionId(input);
    const mission = this.missions.get(input.missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${input.missionId}`);
    }

    const revisions = this.revisionsByMission.get(input.missionId) ?? [];
    const nextRevisionNumber = (revisions.at(-1)?.revisionNumber ?? 0) + 1;
    const now = new Date();

    for (const revision of revisions) {
      if (revision.status === "draft") {
        revision.status = "superseded";
      }
    }

    const revisionPlan = missionPlanWithStatus(plan, "needs_confirmation");
    const nextRevision = this.createRevisionRecord(
      {
        missionId: input.missionId,
        plan: revisionPlan,
      },
      nextRevisionNumber,
      now,
      "draft",
    );
    revisions.push(nextRevision);
    this.revisionsByMission.set(input.missionId, revisions);

    this.revisionsById.set(nextRevision.revisionId, nextRevision);

    mission.status = "needs_confirmation";
    mission.title = revisionPlan.title;
    mission.userGoal = revisionPlan.userGoal;
    mission.riskLevel = revisionPlan.riskLevel;
    mission.approvedAt = null;
    mission.approvedBy = null;
    mission.updatedAt = now;

    return cloneRevision(nextRevision);
  }

  async approveRevision(input: ApproveMissionRevisionInput): Promise<{
    mission: MissionRecord;
    revision: MissionPlanRevisionRecord;
  }> {
    const mission = this.missions.get(input.missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${input.missionId}`);
    }

    const revisions = this.revisionsByMission.get(input.missionId) ?? [];
    const latestRevision = revisions.at(-1);
    const targetRevision = this.revisionsById.get(input.revisionId);

    if (!latestRevision || !targetRevision || targetRevision.missionId !== input.missionId) {
      throw new Error(`Mission revision not found: ${input.revisionId}`);
    }

    if (
      latestRevision.revisionId !== input.revisionId ||
      targetRevision.status !== "draft" ||
      latestRevision.status !== "draft"
    ) {
      throw new MissionRevisionConflictError(
        `Only the latest draft revision can be approved for mission ${input.missionId}.`,
      );
    }

    const approvedAt = input.approvedAt ?? new Date();
    targetRevision.plan = missionPlanWithStatus(targetRevision.plan, "approved");
    targetRevision.status = "approved";
    mission.status = "approved";
    mission.title = targetRevision.plan.title;
    mission.userGoal = targetRevision.plan.userGoal;
    mission.riskLevel = targetRevision.plan.riskLevel;
    mission.approvedAt = approvedAt;
    mission.approvedBy = input.approvedBy ?? null;
    mission.updatedAt = approvedAt;

    return {
      mission: cloneMission(mission),
      revision: cloneRevision(targetRevision),
    };
  }

  async linkExecution(input: LinkMissionExecutionInput): Promise<MissionExecutionLinkRecord> {
    const mission = this.missions.get(input.missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${input.missionId}`);
    }

    const revision = this.revisionsById.get(input.revisionId);
    if (!revision || revision.missionId !== input.missionId) {
      throw new Error(`Mission revision not found: ${input.revisionId}`);
    }

    const link: MissionExecutionLinkRecord = {
      missionId: input.missionId,
      revisionId: input.revisionId,
      threadId: input.threadId ?? null,
      pipelineRunId: input.pipelineRunId ?? null,
      sourceAgentRunId: input.sourceAgentRunId ?? null,
      executedAt: input.executedAt ?? null,
    };
    const executionStatus = input.status ?? "executing";

    this.executionLinks.set(`${input.missionId}:${input.revisionId}`, link);
    this.applyExecutionStatus(mission, revision, executionStatus, input.executedAt ?? new Date());

    return cloneExecutionLink(link);
  }

  async findExecutionLink(
    missionId: string,
    revisionId: string,
  ): Promise<MissionExecutionLinkRecord | null> {
    const link = this.executionLinks.get(`${missionId}:${revisionId}`);
    return link ? cloneExecutionLink(link) : null;
  }

  async updateExecutionStatus(input: {
    missionId: string;
    revisionId: string;
    status: MissionExecutionStatus;
    updatedAt?: Date;
  }): Promise<{
    mission: MissionRecord;
    revision: MissionPlanRevisionRecord;
  }> {
    const mission = this.missions.get(input.missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${input.missionId}`);
    }

    const revision = this.revisionsById.get(input.revisionId);
    if (!revision || revision.missionId !== input.missionId) {
      throw new Error(`Mission revision not found: ${input.revisionId}`);
    }

    this.applyExecutionStatus(mission, revision, input.status, input.updatedAt ?? new Date());
    return {
      mission: cloneMission(mission),
      revision: cloneRevision(revision),
    };
  }

  private applyExecutionStatus(
    mission: MissionRecord,
    revision: MissionPlanRevisionRecord,
    status: MissionExecutionStatus,
    updatedAt: Date,
  ): void {
    revision.status = "executed";
    revision.plan = missionPlanWithStatus(revision.plan, status);
    mission.status = status;
    mission.updatedAt = updatedAt;
  }

  async findMission(missionId: string): Promise<MissionRecord | null> {
    const mission = this.missions.get(missionId);
    return mission ? cloneMission(mission) : null;
  }

  async findRevision(revisionId: string): Promise<MissionPlanRevisionRecord | null> {
    const revision = this.revisionsById.get(revisionId);
    return revision ? cloneRevision(revision) : null;
  }

  async findLatestRevision(missionId: string): Promise<MissionPlanRevisionRecord | null> {
    const revision = this.revisionsByMission.get(missionId)?.at(-1);
    return revision ? cloneRevision(revision) : null;
  }

  async listRevisions(missionId: string): Promise<MissionPlanRevisionRecord[]> {
    return [...(this.revisionsByMission.get(missionId) ?? [])]
      .sort((left, right) => right.revisionNumber - left.revisionNumber)
      .map(cloneRevision);
  }

  private createRevisionRecord(
    input: CreateMissionRevisionInput,
    revisionNumber: number,
    now: Date,
    revisionStatus: "draft" | "approved" | "superseded" = "draft",
    planStatus: MissionPlanStatus = "needs_confirmation",
  ): MissionPlanRevisionRecord {
    const plan = missionPlanWithStatus(validateMissionPlan(clonePlan(input.plan)), planStatus);

    return {
      revisionId: randomUUID(),
      missionId: input.missionId,
      revisionNumber,
      status: revisionStatus,
      plan,
      createdAt: now,
    };
  }
}
