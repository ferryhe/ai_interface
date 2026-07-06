import type {
  AgentRuntimeRepository,
  PipelineRunRecord,
} from "../agent-runtime/agent-runtime-service";
import {
  getCurrentInteraction,
  recordModuleRunEvent,
  requestModuleRunInteraction,
  submitModuleRunFeedback,
  type JsonObject,
  type ModuleRunRecord,
  type ModuleRunStatus,
  type ToolInteraction,
} from "../modules/ingest-service";
import {
  ModuleRunResumeConflictError,
  resumeModuleRunExecution,
  type ResumeModuleRunExecutionOptions,
} from "../tool-adapters/resume-service";
import { getAdapterDefinition } from "../tool-adapters/adapter-registry";
import { executeModuleRunWithAdapter } from "../tool-adapters/executor";
import { createToolAdapterExecutor } from "../tool-adapters/executor-router";
import {
  findProjectedApprovalRequestById,
  listPendingApprovalRequests,
  projectApprovalRequest,
  type ApprovalRequest,
  type ApprovalRequestStatus,
} from "./approval-projection";
import type {
  MissionExecutionStatus,
  MissionRepository,
} from "../mission/mission-repository";

export interface ApprovalDecisionOptions extends ResumeModuleRunExecutionOptions {
  missionRepository?: MissionRepository;
}

export class ApprovalConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "ApprovalConflictError";
  }
}

export class ApprovalNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = "ApprovalNotFoundError";
  }
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function mergeApprovalDecision(
  run: ModuleRunRecord,
  status: Extract<ApprovalRequestStatus, "approved" | "rejected">,
): JsonObject {
  return {
    ...(run.metadata ?? {}),
    approvalDecision: {
      ...(isRecord(run.metadata?.["approvalDecision"])
        ? (run.metadata?.["approvalDecision"] as JsonObject)
        : {}),
      status,
      decidedAt: new Date().toISOString(),
    },
  };
}

function isSkippedModuleRun(run: ModuleRunRecord): boolean {
  return run.metadata?.["adapterExecutionStatus"] === "skipped";
}

function pipelineStatusForModuleRuns(moduleRuns: ModuleRunRecord[]): ModuleRunStatus {
  if (
    moduleRuns.some(
      (run) => run.status === "failed" || run.status === "cancelled" || isSkippedModuleRun(run),
    )
  ) {
    return "failed";
  }
  if (moduleRuns.length > 0 && moduleRuns.every((run) => run.status === "succeeded")) {
    return "succeeded";
  }
  if (moduleRuns.some((run) => run.status === "running" || run.status === "succeeded")) {
    return "running";
  }
  return "pending";
}

function activeModuleIdForModuleRuns(
  moduleRuns: ModuleRunRecord[],
  pipelineStatus: ModuleRunStatus,
): PipelineRunRecord["activeModuleId"] {
  if (pipelineStatus === "failed" || pipelineStatus === "succeeded" || pipelineStatus === "cancelled") {
    return null;
  }
  return moduleRuns.find((run) => run.status === "pending" || run.status === "running")?.moduleId ?? null;
}

function dagFailureStrategyForPipeline(
  pipelineRun: PipelineRunRecord,
): "fail_fast" | "continue_independent" {
  return pipelineRun.metadata?.["dagFailureStrategy"] === "continue_independent"
    ? "continue_independent"
    : "fail_fast";
}

function failedDagStepIds(moduleRuns: ModuleRunRecord[]): string[] {
  return moduleRuns
    .filter(
      (run) => run.status === "failed" || run.status === "cancelled" || isSkippedModuleRun(run),
    )
    .map((run) => readString(run.metadata?.["dagStepId"]) ?? readString(run.metadata?.["stepId"]))
    .filter((stepId): stepId is string => Boolean(stepId));
}

function metadataWithoutDagBlockers(metadata: JsonObject | null | undefined): JsonObject {
  const {
    dagExecutionStatus: _dagExecutionStatus,
    dagBlockedReason: _dagBlockedReason,
    dagBlockedByStepIds: _dagBlockedByStepIds,
    ...rest
  } = metadata ?? {};
  return rest;
}

