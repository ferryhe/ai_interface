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

test("does not surface DAG-blocked downstream approval metadata before the gate is active", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Approval pipeline",
    status: "running",
    activeModuleId: "web_listening",
    metadata: {
      missionId: "mission-dag",
      revisionId: "revision-dag",
    },
  });

  const { run } = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: `${pipelineRun.id}:4:rag_to_agent`,
    pipelineRunId: pipelineRun.id,
    title: "Publish generated agent",
    inputJson: { topic: "approvals" },
    metadata: {
      missionId: "mission-dag",
      revisionId: "revision-dag",
      action: "Publish generated agent",
      approvalReason: "Publishing waits for upstream evidence first.",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      dagStepId: "step-4",
      dagDependsOn: ["step-3"],
      dagExecutionStatus: "blocked",
      dagBlockedReason: "approval_required",
      dagBlockedByStepIds: ["step-1"],
      skillId: "rag_to_agent",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });

  const approvals = await listApprovalsService(repository);
  assert.equal(approvals.length, 0);
  assert.equal(projectApprovalRequest(run, pipelineRun), null);
});

test("approved upstream DAG gates activate the next approval gate", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Multi-gate approval pipeline",
    status: "running",
    activeModuleId: "doc_to_md",
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-activate",
      revisionId: "revision-dag-activate",
    },
  });

  const { run: upstreamRun } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:1:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Convert approved source",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-activate",
      revisionId: "revision-dag-activate",
      action: "Convert approved source",
      approvalReason: "Source conversion needs approval.",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      dagStepId: "step-1",
      dagDependsOn: [],
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });
  const upstreamApproval = await requestModuleRunInteraction(repository, upstreamRun.id, {
    kind: "approval",
    title: "Convert approved source",
    message: "Source conversion needs approval.",
    resumeHandle: `doc_to_md:${upstreamRun.externalRunId}:resume`,
    metadata: {
      action: "Convert approved source",
      reason: "Source conversion needs approval.",
      riskLevel: "high",
      stepId: "step-1",
      toolKind: "http",
    },
  });
  await repository.updateModuleRun(upstreamRun.id, {
    status: "pending",
    metadata: {
      ...upstreamApproval.run.metadata,
      adapterExecutionStatus: "approval_required",
    },
  });

  const { run: downstreamRun } = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: `${pipelineRun.id}:2:rag_to_agent`,
    pipelineRunId: pipelineRun.id,
    title: "Publish generated agent",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-activate",
      revisionId: "revision-dag-activate",
      action: "Publish generated agent",
      approvalReason: "Publishing waits for the approved source conversion.",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      dagStepId: "step-2",
      dagDependsOn: ["step-1"],
      dagExecutionStatus: "blocked",
      dagBlockedReason: "approval_required",
      dagBlockedByStepIds: ["step-1"],
      skillId: "rag_to_agent",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });

  assert.deepEqual(
    (await listApprovalsService(repository)).map((approval) => approval.moduleRunId),
    [upstreamRun.id],
  );

  await approveApprovalRequest(repository, upstreamApproval.interaction.interactionId, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });

  const approvals = await listApprovalsService(repository);
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0]?.moduleRunId, downstreamRun.id);
  assert.equal(approvals[0]?.status, "pending");
  assert.equal(typeof approvals[0]?.interactionId, "string");

  const activatedDownstream = await repository.findModuleRunById(downstreamRun.id);
  assert.equal(activatedDownstream?.metadata?.["dagExecutionStatus"], undefined);
  assert.equal(activatedDownstream?.metadata?.["adapterExecutionStatus"], "approval_required");
  assert.equal(projectApprovalRequest(activatedDownstream!, pipelineRun)?.approval.status, "pending");
});

