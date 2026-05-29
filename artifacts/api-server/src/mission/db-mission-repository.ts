import { and, desc, eq } from "drizzle-orm";
import {
  db,
  missionExecutionLinksTable,
  missionPlanRevisionsTable,
  missionsTable,
} from "@workspace/db";

import { validateMissionPlan, type MissionPlan } from "./mission-plan";
import {
  MissionRevisionConflictError,
  type ApproveMissionRevisionInput,
  type CreateMissionInput,
  type CreateMissionRevisionInput,
  type LinkMissionExecutionInput,
  type MissionExecutionLinkRecord,
  type MissionPlanRevisionRecord,
  type MissionRecord,
  type MissionRepository,
} from "./mission-repository";

type MissionRow = typeof missionsTable.$inferSelect;
type MissionPlanRevisionRow = typeof missionPlanRevisionsTable.$inferSelect;
type MissionExecutionLinkRow = typeof missionExecutionLinksTable.$inferSelect;

function firstOrThrow<T>(rows: T[], label: string): T {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label} query did not return a row`);
  }
  return row;
}

function mapMission(row: MissionRow): MissionRecord {
  return {
    missionId: row.missionId,
    title: row.title,
    userGoal: row.userGoal,
    status: row.status,
    riskLevel: row.riskLevel,
    approvedAt: row.approvedAt,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function missionPlanToJson(plan: MissionPlan): Record<string, unknown> {
  return structuredClone(plan) as unknown as Record<string, unknown>;
}

function jsonToMissionPlan(value: Record<string, unknown>): MissionPlan {
  return validateMissionPlan(structuredClone(value) as unknown as MissionPlan);
}

function withMissionPlanStatus(plan: MissionPlan, status: MissionPlan["status"]): MissionPlan {
  return {
    ...plan,
    status,
  };
}

function validateInputPlanMissionId(plan: MissionPlan, missionId: string): MissionPlan {
  const validated = validateMissionPlan(structuredClone(plan));
  if (validated.missionId !== missionId) {
    throw new Error(
      `Mission plan missionId ${validated.missionId} does not match input missionId ${missionId}.`,
    );
  }
  return validated;
}

function mapRevision(row: MissionPlanRevisionRow): MissionPlanRevisionRecord {
  return {
    revisionId: row.revisionId,
    missionId: row.missionId,
    revisionNumber: row.revisionNumber,
    status: row.status,
    plan: jsonToMissionPlan(row.planJson),
    createdAt: row.createdAt,
  };
}

function mapExecutionLink(row: MissionExecutionLinkRow): MissionExecutionLinkRecord {
  return {
    missionId: row.missionId,
    revisionId: row.revisionId,
    threadId: row.threadId,
    pipelineRunId: row.pipelineRunId,
    sourceAgentRunId: row.sourceAgentRunId,
    executedAt: row.executedAt,
  };
}

export class DbMissionRepository implements MissionRepository {
  async createMission(input: CreateMissionInput): Promise<{
    mission: MissionRecord;
    revision: MissionPlanRevisionRecord;
  }> {
    const plan = validateInputPlanMissionId(input.plan, input.missionId);
    if (plan.title !== input.title) {
      throw new Error(`Mission header title ${input.title} does not match plan title ${plan.title}.`);
    }
    if (plan.userGoal !== input.userGoal) {
      throw new Error(`Mission header userGoal ${input.userGoal} does not match plan userGoal ${plan.userGoal}.`);
    }
    if (plan.riskLevel !== input.riskLevel) {
      throw new Error(
        `Mission header riskLevel ${input.riskLevel} does not match plan riskLevel ${plan.riskLevel}.`,
      );
    }

    return db.transaction(async (tx) => {
      const missionRows = await tx
        .insert(missionsTable)
        .values({
          missionId: input.missionId,
          title: plan.title,
          userGoal: plan.userGoal,
          status: input.status ?? "draft",
          riskLevel: plan.riskLevel,
        })
        .returning();

      const revisionRows = await tx
        .insert(missionPlanRevisionsTable)
        .values({
          missionId: input.missionId,
          revisionNumber: 1,
          status: "draft",
          planJson: missionPlanToJson(withMissionPlanStatus(plan, input.status ?? "draft")),
        })
        .returning();

      return {
        mission: mapMission(firstOrThrow(missionRows, "mission create")),
        revision: mapRevision(firstOrThrow(revisionRows, "mission revision create")),
      };
    });
  }

  async createRevision(input: CreateMissionRevisionInput): Promise<MissionPlanRevisionRecord> {
    const plan = validateInputPlanMissionId(input.plan, input.missionId);

    return db.transaction(async (tx) => {
      const missionRows = await tx
        .select()
        .from(missionsTable)
        .where(eq(missionsTable.missionId, input.missionId))
        .for("update")
        .limit(1);
      if (!missionRows[0]) {
        throw new Error(`Mission not found: ${input.missionId}`);
      }

      const latestRevisionRows = await tx
        .select()
        .from(missionPlanRevisionsTable)
        .where(eq(missionPlanRevisionsTable.missionId, input.missionId))
        .orderBy(desc(missionPlanRevisionsTable.revisionNumber))
        .limit(1);
      const nextRevisionNumber = (latestRevisionRows[0]?.revisionNumber ?? 0) + 1;

      await tx
        .update(missionPlanRevisionsTable)
        .set({ status: "superseded" })
        .where(
          and(
            eq(missionPlanRevisionsTable.missionId, input.missionId),
            eq(missionPlanRevisionsTable.status, "draft"),
          ),
        );

      const planToStore = withMissionPlanStatus(plan, "needs_confirmation");

      const revisionRows = await tx
        .insert(missionPlanRevisionsTable)
        .values({
          missionId: input.missionId,
          revisionNumber: nextRevisionNumber,
          status: "draft",
          planJson: missionPlanToJson(planToStore),
        })
        .returning();

      await tx
        .update(missionsTable)
        .set({
          title: planToStore.title,
          userGoal: planToStore.userGoal,
          riskLevel: planToStore.riskLevel,
          status: "needs_confirmation",
          approvedAt: null,
          approvedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(missionsTable.missionId, input.missionId));

      return mapRevision(firstOrThrow(revisionRows, "mission revision create"));
    });
  }

  async approveRevision(input: ApproveMissionRevisionInput): Promise<{
    mission: MissionRecord;
    revision: MissionPlanRevisionRecord;
  }> {
    return db.transaction(async (tx) => {
      const missionRows = await tx
        .select()
        .from(missionsTable)
        .where(eq(missionsTable.missionId, input.missionId))
        .for("update")
        .limit(1);
      if (!missionRows[0]) {
        throw new Error(`Mission not found: ${input.missionId}`);
      }

      const latestRevisionRows = await tx
        .select()
        .from(missionPlanRevisionsTable)
        .where(eq(missionPlanRevisionsTable.missionId, input.missionId))
        .orderBy(desc(missionPlanRevisionsTable.revisionNumber))
        .limit(1);
      const latestRevision = latestRevisionRows[0];

      const targetRevisionRows = await tx
        .select()
        .from(missionPlanRevisionsTable)
        .where(
          and(
            eq(missionPlanRevisionsTable.missionId, input.missionId),
            eq(missionPlanRevisionsTable.revisionId, input.revisionId),
          ),
        )
        .limit(1);
      const targetRevision = targetRevisionRows[0];

      if (!latestRevision || !targetRevision) {
        throw new Error(`Mission revision not found: ${input.revisionId}`);
      }

      if (
        latestRevision.revisionId !== input.revisionId ||
        latestRevision.status !== "draft" ||
        targetRevision.status !== "draft"
      ) {
        throw new MissionRevisionConflictError(
          `Only the latest draft revision can be approved for mission ${input.missionId}.`,
        );
      }

      const approvedAt = input.approvedAt ?? new Date();
      const approvedPlan = withMissionPlanStatus(
        jsonToMissionPlan(targetRevision.planJson),
        "approved",
      );
      const updatedRevisionRows = await tx
        .update(missionPlanRevisionsTable)
        .set({
          status: "approved",
          planJson: missionPlanToJson(approvedPlan),
        })
        .where(
          and(
            eq(missionPlanRevisionsTable.missionId, input.missionId),
            eq(missionPlanRevisionsTable.revisionId, input.revisionId),
            eq(missionPlanRevisionsTable.revisionNumber, latestRevision.revisionNumber),
            eq(missionPlanRevisionsTable.status, "draft"),
          ),
        )
        .returning();
      const updatedRevision = updatedRevisionRows[0];
      if (!updatedRevision) {
        throw new MissionRevisionConflictError(
          `Only the latest draft revision can be approved for mission ${input.missionId}.`,
        );
      }

      const updatedMissionRows = await tx
        .update(missionsTable)
        .set({
          status: "approved",
          title: approvedPlan.title,
          userGoal: approvedPlan.userGoal,
          riskLevel: approvedPlan.riskLevel,
          approvedAt,
          approvedBy: input.approvedBy ?? null,
          updatedAt: approvedAt,
        })
        .where(eq(missionsTable.missionId, input.missionId))
        .returning();


      return {
        mission: mapMission(firstOrThrow(updatedMissionRows, "mission approve")),
        revision: mapRevision(updatedRevision),
      };
    });
  }

  async linkExecution(input: LinkMissionExecutionInput): Promise<MissionExecutionLinkRecord> {
    return db.transaction(async (tx) => {
      const revisionRows = await tx
        .select()
        .from(missionPlanRevisionsTable)
        .where(
          and(
            eq(missionPlanRevisionsTable.missionId, input.missionId),
            eq(missionPlanRevisionsTable.revisionId, input.revisionId),
          ),
        )
        .limit(1);
      if (!revisionRows[0]) {
        throw new Error(`Mission revision not found: ${input.revisionId}`);
      }

      const linkRows = await tx
        .insert(missionExecutionLinksTable)
        .values({
          missionId: input.missionId,
          revisionId: input.revisionId,
          threadId: input.threadId ?? null,
          pipelineRunId: input.pipelineRunId ?? null,
          sourceAgentRunId: input.sourceAgentRunId ?? null,
          executedAt: input.executedAt ?? null,
        })
        .onConflictDoUpdate({
          target: [
            missionExecutionLinksTable.missionId,
            missionExecutionLinksTable.revisionId,
          ],
          set: {
            threadId: input.threadId ?? null,
            pipelineRunId: input.pipelineRunId ?? null,
            sourceAgentRunId: input.sourceAgentRunId ?? null,
            executedAt: input.executedAt ?? null,
          },
        })
        .returning();

      await tx
        .update(missionsTable)
        .set({ updatedAt: new Date() })
        .where(eq(missionsTable.missionId, input.missionId));

      return mapExecutionLink(firstOrThrow(linkRows, "mission execution link"));
    });
  }

  async findMission(missionId: string): Promise<MissionRecord | null> {
    const rows = await db
      .select()
      .from(missionsTable)
      .where(eq(missionsTable.missionId, missionId))
      .limit(1);

    return rows[0] ? mapMission(rows[0]) : null;
  }

  async findRevision(revisionId: string): Promise<MissionPlanRevisionRecord | null> {
    const rows = await db
      .select()
      .from(missionPlanRevisionsTable)
      .where(eq(missionPlanRevisionsTable.revisionId, revisionId))
      .limit(1);

    return rows[0] ? mapRevision(rows[0]) : null;
  }

  async findLatestRevision(missionId: string): Promise<MissionPlanRevisionRecord | null> {
    const rows = await db
      .select()
      .from(missionPlanRevisionsTable)
      .where(eq(missionPlanRevisionsTable.missionId, missionId))
      .orderBy(desc(missionPlanRevisionsTable.revisionNumber))
      .limit(1);

    return rows[0] ? mapRevision(rows[0]) : null;
  }

  async listRevisions(missionId: string): Promise<MissionPlanRevisionRecord[]> {
    const rows = await db
      .select()
      .from(missionPlanRevisionsTable)
      .where(eq(missionPlanRevisionsTable.missionId, missionId))
      .orderBy(desc(missionPlanRevisionsTable.revisionNumber));

    return rows.map(mapRevision);
  }
}