function approvalReasonForRun(run: ModuleRunRecord): string {
  return (
    readString(run.metadata?.["approvalReason"]) ??
    readString(run.metadata?.["reason"]) ??
    `Approval is required before executing ${run.moduleId}.`
  );
}

function isDagBlocked(run: ModuleRunRecord): boolean {
  return (
    run.metadata?.["dagExecutionStatus"] === "blocked" ||
    readString(run.metadata?.["dagBlockedReason"]) !== undefined
  );
}

function isApprovalRequired(run: ModuleRunRecord): boolean {
  return run.metadata?.["requiresApproval"] === true;
}

async function requestReadyDagApproval(
  repository: AgentRuntimeRepository,
  run: ModuleRunRecord,
): Promise<ModuleRunRecord> {
  const action = readString(run.metadata?.["action"]) ?? run.title ?? `Approve ${run.moduleId}`;
  const reason = approvalReasonForRun(run);
  const stepId = readString(run.metadata?.["dagStepId"]) ?? readString(run.metadata?.["stepId"]);
  const requested = await requestModuleRunInteraction(repository, run.id, {
    kind: "approval",
    title: action,
    message: reason,
    resumeHandle: `${run.moduleId}:${run.externalRunId}:resume`,
    requestedBy: "agent-runtime",
    metadata: {
      ...metadataWithoutDagBlockers(run.metadata),
      action,
      reason,
      riskLevel: readString(run.metadata?.["approvalRiskLevel"]) ?? "high",
      ...(stepId ? { stepId } : {}),
      skillId: readString(run.metadata?.["skillId"]),
      moduleId: run.moduleId,
      toolKind: readString(run.metadata?.["adapterKind"]),
    },
  });
  const updatedRun = await repository.updateModuleRun(requested.run.id, {
    status: "pending",
    metadata: {
      ...metadataWithoutDagBlockers(requested.run.metadata),
      adapterExecutionStatus: "approval_required",
    },
  });
  await recordModuleRunEvent(repository, updatedRun.id, {
    eventType: "tool.execution.approval_required",
    title: "Adapter execution requires approval",
    message: reason,
    severity: "info",
    payload: {
      moduleId: run.moduleId,
      externalRunId: run.externalRunId,
      ...(stepId ? { stepId } : {}),
    },
  });
  return updatedRun;
}

async function executeReadyDagRun(
  repository: AgentRuntimeRepository,
  run: ModuleRunRecord,
  options: ApprovalDecisionOptions,
): Promise<ModuleRunRecord> {
  const unblockedRun = await repository.updateModuleRun(run.id, {
    metadata: metadataWithoutDagBlockers(run.metadata),
  });
  const env = options.env ?? process.env;
  const adapter = getAdapterDefinition(unblockedRun.moduleId, options.registry);
  const result = await executeModuleRunWithAdapter(
    repository,
    unblockedRun.id,
    createToolAdapterExecutor(adapter, env),
    { env, registry: options.registry },
  );
  return result.run;
}

async function advanceReadyDagModuleRuns(
  repository: AgentRuntimeRepository,
  pipelineRun: PipelineRunRecord | null,
  options: ApprovalDecisionOptions,
): Promise<void> {
  if (!pipelineRun) return;

  let progressed = true;
  while (progressed) {
    progressed = false;
    const moduleRuns = await repository.listModuleRunsByPipelineRunId(pipelineRun.id);
    if (dagFailureStrategyForPipeline(pipelineRun) === "fail_fast" && failedDagStepIds(moduleRuns).length > 0) {
      return;
    }
    const runsByStepId = new Map<string, ModuleRunRecord>();
    for (const run of moduleRuns) {
      const stepId = readString(run.metadata?.["dagStepId"]);
      if (stepId) runsByStepId.set(stepId, run);
    }

    for (const run of moduleRuns) {
      if (run.status !== "pending") continue;
      if (!isDagBlocked(run)) continue;
      if (getCurrentInteraction(run)) continue;

      const dependsOn = readStringArray(run.metadata?.["dagDependsOn"]);
      if (dependsOn.length === 0) continue;
      const dependenciesSucceeded = dependsOn.every(
        (stepId) => runsByStepId.get(stepId)?.status === "succeeded",
      );
      if (!dependenciesSucceeded) continue;

      if (isApprovalRequired(run)) {
        await requestReadyDagApproval(repository, run);
      } else {
        await executeReadyDagRun(repository, run, options);
      }
      progressed = true;
    }
  }
}