test("approved upstream DAG gates resume ready non-approval successors", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Approval then execution pipeline",
    status: "running",
    activeModuleId: "doc_to_md",
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-execute",
      revisionId: "revision-dag-execute",
    },
  });

  const { run: upstreamRun } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:1:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Approve source conversion",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-execute",
      revisionId: "revision-dag-execute",
      action: "Approve source conversion",
      approvalReason: "Source conversion needs approval.",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      dagStepId: "step-1",
      dagDependsOn: [],
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });
  const upstreamApproval = await requestModuleRunInteraction(repository, upstreamRun.id, {
    kind: "approval",
    title: "Approve source conversion",
    message: "Source conversion needs approval.",
    resumeHandle: `doc_to_md:${upstreamRun.externalRunId}:resume`,
    metadata: {
      action: "Approve source conversion",
      reason: "Source conversion needs approval.",
      riskLevel: "high",
      stepId: "step-1",
      toolKind: "http",
    },
  });
  await repository.updateModuleRun(upstreamRun.id, {
    status: "pending",
    metadata: {
      ...upstreamApproval.run.metadata,
      adapterExecutionStatus: "approval_required",
    },
  });

  const { run: downstreamRun } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:2:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Convert approved source",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-execute",
      revisionId: "revision-dag-execute",
      action: "Convert approved source",
      requiresApproval: false,
      dagStepId: "step-2",
      dagDependsOn: ["step-1"],
      dagExecutionStatus: "blocked",
      dagBlockedReason: "approval_required",
      dagBlockedByStepIds: ["step-1"],
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });

  await approveApprovalRequest(repository, upstreamApproval.interaction.interactionId, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });

  const resumedDownstream = await repository.findModuleRunById(downstreamRun.id);
  assert.equal(resumedDownstream?.status, "succeeded");
  assert.equal(resumedDownstream?.metadata?.["dagExecutionStatus"], undefined);
  assert.equal(resumedDownstream?.metadata?.["adapterExecutionStatus"], "succeeded");
  const pipeline = await repository.findPipelineRunById(pipelineRun.id);
  assert.equal(pipeline?.status, "succeeded");
});

test("approved DAG gates do not resume successors after fail-fast failure", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Fail-fast approval pipeline",
    status: "running",
    activeModuleId: "doc_to_md",
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-fail-fast",
      revisionId: "revision-dag-fail-fast",
      dagFailureStrategy: "fail_fast",
    },
  });

  const { run: upstreamRun } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:1:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Approve source conversion",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-fail-fast",
      revisionId: "revision-dag-fail-fast",
      action: "Approve source conversion",
      approvalReason: "Source conversion needs approval.",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      dagStepId: "step-1",
      dagDependsOn: [],
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });
  const upstreamApproval = await requestModuleRunInteraction(repository, upstreamRun.id, {
    kind: "approval",
    title: "Approve source conversion",
    message: "Source conversion needs approval.",
    resumeHandle: `doc_to_md:${upstreamRun.externalRunId}:resume`,
    metadata: {
      action: "Approve source conversion",
      reason: "Source conversion needs approval.",
      riskLevel: "high",
      stepId: "step-1",
      toolKind: "http",
    },
  });
  await repository.updateModuleRun(upstreamRun.id, {
    status: "pending",
    metadata: {
      ...upstreamApproval.run.metadata,
      adapterExecutionStatus: "approval_required",
    },
  });

  await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: `${pipelineRun.id}:2:web_listening`,
    pipelineRunId: pipelineRun.id,
    title: "Independent failed branch",
    status: "failed",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-fail-fast",
      revisionId: "revision-dag-fail-fast",
      requiresApproval: false,
      dagStepId: "step-2",
      dagDependsOn: [],
      skillId: "web_listening",
      agentId: "knowledge_builder",
      adapterKind: "cli",
    },
  });

  const { run: downstreamRun } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:3:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Downstream should stay blocked",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-fail-fast",
      revisionId: "revision-dag-fail-fast",
      action: "Downstream should stay blocked",
      requiresApproval: false,
      dagStepId: "step-3",
      dagDependsOn: ["step-1"],
      dagExecutionStatus: "blocked",
      dagBlockedReason: "approval_required",
      dagBlockedByStepIds: ["step-1"],
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });

  await approveApprovalRequest(repository, upstreamApproval.interaction.interactionId, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });

  const stillBlocked = await repository.findModuleRunById(downstreamRun.id);
  assert.equal(stillBlocked?.status, "pending");
  assert.equal(stillBlocked?.metadata?.["adapterExecutionStatus"], undefined);
  const pipeline = await repository.findPipelineRunById(pipelineRun.id);
  assert.equal(pipeline?.status, "failed");
  assert.equal(pipeline?.activeModuleId, null);
});

