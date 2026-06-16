import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { DbMissionRepository } from "./db-mission-repository";
import type { MissionPlan } from "./mission-plan";
import { InMemoryMissionRepository } from "./in-memory-mission-repository";
import { MissionRevisionConflictError, type MissionRepository } from "./mission-repository";

function createPlan(overrides: Partial<MissionPlan> = {}): MissionPlan {
  const missionId = overrides.missionId ?? "mission-alpha";
  return {
    missionId,
    title: overrides.title ?? "Launch mission persistence",
    userGoal: overrides.userGoal ?? "Ship mission persistence foundation safely.",
    summary: overrides.summary ?? "Plan the work and approve the latest revision.",
    status: overrides.status ?? "needs_confirmation",
    riskLevel: overrides.riskLevel ?? "medium",
    steps:
      overrides.steps ??
      [
        {
          stepId: "draft-plan",
          title: "Draft plan",
          objective: "Create the initial mission plan.",
          dependsOn: [],
          status: "pending",
          role: "executor",
        },
      ],
    warnings: overrides.warnings ?? [],
    nonGoals: overrides.nonGoals ?? [],
    activationProfile: overrides.activationProfile ?? {
      level: "micro",
      reviewIntensity: "medium",
    },
  };
}

test("DB repository implements the mission repository contract surface", () => {
  const repository = null as unknown as DbMissionRepository;
  const contractRepository: MissionRepository = repository;
  assert.equal(contractRepository, repository);
});

async function resetMissionTables(pool: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    DROP TABLE IF EXISTS mission_execution_links CASCADE;
    DROP TABLE IF EXISTS mission_plan_revisions CASCADE;
    DROP TABLE IF EXISTS missions CASCADE;
    DROP TYPE IF EXISTS mission_plan_revision_status CASCADE;
    DROP TYPE IF EXISTS mission_risk_level CASCADE;
    DROP TYPE IF EXISTS mission_status CASCADE;
    CREATE TABLE IF NOT EXISTS agent_threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE IF NOT EXISTS pipeline_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);

  const migrationSql = await readFile(
    new URL("../../../../lib/db/migrations/20260529_add_missions.sql", import.meta.url),
    "utf8",
  );
  await pool.query(migrationSql);
}