function isMissionExecutionMetadata(metadata: JsonObject | null | undefined): boolean {
  return metadata?.["missionExecutionSource"] === "mission-execute";
}

function missionExecutionIdsFor(projected: {
  run: ModuleRunRecord;
  pipelineRun: PipelineRunRecord | null;
}): { missionId: string; revisionId: string } | null {
  if (
    !isMissionExecutionMetadata(projected.run.metadata) &&
    !isMissionExecutionMetadata(projected.pipelineRun?.metadata)
  ) {
    return null;
  }
  const missionId =
    readString(projected.run.metadata?.["missionId"]) ??
    readString(projected.pipelineRun?.metadata?.["missionId"]);
  const revisionId =
    readString(projected.run.metadata?.["revisionId"]) ??
    readString(projected.pipelineRun?.metadata?.["revisionId"]);
  return missionId && revisionId ? { missionId, revisionId } : null;
}

function missionStatusForPipeline(status: ModuleRunStatus): MissionExecutionStatus | null {
  if (status === "succeeded") return "completed";
  if (status === "failed" || status === "cancelled") return "failed";
  return null;
}

async function reconcilePipelineAndMissionStatus(
  repository: AgentRuntimeRepository,
  projected: { approval: ApprovalRequest; run: ModuleRunRecord; pipelineRun: PipelineRunRecord | null },
  missionRepository?: MissionRepository,
): Promise<void> {
  const pipelineRun = projected.pipelineRun;
  if (!pipelineRun) return;

  const moduleRuns = await repository.listModuleRunsByPipelineRunId(pipelineRun.id);
  const pipelineStatus = pipelineStatusForModuleRuns(moduleRuns);
  await repository.updatePipelineRun(pipelineRun.id, {
    status: pipelineStatus,
    activeModuleId: activeModuleIdForModuleRuns(moduleRuns, pipelineStatus),
  });

  const missionStatus = missionStatusForPipeline(pipelineStatus);
  if (!missionStatus || !missionRepository) return;
  const missionExecutionIds = missionExecutionIdsFor(projected);
  if (!missionExecutionIds) return;
  await missionRepository.updateExecutionStatus({
    missionId: missionExecutionIds.missionId,
    revisionId: missionExecutionIds.revisionId,
    status: missionStatus,
  });
}

async function ensureProjectedApproval(
  repository: AgentRuntimeRepository,
  approvalId: string,
) {
  const projected = await findProjectedApprovalRequestById(repository, approvalId);
  if (!projected) {
    throw new ApprovalNotFoundError(`Approval request not found: ${approvalId}`);
  }
  return projected;
}

function assertPending(
  approval: ApprovalRequest,
  nextStatus: "approved" | "rejected",
): void {
  if (approval.status === nextStatus) return;
  if (approval.status === "pending") return;
  throw new ApprovalConflictError(
    `Approval request ${approval.approvalId} is already ${approval.status}.`,
  );
}

function assertActiveApprovalInteraction(
  interaction: ToolInteraction | null,
  approvalId: string,
): asserts interaction is ToolInteraction {
  if (!interaction) {
    throw new ApprovalConflictError(
      `Approval request ${approvalId} no longer has an active interaction.`,
    );
  }
  if (interaction.status !== "waiting_for_approval") {
    throw new ApprovalConflictError(
      `Approval request ${approvalId} is not waiting for approval.`,
    );
  }
}

