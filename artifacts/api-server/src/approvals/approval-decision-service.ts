import type {
  AgentRuntimeRepository,
  PipelineRunRecord,
} from "../agent-runtime/agent-runtime-service";
import {
  recordModuleRunEvent,
  submitModuleRunFeedback,
  type JsonObject,
  type ModuleRunRecord,
  type ToolInteraction,
} from "../modules/ingest-service";
import {
  ModuleRunResumeConflictError,
  resumeModuleRunExecution,
  type ResumeModuleRunExecutionOptions,
} from "../tool-adapters/resume-service";
import {
  findProjectedApprovalRequestById,
  listPendingApprovalRequests,
  projectApprovalRequest,
  type ApprovalRequest,
  type ApprovalRequestStatus,
} from "./approval-projection";

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
  options: ResumeModuleRunExecutionOptions = {},
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

  return refreshApproval(repository, projected.run, projected.pipelineRun);
}

export async function rejectApprovalRequest(
  repository: AgentRuntimeRepository,
  approvalId: string,
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

  return refreshApproval(repository, rejectedRun, projected.pipelineRun);
}
