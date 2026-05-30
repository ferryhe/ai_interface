import type {
  AgentRuntimeRepository,
  PipelineRunRecord,
} from "../agent-runtime/agent-runtime-service";
import {
  getCurrentInteraction,
  type JsonObject,
  type ModuleRunRecord,
  type ToolInteraction,
} from "../modules/ingest-service";

export type ApprovalRiskLevel = "low" | "medium" | "high";
export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export interface ApprovalRequest {
  approvalId: string;
  missionId: string;
  revisionId: string;
  moduleRunId: string;
  interactionId?: string;
  resumeHandle?: string;
  stepId?: string;
  agentId?: string;
  skillId?: string;
  toolKind?: string;
  riskLevel: ApprovalRiskLevel;
  action: string;
  reason: string;
  requestedAt: string;
  status: ApprovalRequestStatus;
}

export interface ProjectedApprovalRequest {
  approval: ApprovalRequest;
  run: ModuleRunRecord;
  pipelineRun: PipelineRunRecord | null;
  interaction: ToolInteraction | null;
}

interface ApprovalDecisionMetadata {
  status?: ApprovalRequestStatus;
  decidedAt?: string;
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRiskLevel(value: unknown): ApprovalRiskLevel {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "high";
}

function decisionMetadata(run: ModuleRunRecord): ApprovalDecisionMetadata {
  const value = run.metadata?.["approvalDecision"];
  return isRecord(value) ? value : {};
}

function projectedStatus(
  run: ModuleRunRecord,
  interaction: ToolInteraction | null,
): ApprovalRequestStatus | null {
  const decision = decisionMetadata(run).status;
  if (
    decision === "approved" ||
    decision === "rejected" ||
    decision === "expired"
  ) {
    return decision;
  }

  if (interaction?.response?.approved === true) return "approved";
  if (interaction?.response?.approved === false) return "rejected";
  if (interaction?.status === "waiting_for_approval") return "pending";
  if (
    run.metadata?.["adapterExecutionStatus"] === "approval_required" ||
    run.metadata?.["requiresApproval"] === true
  ) {
    return "pending";
  }
  return null;
}

function requestedAtFor(
  run: ModuleRunRecord,
  interaction: ToolInteraction | null,
): string {
  return (
    readString(run.metadata?.["approvalRequestedAt"]) ??
    interaction?.requestedAt ??
    run.updatedAt.toISOString()
  );
}

function missionIdFor(
  run: ModuleRunRecord,
  pipelineRun: PipelineRunRecord | null,
): string {
  return (
    readString(run.metadata?.["missionId"]) ??
    readString(pipelineRun?.metadata?.["missionId"]) ??
    run.pipelineRunId ??
    run.id
  );
}

function revisionIdFor(
  run: ModuleRunRecord,
  pipelineRun: PipelineRunRecord | null,
): string {
  return (
    readString(run.metadata?.["revisionId"]) ??
    readString(pipelineRun?.metadata?.["revisionId"]) ??
    run.externalRunId
  );
}

export function projectApprovalRequest(
  run: ModuleRunRecord,
  pipelineRun: PipelineRunRecord | null = null,
): ProjectedApprovalRequest | null {
  const interaction = getCurrentInteraction(run);
  const status = projectedStatus(run, interaction);
  if (!status) return null;

  const interactionMetadata = interaction?.metadata;
  const approvalId =
    readString(run.metadata?.["approvalId"]) ??
    interaction?.interactionId ??
    `approval:${run.id}`;
  const action =
    readString(interactionMetadata?.["action"]) ??
    readString(run.metadata?.["action"]) ??
    interaction?.title ??
    run.title ??
    `Approve ${run.moduleId}`;
  const reason =
    readString(interactionMetadata?.["reason"]) ??
    interaction?.message ??
    readString(run.metadata?.["approvalReason"]) ??
    `Approval is required before executing ${run.moduleId}.`;
  const requestedAt = requestedAtFor(run, interaction);

  return {
    approval: {
      approvalId,
      missionId: missionIdFor(run, pipelineRun),
      revisionId: revisionIdFor(run, pipelineRun),
      moduleRunId: run.id,
      ...(interaction?.interactionId
        ? { interactionId: interaction.interactionId }
        : {}),
      ...(interaction?.resumeHandle ? { resumeHandle: interaction.resumeHandle } : {}),
      ...(readString(interactionMetadata?.["stepId"]) ??
      readString(run.metadata?.["dagStepId"]) ??
      readString(run.metadata?.["stepId"])
        ? {
            stepId:
              readString(interactionMetadata?.["stepId"]) ??
              readString(run.metadata?.["dagStepId"]) ??
              readString(run.metadata?.["stepId"]),
          }
        : {}),
      ...(readString(run.metadata?.["agentId"]) ? { agentId: readString(run.metadata?.["agentId"]) } : {}),
      ...(readString(run.metadata?.["skillId"]) ? { skillId: readString(run.metadata?.["skillId"]) } : {}),
      ...(readString(interactionMetadata?.["toolKind"]) ??
      readString(run.metadata?.["adapterKind"])
        ? {
            toolKind:
              readString(interactionMetadata?.["toolKind"]) ??
              readString(run.metadata?.["adapterKind"]),
          }
        : {}),
      riskLevel: normalizeRiskLevel(
        interactionMetadata?.["riskLevel"] ??
          run.metadata?.["riskLevel"] ??
          run.metadata?.["approvalRiskLevel"],
      ),
      action,
      reason,
      requestedAt,
      status,
    },
    run,
    pipelineRun,
    interaction,
  };
}

export async function listProjectedApprovalRequests(
  repository: AgentRuntimeRepository,
): Promise<ProjectedApprovalRequest[]> {
  const pipelineRuns = await repository.listPipelineRuns();
  const approvals = await Promise.all(
    pipelineRuns.map(async (pipelineRun) => {
      const moduleRuns = await repository.listModuleRunsByPipelineRunId(pipelineRun.id);
      return moduleRuns
        .map((run) => projectApprovalRequest(run, pipelineRun))
        .filter((value): value is ProjectedApprovalRequest => value !== null);
    }),
  );

  return approvals
    .flat()
    .sort(
      (left, right) =>
        Date.parse(right.approval.requestedAt) -
        Date.parse(left.approval.requestedAt),
    );
}

export async function listPendingApprovalRequests(
  repository: AgentRuntimeRepository,
): Promise<ApprovalRequest[]> {
  return (await listProjectedApprovalRequests(repository))
    .map((item) => item.approval)
    .filter((approval) => approval.status === "pending");
}

export async function findProjectedApprovalRequestById(
  repository: AgentRuntimeRepository,
  approvalId: string,
): Promise<ProjectedApprovalRequest | null> {
  const approvals = await listProjectedApprovalRequests(repository);
  return approvals.find((item) => item.approval.approvalId === approvalId) ?? null;
}