test("rejected continue-independent DAG gates still advance unrelated ready successors", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Continue-independent rejection pipeline",
    status: "running",
    activeModuleId: "doc_to_md",
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-continue-reject",
      revisionId: "revision-dag-continue-reject",
      dagFailureStrategy: "continue_independent",
    },
  });

  const { run: rejectedBranch } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:1:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Approve branch that will be rejected",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-continue-reject",
      revisionId: "revision-dag-continue-reject",
      action: "Approve branch that will be rejected",
      approvalReason: "This branch should not block independent work when rejected.",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      dagStepId: "step-1",
      dagDependsOn: [],
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });
  const rejectedApproval = await requestModuleRunInteraction(repository, rejectedBranch.id, {
    kind: "approval",
    title: "Approve branch that will be rejected",
    message: "This branch should not block independent work when rejected.",
    resumeHandle: `doc_to_md:${rejectedBranch.externalRunId}:resume`,
    metadata: {
      action: "Approve branch that will be rejected",
      reason: "This branch should not block independent work when rejected.",
      riskLevel: "high",
      stepId: "step-1",
      toolKind: "http",
    },
  });
  await repository.updateModuleRun(rejectedBranch.id, {
    status: "pending",
    metadata: {
      ...rejectedApproval.run.metadata,
      adapterExecutionStatus: "approval_required",
    },
  });

  await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: `${pipelineRun.id}:2:web_listening`,
    pipelineRunId: pipelineRun.id,
    title: "Independent completed prerequisite",
    status: "succeeded",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-continue-reject",
      revisionId: "revision-dag-continue-reject",
      requiresApproval: false,
      dagStepId: "step-2",
      dagDependsOn: [],
      skillId: "web_listening",
      agentId: "knowledge_builder",
      adapterKind: "cli",
    },
  });

  const { run: independentSuccessor } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:3:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Independent successor should continue",
    inputJson: { topic: "approvals" },
    metadata: {
      missionExecutionSource: "mission-execute",
      missionId: "mission-dag-continue-reject",
      revisionId: "revision-dag-continue-reject",
      action: "Independent successor should continue",
      requiresApproval: false,
      dagStepId: "step-3",
      dagDependsOn: ["step-2"],
      dagExecutionStatus: "blocked",
      dagBlockedReason: "upstream_blocked",
      dagBlockedByStepIds: ["step-2"],
      skillId: "doc_to_md",
      agentId: "knowledge_builder",
      adapterKind: "http",
    },
  });

  await rejectApprovalRequest(repository, rejectedApproval.interaction.interactionId, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });

  const rejectedRun = await repository.findModuleRunById(rejectedBranch.id);
  assert.equal(rejectedRun?.status, "cancelled");
  const continuedRun = await repository.findModuleRunById(independentSuccessor.id);
  assert.equal(continuedRun?.status, "succeeded");
  assert.equal(continuedRun?.metadata?.["dagExecutionStatus"], undefined);
  assert.equal(continuedRun?.metadata?.["adapterExecutionStatus"], "succeeded");
  const pipeline = await repository.findPipelineRunById(pipelineRun.id);
  assert.equal(pipeline?.status, "failed");
  assert.equal(pipeline?.activeModuleId, null);
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