test(
  "DB repository rejects stale revision approval and approves the latest draft",
  { skip: !process.env["TEST_DATABASE_URL"] && "set TEST_DATABASE_URL to run DB mission repository regressions" },
  async () => {
    const originalDatabaseUrl = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = process.env["TEST_DATABASE_URL"];

    const [{ DbMissionRepository }, { pool }] = await Promise.all([
      import("./db-mission-repository"),
      import("@workspace/db"),
    ]);
    await resetMissionTables(pool);

    try {
      const repository = new DbMissionRepository();
      const firstPlan = createPlan({ missionId: "db-mission-stale-approve" });
      const created = await repository.createMission({
        missionId: firstPlan.missionId,
        title: firstPlan.title,
        userGoal: firstPlan.userGoal,
        status: "needs_confirmation",
        riskLevel: firstPlan.riskLevel,
        plan: firstPlan,
      });

      const secondPlan = createPlan({
        missionId: firstPlan.missionId,
        title: "DB revised title",
        userGoal: "DB revised user goal for synced metadata checks.",
        summary: "A newer persisted plan requiring approval.",
        riskLevel: "high",
        steps: [
          {
            stepId: "draft-plan",
            title: "Draft plan",
            objective: "Create the initial mission plan.",
            dependsOn: [],
            status: "pending",
          },
          {
            stepId: "approve-plan",
            title: "Approve persisted plan",
            objective: "Approve only the newest persisted draft revision.",
            dependsOn: ["draft-plan"],
            status: "waiting_approval",
            approval: {
              required: true,
              reason: "This revision changes persisted execution sequencing.",
              riskLevel: "high",
            },
          },
        ],
      });
      const latestRevision = await repository.createRevision({
        missionId: firstPlan.missionId,
        plan: secondPlan,
      });

      await assert.rejects(
        repository.createRevision({
          missionId: firstPlan.missionId,
          plan: createPlan({ missionId: "db-mismatched-plan-id" }),
        }),
        /does not match input missionId/,
      );

      await assert.rejects(
        repository.approveRevision({
          missionId: firstPlan.missionId,
          revisionId: created.revision.revisionId,
          approvedBy: "boss-agent",
        }),
        (error) => {
          assert.ok(error instanceof MissionRevisionConflictError);
          assert.equal(error.statusCode, 409);
          return true;
        },
      );

      const approved = await repository.approveRevision({
        missionId: firstPlan.missionId,
        revisionId: latestRevision.revisionId,
        approvedBy: "boss-agent",
        approvedAt: new Date("2026-05-29T12:00:00.000Z"),
      });

      assert.equal(approved.revision.revisionId, latestRevision.revisionId);
      assert.equal(approved.revision.status, "approved");
      assert.equal(approved.mission.status, "approved");
      assert.equal(approved.mission.title, secondPlan.title);
      assert.equal(approved.mission.userGoal, secondPlan.userGoal);
      assert.equal(approved.mission.riskLevel, secondPlan.riskLevel);
      assert.equal(approved.mission.approvedBy, "boss-agent");
      assert.equal(approved.revision.status, "approved");
      assert.equal(approved.revision.plan.status, "approved");
      assert.deepEqual(approved.revision.plan, {
        ...secondPlan,
        status: "approved",
      });

      await repository.createRevision({
        missionId: firstPlan.missionId,
        plan: createPlan({
          missionId: firstPlan.missionId,
          title: "DB post-approval draft title",
          userGoal: "DB verifies metadata sync after post-approval revision.",
          riskLevel: "high",
          summary: "A post-approval draft must require a fresh approval.",
        }),
      });
      const revisedMission = await repository.findMission(firstPlan.missionId);
      assert.equal(revisedMission?.status, "needs_confirmation");
      assert.equal(revisedMission?.title, "DB post-approval draft title");
      assert.equal(revisedMission?.userGoal, "DB verifies metadata sync after post-approval revision.");
      assert.equal(revisedMission?.riskLevel, "high");
      assert.equal(revisedMission?.approvedAt, null);
      assert.equal(revisedMission?.approvedBy, null);
    } finally {
      if (originalDatabaseUrl === undefined) {
        delete process.env["DATABASE_URL"];
      } else {
        process.env["DATABASE_URL"] = originalDatabaseUrl;
      }
      await pool.end();
    }
  },
);

test("rejects mission plans whose embedded missionId differs from input missionId", async () => {
  const repository = new InMemoryMissionRepository();
  const plan = createPlan({ missionId: "mission-input-id" });

  await assert.rejects(
    repository.createMission({
      missionId: plan.missionId,
      title: plan.title,
      userGoal: plan.userGoal,
      status: "needs_confirmation",
      riskLevel: plan.riskLevel,
      plan: createPlan({ missionId: "mission-plan-id" }),
    }),
    /does not match input missionId/,
  );

  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    status: "needs_confirmation",
    riskLevel: plan.riskLevel,
    plan,
  });
  assert.equal(created.revision.plan.missionId, plan.missionId);

  await assert.rejects(
    repository.createRevision({
      missionId: plan.missionId,
      plan: createPlan({ missionId: "mission-other-plan-id" }),
    }),
    /does not match input missionId/,
  );
});

