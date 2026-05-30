import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryAgentRuntimeRepository,
  type AgentRuntimeRepository,
  type PipelineRunRecord,
} from "../agent-runtime/agent-runtime-service";
import {
  createModuleRun,
  getMetadataWithInteraction,
  recordModuleRunArtifact,
  recordModuleRunEvent,
  type ModuleRunRecord,
  type RunEventRecord,
  type ToolInteraction,
} from "../modules/ingest-service";
import { validateMissionPlan, type MissionPlan } from "./mission-plan";
import { InMemoryMissionRepository } from "./in-memory-mission-repository";
import { projectExecutionBoard } from "./execution-board";
import type {
  MissionRepository,
  MissionPlanRevisionRecord,
  MissionRecord,
  CreateMissionInput,
  CreateMissionRevisionInput,
  ApproveMissionRevisionInput,
  LinkMissionExecutionInput,
  MissionExecutionLinkRecord,
} from "./mission-repository";

class ExecutionBoardTestRepository
  implements
    MissionRepository,
    Pick<
      AgentRuntimeRepository,
      "listPipelineRuns" | "listModuleRunsByPipelineRunId" | "listRunEvents" | "listRunArtifacts"
    >
{
  readonly mission = new InMemoryMissionRepository();
  readonly runtime = new InMemoryAgentRuntimeRepository();

  createMission(input: CreateMissionInput) {
    return this.mission.createMission(input);
  }

  createRevision(input: CreateMissionRevisionInput) {
    return this.mission.createRevision(input);
  }

  approveRevision(input: ApproveMissionRevisionInput) {
    return this.mission.approveRevision(input);
  }

  linkExecution(input: LinkMissionExecutionInput): Promise<MissionExecutionLinkRecord> {
    return this.mission.linkExecution(input);
  }

  findMission(missionId: string): Promise<MissionRecord | null> {
    return this.mission.findMission(missionId);
  }

  findRevision(revisionId: string): Promise<MissionPlanRevisionRecord | null> {
    return this.mission.findRevision(revisionId);
  }

  findLatestRevision(missionId: string): Promise<MissionPlanRevisionRecord | null> {
    return this.mission.findLatestRevision(missionId);
  }

  listRevisions(missionId: string): Promise<MissionPlanRevisionRecord[]> {
    return this.mission.listRevisions(missionId);
  }

  listPipelineRuns() {
    return this.runtime.listPipelineRuns();
  }

  listModuleRunsByPipelineRunId(pipelineRunId: string) {
    return this.runtime.listModuleRunsByPipelineRunId(pipelineRunId);
  }

  listRunEvents(moduleRunId: string): Promise<RunEventRecord[]> {
    return this.runtime.listRunEvents(moduleRunId);
  }

  listRunArtifacts(moduleRunId: string) {
    return this.runtime.listRunArtifacts(moduleRunId);
  }
}

function createPlan(overrides: Partial<MissionPlan> & { missionId: string }): MissionPlan {
  return validateMissionPlan({
    missionId: overrides.missionId,
    title: overrides.title ?? "Execution board mission",
    userGoal: overrides.userGoal ?? "Track what each agent is doing.",
    summary: overrides.summary ?? "Default mission plan for execution-board tests.",
    status: overrides.status ?? "needs_confirmation",
    riskLevel: overrides.riskLevel ?? "medium",
    steps:
      overrides.steps ??
      [
        {
          stepId: "listen",
          title: "Researcher",
          objective: "Collect source docs.",
          skillId: "web_listening",
          moduleId: "web_listening",
          assignedAgentId: "researcher",
          dependsOn: [],
          status: "pending",
        },
        {
          stepId: "convert",
          title: "Indexer",
          objective: "Convert docs to markdown.",
          skillId: "doc_to_md",
          moduleId: "doc_to_md",
          assignedAgentId: "indexer",
          dependsOn: ["listen"],
          status: "pending",
        },
      ],
    warnings: overrides.warnings ?? [],
    nonGoals: overrides.nonGoals ?? [],
  });
}