async function refreshApproval(
  repository: AgentRuntimeRepository,
  run: ModuleRunRecord,
  pipelineRun: PipelineRunRecord | null,
): Promise<ApprovalRequest> {
  const latest = await repository.findModuleRunById(run.id);
  if (!latest) {
    throw new ApprovalNotFoundError(`Module run not found for approval: ${run.id}`);
  }
  const projected = projectApprovalRequest(latest, pipelineRun);
  if (!projected) {
    throw new ApprovalConflictError(
      `Approval request ${run.id} is no longer projectable.`,
    );
  }
  return projected.approval;
}

export async function listApprovalsService(
  repository: AgentRuntimeRepository,
): Promise<ApprovalRequest[]> {
  return listPendingApprovalRequests(repository);
}

export async function approveApprovalRequest(
  repository: AgentRuntimeRepository,
  approvalId: string,
  options: ApprovalDecisionOptions = {},
): Promise<ApprovalRequest> {
  const projected = await ensureProjectedApproval(repository, approvalId);
  assertPending(projected.approval, "approved");
  if (projected.approval.status === "approved") {
    return projected.approval;
  }

  assertActiveApprovalInteraction(projected.interaction, approvalId);

  const feedback = await submitModuleRunFeedback(repository, projected.run.id, {
    approved: true,
    resumeHandle:
      projected.interaction.resumeHandle ?? projected.approval.resumeHandle,
    metadata: {
      approvalId,
      decision: "approved",
      source: "approval-inbox",
    },
  });

  await repository.updateModuleRun(projected.run.id, {
    metadata: mergeApprovalDecision(feedback.run, "approved"),
  });

  try {
    await resumeModuleRunExecution(repository, projected.run.id, options);
  } catch (error) {
    if (error instanceof ModuleRunResumeConflictError) {
      throw new ApprovalConflictError(error.message);
    }
    throw error;
  }

  await advanceReadyDagModuleRuns(repository, projected.pipelineRun, options);

  await reconcilePipelineAndMissionStatus(
    repository,
    projected,
    options.missionRepository,
  );

  return refreshApproval(repository, projected.run, projected.pipelineRun);
}

export async function rejectApprovalRequest(
  repository: AgentRuntimeRepository,
  approvalId: string,
  options: ApprovalDecisionOptions = {},
): Promise<ApprovalRequest> {
  const projected = await ensureProjectedApproval(repository, approvalId);
  assertPending(projected.approval, "rejected");
  if (projected.approval.status === "rejected") {
    return projected.approval;
  }

  assertActiveApprovalInteraction(projected.interaction, approvalId);

  const feedback = await submitModuleRunFeedback(repository, projected.run.id, {
    approved: false,
    resumeHandle:
      projected.interaction.resumeHandle ?? projected.approval.resumeHandle,
    responseText: `Rejected approval for ${projected.approval.action}`,
    metadata: {
      approvalId,
      decision: "rejected",
      source: "approval-inbox",
    },
  });

  const rejectedRun = await repository.updateModuleRun(projected.run.id, {
    status: "cancelled",
    summary: `Approval rejected for ${projected.approval.action}`,
    metadata: mergeApprovalDecision(feedback.run, "rejected"),
  });

  await recordModuleRunEvent(repository, rejectedRun.id, {
    eventType: "tool.interaction.approval_rejected",
    title: projected.approval.action,
    message: projected.approval.reason,
    severity: "warning",
    payload: {
      approvalId,
      moduleRunId: projected.run.id,
      interactionId: projected.interaction.interactionId,
      resumeHandle: projected.interaction.resumeHandle,
    },
  });

  await advanceReadyDagModuleRuns(repository, projected.pipelineRun, options);

  await reconcilePipelineAndMissionStatus(
    repository,
    projected,
    options.missionRepository,
  );

  return refreshApproval(repository, rejectedRun, projected.pipelineRun);
}