test("create mission stores mission and first revision", async () => {
  const repository = new InMemoryMissionRepository();
  const plan = createPlan();

  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    status: "needs_confirmation",
    riskLevel: plan.riskLevel,
    plan,
  });

  assert.equal(created.mission.missionId, plan.missionId);
  assert.equal(created.mission.status, "needs_confirmation");
  assert.equal(created.revision.missionId, plan.missionId);
  assert.equal(created.revision.revisionNumber, 1);
  assert.equal(created.revision.status, "draft");
  assert.equal(created.revision.plan.status, "needs_confirmation");
  assert.deepEqual(created.revision.plan, {
    ...plan,
    status: "needs_confirmation",
  });

  const latest = await repository.findLatestRevision(plan.missionId);
  assert.equal(latest?.revisionId, created.revision.revisionId);
});

test("create second revision supersedes the old draft and becomes latest", async () => {
  const repository = new InMemoryMissionRepository();
  const firstPlan = createPlan();
  const created = await repository.createMission({
    missionId: firstPlan.missionId,
    title: firstPlan.title,
    userGoal: firstPlan.userGoal,
    status: "needs_confirmation",
    riskLevel: firstPlan.riskLevel,
    plan: firstPlan,
  });

  const secondPlan = createPlan({
    missionId: firstPlan.missionId,
    title: "Revised mission metadata",
    userGoal: "Validate metadata sync across mission row and revision row after edits.",
    summary: "A revised plan with an extra approval step.",
    steps: [
      {
        stepId: "draft-plan",
        title: "Draft plan",
        objective: "Create the initial mission plan.",
        dependsOn: [],
        status: "pending",
      },
      {
        stepId: "human-approval",
        title: "Human approval",
        objective: "Approve the latest revision.",
        dependsOn: ["draft-plan"],
        status: "waiting_approval",
        approval: {
          required: true,
          reason: "Review the revised execution path.",
          riskLevel: "high",
        },
      },
    ],
    riskLevel: "high",
  });

  const secondRevision = await repository.createRevision({
    missionId: firstPlan.missionId,
    plan: secondPlan,
  });

  assert.equal(secondRevision.revisionNumber, 2);
  assert.equal(secondRevision.status, "draft");
  assert.equal(secondRevision.plan.status, "needs_confirmation");

  const mission = await repository.findMission(firstPlan.missionId);
  assert.equal(mission?.status, "needs_confirmation");
  assert.equal(mission?.title, secondPlan.title);
  assert.equal(mission?.userGoal, secondPlan.userGoal);
  assert.equal(mission?.riskLevel, secondPlan.riskLevel);

  const revisions = await repository.listRevisions(firstPlan.missionId);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0]?.revisionId, secondRevision.revisionId);
  assert.equal(revisions[0]?.status, "draft");
  assert.equal(revisions[1]?.revisionId, created.revision.revisionId);
  assert.equal(revisions[1]?.status, "superseded");
});

test("approve latest revision succeeds", async () => {
  const repository = new InMemoryMissionRepository();
  const plan = createPlan();
  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    status: "needs_confirmation",
    riskLevel: plan.riskLevel,
    plan,
  });

  const approved = await repository.approveRevision({
    missionId: plan.missionId,
    revisionId: created.revision.revisionId,
    approvedBy: "boss-agent",
  });

  assert.equal(approved.mission.status, "approved");
  assert.equal(approved.mission.title, plan.title);
  assert.equal(approved.mission.userGoal, plan.userGoal);
  assert.equal(approved.mission.riskLevel, plan.riskLevel);
  assert.equal(approved.mission.approvedBy, "boss-agent");
  assert.ok(approved.mission.approvedAt instanceof Date);
  assert.equal(approved.revision.status, "approved");
  assert.equal(approved.revision.plan.status, "approved");
});