async function seedMission(
  repository: ExecutionBoardTestRepository,
  plan: MissionPlan,
  options: { approve?: boolean; execute?: boolean } = {},
) {
  const created = await repository.createMission({
    missionId: plan.missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    status: plan.status,
    riskLevel: plan.riskLevel,
    plan,
  });

  let revision = created.revision;
  if (options.approve || options.execute) {
    const approved = await repository.approveRevision({
      missionId: plan.missionId,
      revisionId: revision.revisionId,
      approvedBy: "tester",
      approvedAt: new Date("2026-05-29T12:00:00.000Z"),
    });
    revision = approved.revision;
  }

  if (options.execute) {
    await repository.linkExecution({
      missionId: plan.missionId,
      revisionId: revision.revisionId,
      pipelineRunId: null,
      sourceAgentRunId: null,
      threadId: null,
      executedAt: new Date("2026-05-29T12:05:00.000Z"),
    });
    revision = (await repository.findRevision(revision.revisionId))!;
  }

  return { mission: created.mission, revision };
}

async function createPipelineRun(repository: ExecutionBoardTestRepository, metadata: Record<string, unknown>) {
  return repository.runtime.createPipelineRun({
    threadId: null,
    title: "Mission runtime",
    status: "pending",
    activeModuleId: null,
    metadata,
  });
}

async function createMissionRun(
  repository: ExecutionBoardTestRepository,
  input: {
    pipelineRun: PipelineRunRecord;
    missionId: string;
    revisionId: string;
    moduleId: "web_listening" | "doc_to_md" | "md_to_rag" | "rag_to_agent";
    skillId: string;
    agentId?: string;
    roleId?: string;
    stepId?: string;
    title: string;
    status?: ModuleRunRecord["status"];
    metadata?: Record<string, unknown>;
  },
): Promise<ModuleRunRecord> {
  const { run } = await createModuleRun(repository.runtime, {
    moduleId: input.moduleId,
    externalRunId: `${input.pipelineRun.id}:${input.stepId ?? input.moduleId}`,
    pipelineRunId: input.pipelineRun.id,
    title: input.title,
    status: input.status ?? "pending",
    registeredSkillIds: [input.skillId, input.moduleId],
    metadata: {
      missionId: input.missionId,
      revisionId: input.revisionId,
      skillId: input.skillId,
      action: `${input.title} action`,
      ...(input.agentId ? { agentId: input.agentId } : {}),
      ...(input.roleId ? { roleId: input.roleId } : {}),
      ...(input.stepId ? { dagStepId: input.stepId } : {}),
      ...(input.metadata ?? {}),
    },
  });
  return run;
}

function approvalInteraction(overrides: Partial<ToolInteraction> = {}): ToolInteraction {
  return {
    interactionId: overrides.interactionId ?? "approval-1",
    status: overrides.status ?? "waiting_for_approval",
    kind: overrides.kind ?? "approval",
    title: overrides.title ?? "Approve publish",
    message: overrides.message ?? "Approve publishing the generated agent.",
    prompt: overrides.prompt ?? null,
    options: overrides.options ?? [],
    artifactIds: overrides.artifactIds ?? [],
    resumeHandle: overrides.resumeHandle ?? null,
    requestedBy: overrides.requestedBy ?? "runtime",
    requestedAt: overrides.requestedAt ?? "2026-05-29T12:10:00.000Z",
    metadata: overrides.metadata ?? { action: "Publish agent", reason: "Needs human approval." },
    ...(overrides.respondedAt ? { respondedAt: overrides.respondedAt } : {}),
    ...(overrides.response ? { response: overrides.response } : {}),
  };
}

