import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryAgentRuntimeRepository,
  type PipelineRunRecord,
} from "../agent-runtime/agent-runtime-service";
import {
  createModuleRun,
  requestModuleRunInteraction,
} from "../modules/ingest-service";
import {
  approveApprovalRequest,
  ApprovalConflictError,
  listApprovalsService,
  rejectApprovalRequest,
} from "./approval-decision-service";
import {
  findProjectedApprovalRequestById,
  projectApprovalRequest,
} from "./approval-projection";

async function createApprovalFixture(
  repository: InMemoryAgentRuntimeRepository,
  input: {
    missionId?: string;
    revisionId?: string;
    action?: string;
    reason?: string;
    riskLevel?: "low" | "medium" | "high";
  } = {},
): Promise<{
  pipelineRun: PipelineRunRecord;
  runId: string;
  approvalId: string;
}> {
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Approval pipeline",
    status: "running",
    activeModuleId: "doc_to_md",
    metadata: {
      missionId: input.missionId ?? "mission-pr6",
      revisionId: input.revisionId ?? "revision-pr6",
    },
  });

  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:1:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Convert document",
    inputJson: { topic: "approvals" },
    metadata: {
      missionId: input.missionId ?? "mission-pr6",
      revisionId: input.revisionId ?? "revision-pr6",
      action: input.action ?? "Publish generated knowledge pack",
      approvalReason:
        input.reason ?? "The generated package writes production-facing artifacts.",
      approvalRiskLevel: input.riskLevel ?? "high",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      stepId: "publish-agent",
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });

  const requested = await requestModuleRunInteraction(repository, run.id, {
    kind: "approval",
    title: input.action ?? "Publish generated knowledge pack",
    message:
      input.reason ?? "The generated package writes production-facing artifacts.",
    resumeHandle: `doc_to_md:${run.externalRunId}:resume`,
    metadata: {
      action: input.action ?? "Publish generated knowledge pack",
      reason:
        input.reason ?? "The generated package writes production-facing artifacts.",
      riskLevel: input.riskLevel ?? "high",
      stepId: "publish-agent",
      toolKind: "http",
    },
  });

  return {
    pipelineRun,
    runId: run.id,
    approvalId: requested.interaction.interactionId,
  };
}

test("projects pending approval from module-run metadata", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const fixture = await createApprovalFixture(repository, {
    missionId: "mission-123",
    revisionId: "revision-456",
  });

  const approvals = await listApprovalsService(repository);
  assert.equal(approvals.length, 1);
  assert.deepEqual(approvals[0], {
    approvalId: fixture.approvalId,
    missionId: "mission-123",
    revisionId: "revision-456",
    moduleRunId: fixture.runId,
    interactionId: fixture.approvalId,
    resumeHandle: `doc_to_md:${fixture.pipelineRun.id}:1:doc_to_md:resume`,
    stepId: "publish-agent",
    agentId: "knowledge_builder",
    skillId: "doc_to_md",
    toolKind: "http",
    riskLevel: "high",
    action: "Publish generated knowledge pack",
    reason: "The generated package writes production-facing artifacts.",
    requestedAt: approvals[0]!.requestedAt,
    status: "pending",
  });
});

test("approve request calls existing feedback/resume path", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const fixture = await createApprovalFixture(repository);

  const approved = await approveApprovalRequest(repository, fixture.approvalId, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });

  assert.equal(approved.status, "approved");

  const run = await repository.findModuleRunById(fixture.runId);
  const interaction = run && projectApprovalRequest(run, fixture.pipelineRun)?.interaction;
  assert.equal(run?.status, "succeeded");
  assert.equal(interaction?.status, "resumed");
  assert.equal(interaction?.response?.approved, true);

  const events = await repository.listRunEvents(fixture.runId);
  assert.deepEqual(
    events.map((event) => event.eventType),
    [
      "tool.interaction.requested",
      "tool.interaction.feedback_submitted",
      "tool.execution.resume_requested",
      "tool.execution.fake_completed",
    ],
  );
});

test("reject request blocks intended step", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const fixture = await createApprovalFixture(repository);

  const rejected = await rejectApprovalRequest(repository, fixture.approvalId);
  assert.equal(rejected.status, "rejected");

  const run = await repository.findModuleRunById(fixture.runId);
  assert.equal(run?.status, "cancelled");
  assert.match(run?.summary ?? "", /Approval rejected/);

  const events = await repository.listRunEvents(fixture.runId);
  assert.equal(events.at(-1)?.eventType, "tool.interaction.approval_rejected");
});

test("approve rejected request returns conflict", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const fixture = await createApprovalFixture(repository);
  await rejectApprovalRequest(repository, fixture.approvalId);

  await assert.rejects(
    () =>
      approveApprovalRequest(repository, fixture.approvalId, {
        env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
      }),
    (error: unknown) =>
      error instanceof ApprovalConflictError && /already rejected/.test(error.message),
  );
});

test("approval decision is idempotent", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const fixture = await createApprovalFixture(repository);

  const firstApproval = await approveApprovalRequest(repository, fixture.approvalId, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });
  const secondApproval = await approveApprovalRequest(repository, fixture.approvalId, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });

  assert.equal(firstApproval.approvalId, secondApproval.approvalId);
  assert.equal(secondApproval.status, "approved");

  const rejectedRepository = new InMemoryAgentRuntimeRepository();
  const rejectedFixture = await createApprovalFixture(rejectedRepository);
  const firstReject = await rejectApprovalRequest(
    rejectedRepository,
    rejectedFixture.approvalId,
  );
  const secondReject = await rejectApprovalRequest(
    rejectedRepository,
    rejectedFixture.approvalId,
  );

  assert.equal(firstReject.approvalId, secondReject.approvalId);
  assert.equal(secondReject.status, "rejected");
});

test("projector can look up approval by id after decision", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const fixture = await createApprovalFixture(repository);
  await rejectApprovalRequest(repository, fixture.approvalId);

  const projected = await findProjectedApprovalRequestById(
    repository,
    fixture.approvalId,
  );
  assert.equal(projected?.approval.status, "rejected");
});