test("creating a new revision after approval clears mission approval state", async () => {
  const repository = new InMemoryMissionRepository();
  const plan = createPlan({ missionId: "mission-reset-approval" });
  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    status: "needs_confirmation",
    riskLevel: plan.riskLevel,
    plan,
  });
  await repository.approveRevision({
    missionId: plan.missionId,
    revisionId: created.revision.revisionId,
    approvedBy: "boss-agent",
    approvedAt: new Date("2026-05-29T12:00:00.000Z"),
  });

  await repository.createRevision({
    missionId: plan.missionId,
    plan: createPlan({
      missionId: plan.missionId,
      title: "Revised approved mission",
      userGoal: "Keep mission title/userGoal in sync after new draft.",
      riskLevel: "high",
      summary: "The approved mission has a new draft revision.",
    }),
  });

  const mission = await repository.findMission(plan.missionId);
  assert.equal(mission?.status, "needs_confirmation");
  assert.equal(mission?.title, "Revised approved mission");
  assert.equal(mission?.userGoal, "Keep mission title/userGoal in sync after new draft.");
  assert.equal(mission?.riskLevel, "high");
  assert.equal(mission?.approvedAt, null);
  assert.equal(mission?.approvedBy, null);
});

test("approving a stale revision returns a conflict error", async () => {
  const repository = new InMemoryMissionRepository();
  const firstPlan = createPlan();
  const created = await repository.createMission({
    missionId: firstPlan.missionId,
    title: firstPlan.title,
    userGoal: firstPlan.userGoal,
    status: "needs_confirmation",
    riskLevel: firstPlan.riskLevel,
    plan: firstPlan,
  });

  const secondPlan = createPlan({
    summary: "Newer plan",
    steps: [
      {
        stepId: "draft-plan",
        title: "Draft plan",
        objective: "Create the initial mission plan.",
        dependsOn: [],
        status: "pending",
      },
      {
        stepId: "approve-plan",
        title: "Approve plan",
        objective: "Approve the revision before execution.",
        dependsOn: ["draft-plan"],
        status: "waiting_approval",
        approval: {
          required: true,
          reason: "This revision updates execution sequencing.",
          riskLevel: "high",
        },
      },
    ],
    riskLevel: "high",
  });
  await repository.createRevision({ missionId: firstPlan.missionId, plan: secondPlan });

  await assert.rejects(
    repository.approveRevision({
      missionId: firstPlan.missionId,
      revisionId: created.revision.revisionId,
      approvedBy: "boss-agent",
    }),
    (error) => {
      assert.ok(error instanceof MissionRevisionConflictError);
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test("link mission execution to a pipeline run", async () => {
  const repository = new InMemoryMissionRepository();
  const plan = createPlan();
  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    status: "needs_confirmation",
    riskLevel: plan.riskLevel,
    plan,
  });

  const link = await repository.linkExecution({
    missionId: plan.missionId,
    revisionId: created.revision.revisionId,
    pipelineRunId: "11111111-1111-4111-8111-111111111111",
    threadId: "22222222-2222-4222-8222-222222222222",
    sourceAgentRunId: "agent-run-42",
    executedAt: new Date("2026-05-29T12:00:00.000Z"),
  });

  assert.deepEqual(link, {
    missionId: plan.missionId,
    revisionId: created.revision.revisionId,
    pipelineRunId: "11111111-1111-4111-8111-111111111111",
    threadId: "22222222-2222-4222-8222-222222222222",
    sourceAgentRunId: "agent-run-42",
    executedAt: new Date("2026-05-29T12:00:00.000Z"),
  });
});

test("create mission without explicit status defaults to needs_confirmation for both mission and plan", async () => {
  const repository = new InMemoryMissionRepository();
  const plan = createPlan({ missionId: "mission-no-status" });

  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    riskLevel: plan.riskLevel,
    plan,
  });

  assert.equal(created.mission.status, "needs_confirmation");
  assert.equal(created.revision.status, "draft");
  assert.equal(created.revision.plan.status, "needs_confirmation");
});

test("create mission with any explicit status always sets the initial revision plan status to needs_confirmation", async () => {
  const repository = new InMemoryMissionRepository();
  const plan = createPlan({ missionId: "mission-explicit-status" });

  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    riskLevel: plan.riskLevel,
    status: "draft",
    plan,
  });

  assert.equal(created.revision.status, "draft");
  assert.equal(created.revision.plan.status, "needs_confirmation");
});