test("projects board rows from mission plan and module runs", async () => {
  const repository = new ExecutionBoardTestRepository();
  const plan = createPlan({
    missionId: "mission-board-projection",
    steps: [
      {
        stepId: "listen",
        title: "Researcher",
        objective: "Collect source docs.",
        skillId: "web_listening",
        moduleId: "web_listening",
        assignedAgentId: "researcher",
        dependsOn: [],
        status: "pending",
      },
      {
        stepId: "convert",
        title: "Indexer",
        objective: "Convert docs to markdown.",
        skillId: "doc_to_md",
        moduleId: "doc_to_md",
        assignedAgentId: "indexer",
        dependsOn: ["listen"],
        status: "pending",
      },
    ],
  });
  const { revision } = await seedMission(repository, plan, { approve: true });
  const pipelineRun = await createPipelineRun(repository, {
    missionId: plan.missionId,
    revisionId: revision.revisionId,
  });

  const researcherRun = await createMissionRun(repository, {
    pipelineRun,
    missionId: plan.missionId,
    revisionId: revision.revisionId,
    stepId: "listen",
    moduleId: "web_listening",
    skillId: "web_listening",
    agentId: "researcher",
    title: "Researcher gathering inputs",
    status: "running",
  });
  await recordModuleRunEvent(repository.runtime, researcherRun.id, {
    eventType: "agent.step.started",
    title: "Research started",
    message: "Scanning approved sources.",
  });

  const indexerRun = await createMissionRun(repository, {
    pipelineRun,
    missionId: plan.missionId,
    revisionId: revision.revisionId,
    stepId: "convert",
    moduleId: "doc_to_md",
    skillId: "doc_to_md",
    agentId: "indexer",
    title: "Indexer conversion",
    status: "succeeded",
  });
  await recordModuleRunArtifact(repository.runtime, indexerRun.id, {
    artifactKind: "markdown",
    title: "onboarding.md",
    contentText: "# onboarding",
  });

  const projected = await projectExecutionBoard(repository, plan.missionId);

  assert.equal(projected.revisionId, revision.revisionId);
  assert.equal(projected.board.length, 2);
  const researcher = projected.board.find((item) => item.agentId === "researcher");
  const indexer = projected.board.find((item) => item.agentId === "indexer");
  assert.equal(researcher?.status, "running");
  assert.equal(researcher?.currentAction, "Scanning approved sources.");
  assert.deepEqual(indexer?.latestArtifacts, [
    {
      artifactId: indexer?.latestArtifacts[0]!.artifactId,
      kind: "markdown",
      title: "onboarding.md",
    },
  ]);
  assert.equal(indexer?.status, "succeeded");
});

test("waiting approval state maps from approval projection", async () => {
  const repository = new ExecutionBoardTestRepository();
  const plan = createPlan({
    missionId: "mission-board-approval",
    steps: [
      {
        stepId: "publish",
        title: "Publisher",
        objective: "Publish the generated agent.",
        skillId: "rag_to_agent",
        moduleId: "rag_to_agent",
        roleId: "publisher",
        dependsOn: [],
        status: "waiting_approval",
        approval: {
          required: true,
          reason: "Publishing changes production behavior.",
          riskLevel: "high",
        },
      },
    ],
  });
  const { revision } = await seedMission(repository, plan, { approve: true });
  const pipelineRun = await createPipelineRun(repository, {
    missionId: plan.missionId,
    revisionId: revision.revisionId,
  });

  const pendingRun = await createMissionRun(repository, {
    pipelineRun,
    missionId: plan.missionId,
    revisionId: revision.revisionId,
    stepId: "publish",
    moduleId: "rag_to_agent",
    skillId: "rag_to_agent",
    roleId: "publisher",
    title: "Publisher waiting approval",
    metadata: {
      approvalId: "approval-publish",
      approvalReason: "Publishing changes production behavior.",
      adapterExecutionStatus: "approval_required",
      interaction: approvalInteraction({
        interactionId: "approval-publish",
        metadata: {
          action: "Publish onboarding agent",
          reason: "Publishing changes production behavior.",
          stepId: "publish",
        },
      }),
    },
  });
  await recordModuleRunEvent(repository.runtime, pendingRun.id, {
    eventType: "tool.execution.approval_required",
    title: "Approval required",
    message: "Waiting for explicit approval.",
  });

  const projected = await projectExecutionBoard(repository, plan.missionId);
  assert.equal(projected.board.length, 1);
  assert.equal(projected.board[0]?.status, "waiting_approval");
  assert.equal(projected.board[0]?.currentAction, "Publish onboarding agent");
  assert.equal(
    projected.board[0]?.blockingReason,
    "Publishing changes production behavior.",
  );
});

test("blocked reason prefers approval or blocked interaction over generic error events", async () => {
  const repository = new ExecutionBoardTestRepository();
  const plan = createPlan({
    missionId: "mission-board-blocked",
    steps: [
      {
        stepId: "convert",
        title: "Converter",
        objective: "Convert docs.",
        skillId: "doc_to_md",
        moduleId: "doc_to_md",
        assignedAgentId: "converter",
        dependsOn: [],
        status: "blocked",
      },
    ],
  });
  const { revision } = await seedMission(repository, plan, { approve: true });
  const pipelineRun = await createPipelineRun(repository, {
    missionId: plan.missionId,
    revisionId: revision.revisionId,
  });

  const blockedRun = await createMissionRun(repository, {
    pipelineRun,
    missionId: plan.missionId,
    revisionId: revision.revisionId,
    stepId: "convert",
    moduleId: "doc_to_md",
    skillId: "doc_to_md",
    agentId: "converter",
    title: "Converter blocked",
    metadata: getMetadataWithInteraction(
      { missionId: plan.missionId, revisionId: revision.revisionId, agentId: "converter", skillId: "doc_to_md", dagStepId: "convert" },
      approvalInteraction({
        kind: "blocked",
        status: "blocked",
        title: "Need source credentials",
        message: "Waiting for workspace credentials.",
        metadata: { stepId: "convert" },
      }),
    ),
  });
  await recordModuleRunEvent(repository.runtime, blockedRun.id, {
    eventType: "tool.execution.error",
    title: "Fallback error",
    message: "A generic adapter error should not win.",
    severity: "error",
  });

  const projected = await projectExecutionBoard(repository, plan.missionId);
  assert.equal(projected.board[0]?.status, "blocked");
  assert.equal(projected.board[0]?.blockingReason, "Waiting for workspace credentials.");
});

test("missing artifacts or events do not crash and plan still degrades gracefully", async () => {
  const repository = new ExecutionBoardTestRepository();
  const plan = createPlan({
    missionId: "mission-board-missing-data",
    steps: [
      {
        stepId: "listen",
        title: "Researcher",
        objective: "Collect source docs.",
        skillId: "web_listening",
        moduleId: "web_listening",
        assignedAgentId: "researcher",
        dependsOn: [],
        status: "pending",
      },
    ],
  });
  await seedMission(repository, plan);

  const projected = await projectExecutionBoard(repository, plan.missionId);
  assert.equal(projected.board.length, 1);
  assert.equal(projected.board[0]?.status, "pending");
  assert.equal(projected.board[0]?.latestArtifacts.length, 0);
  assert.match(projected.board[0]?.currentAction ?? "", /Collect source docs|Pending mission execution/);
});

test("multiple revisions show the latest approved or executed revision instead of a newer draft", async () => {
  const repository = new ExecutionBoardTestRepository();
  const v1 = createPlan({
    missionId: "mission-board-revisions",
    steps: [
      {
        stepId: "publish",
        title: "Publisher",
        objective: "Publish the generated agent.",
        skillId: "rag_to_agent",
        moduleId: "rag_to_agent",
        assignedAgentId: "publisher",
        dependsOn: [],
        status: "pending",
      },
    ],
  });
  const seeded = await seedMission(repository, v1, { approve: true, execute: true });

  const pipelineRun = await createPipelineRun(repository, {
    missionId: v1.missionId,
    revisionId: seeded.revision.revisionId,
  });
  const executedRun = await createMissionRun(repository, {
    pipelineRun,
    missionId: v1.missionId,
    revisionId: seeded.revision.revisionId,
    stepId: "publish",
    moduleId: "rag_to_agent",
    skillId: "rag_to_agent",
    agentId: "publisher",
    title: "Publisher execution",
    status: "succeeded",
  });
  await recordModuleRunEvent(repository.runtime, executedRun.id, {
    eventType: "tool.execution.completed",
    title: "Publish complete",
    message: "Agent package was published.",
  });

  const v2 = createPlan({
    missionId: v1.missionId,
    title: "Execution board mission v2",
    steps: [
      {
        stepId: "review",
        title: "Reviewer",
        objective: "Review a brand new draft.",
        skillId: "doc_to_md",
        moduleId: "doc_to_md",
        assignedAgentId: "reviewer",
        dependsOn: [],
        status: "pending",
      },
    ],
  });
  await repository.createRevision({
    missionId: v1.missionId,
    plan: v2,
  });

  const projected = await projectExecutionBoard(repository, v1.missionId);
  assert.equal(projected.revisionId, seeded.revision.revisionId);
  assert.equal(projected.board.length, 1);
  assert.equal(projected.board[0]?.agentId, "publisher");
  assert.equal(projected.board[0]?.status, "succeeded");
  assert.equal(projected.board[0]?.currentAction, "Agent package was published.");
});
