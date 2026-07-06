import type {
  AgentRuntimeRepository,
  PipelineRunRecord,
} from "../agent-runtime/agent-runtime-service";
import { projectApprovalRequest } from "../approvals/approval-projection";
import type {
  ArtifactRecord,
  ModuleRunRecord,
  RunEventRecord,
  ToolInteraction,
} from "../modules/ingest-service";
import { getCurrentInteraction } from "../modules/ingest-service";
import type {
  MissionPlanRevisionRecord,
  MissionRepository,
} from "./mission-repository";
import type { MissionPlanStep } from "./mission-plan";

export interface MissionBoardArtifact {
  artifactId: string;
  kind: string;
  title: string;
}

export interface MissionBoardAgent {
  agentId?: string;
  roleId?: string;
  displayName: string;
  status:
    | "pending"
    | "running"
    | "waiting_approval"
    | "blocked"
    | "succeeded"
    | "failed";
  currentAction: string;
  lastEventAt?: string;
  blockingReason?: string;
  moduleRunIds: string[];
  latestArtifacts: MissionBoardArtifact[];
}

export interface ExecutionBoardResult {
  missionId: string;
  revisionId: string | null;
  board: MissionBoardAgent[];
}

type ExecutionBoardRepository = Pick<MissionRepository, "findMission" | "listRevisions" | "findExecutionLink"> &
  Pick<
    AgentRuntimeRepository,
    | "listPipelineRuns"
    | "listModuleRunsByPipelineRunId"
    | "listRunEvents"
    | "listRunArtifacts"
  >;

interface BoardGroup {
  agentId?: string;
  roleId?: string;
  displayName: string;
  planSteps: MissionPlanStep[];
  moduleRuns: ModuleRunRecord[];
  pipelineRuns: PipelineRunRecord[];
  runEvents: RunEventRecord[];
  artifacts: ArtifactRecord[];
  approvals: Array<ReturnType<typeof projectApprovalRequest>>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toIsoString(value: Date | undefined | null): string | undefined {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return undefined;
  return value.toISOString();
}

function groupKey(input: {
  roleId?: string;
  agentId?: string;
  stepId?: string;
  moduleId?: string;
}): string {
  if (input.roleId) return `role:${input.roleId}`;
  if (input.agentId) return `agent:${input.agentId}`;
  if (input.stepId) return `step:${input.stepId}`;
  return `module:${input.moduleId ?? "unknown"}`;
}

function displayNameForStep(step: MissionPlanStep): string {
  return step.roleId ?? step.assignedAgentId ?? step.title;
}

function revisionForBoard(revisions: MissionPlanRevisionRecord[]): MissionPlanRevisionRecord | null {
  const sorted = [...revisions].sort((left, right) => right.revisionNumber - left.revisionNumber);
  return (
    sorted.find((revision) => revision.status === "executed") ??
    sorted.find((revision) => revision.status === "approved") ??
    sorted[0] ??
    null
  );
}

function stepIdForRun(run: ModuleRunRecord): string | undefined {
  return readString(run.metadata?.["dagStepId"]) ?? readString(run.metadata?.["stepId"]);
}

function belongsToRevision(
  run: ModuleRunRecord,
  pipelineRun: PipelineRunRecord,
  missionId: string,
  revisionId: string,
): boolean {
  const runMissionId =
    readString(run.metadata?.["missionId"]) ?? readString(pipelineRun.metadata?.["missionId"]);
  const runRevisionId =
    readString(run.metadata?.["revisionId"]) ?? readString(pipelineRun.metadata?.["revisionId"]);
  return runMissionId === missionId && runRevisionId === revisionId;
}

function interactionBlockingReason(interaction: ToolInteraction | null): string | undefined {
  if (!interaction) return undefined;
  return readString(interaction.message) ?? readString(interaction.title);
}

function metadataBlockingReason(run: ModuleRunRecord): string | undefined {
  return (
    readString(run.metadata?.["blockingReason"]) ??
    readString(run.metadata?.["dagBlockedReason"]) ??
    readString(run.metadata?.["approvalReason"])
  );
}

function latestEvent(events: RunEventRecord[]): RunEventRecord | undefined {
  return [...events].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}

function latestTimestamp(group: BoardGroup): string | undefined {
  const timestamps = [
    ...group.runEvents.map((event) => event.createdAt.getTime()),
    ...group.moduleRuns.map((run) => run.updatedAt.getTime()),
  ].filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

function latestArtifacts(artifacts: ArtifactRecord[]): MissionBoardArtifact[] {
  const seen = new Set<string>();
  return [...artifacts]
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .filter((artifact) => {
      if (seen.has(artifact.id)) return false;
      seen.add(artifact.id);
      return true;
    })
    .slice(0, 4)
    .map((artifact) => ({
      artifactId: artifact.id,
      kind: artifact.artifactKind,
      title: artifact.title,
    }));
}

function blockingReasonForGroup(group: BoardGroup): string | undefined {
  const pendingApproval = group.approvals.find((approval) => approval?.approval.status === "pending");
  if (pendingApproval) return pendingApproval.approval.reason;

  for (const run of group.moduleRuns) {
    const interaction = getCurrentInteraction(run);
    if (interaction?.status === "blocked") {
      return interactionBlockingReason(interaction);
    }
  }

  for (const run of group.moduleRuns) {
    const metadataReason = metadataBlockingReason(run);
    if (metadataReason) return metadataReason;
  }

  const errorEvent = [...group.runEvents]
    .filter((event) => event.severity === "error")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  if (errorEvent) return readString(errorEvent.message) ?? readString(errorEvent.title);

  const warningEvent = [...group.runEvents]
    .filter((event) => event.severity === "warning")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  if (warningEvent) return readString(warningEvent.message) ?? readString(warningEvent.title);

  const waitingApprovalStep = group.planSteps.find((step) => step.status === "waiting_approval");
  return waitingApprovalStep?.approval?.reason;
}

function currentActionForGroup(group: BoardGroup): string {
  const pendingApproval = group.approvals.find((approval) => approval?.approval.status === "pending");
  if (pendingApproval) return pendingApproval.approval.action;

  const event = latestEvent(group.runEvents);
  if (event) {
    const eventAction = readString(event.message) ?? readString(event.title);
    if (eventAction) return eventAction;
  }

  const latestRun = [...group.moduleRuns].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  )[0];
  if (latestRun) {
    return (
      readString(latestRun.summary) ??
      readString(latestRun.metadata?.["action"]) ??
      readString(latestRun.title) ??
      `Working in ${latestRun.moduleId}`
    );
  }

  const activeStep =
    group.planSteps.find((step) => step.status === "running") ??
    group.planSteps.find((step) => step.status === "waiting_approval") ??
    group.planSteps.find((step) => step.status === "blocked") ??
    group.planSteps.find((step) => step.status === "pending") ??
    group.planSteps[0];

  return activeStep?.objective ?? activeStep?.title ?? "Pending mission execution.";
}

function statusFromPlan(group: BoardGroup): MissionBoardAgent["status"] {
  if (group.planSteps.some((step) => step.status === "waiting_approval")) return "waiting_approval";
  if (group.planSteps.some((step) => step.status === "blocked")) return "blocked";
  if (group.planSteps.some((step) => step.status === "failed")) return "failed";
  if (group.planSteps.some((step) => step.status === "running")) return "running";
  if (group.planSteps.length > 0 && group.planSteps.every((step) => step.status === "succeeded")) {
    return "succeeded";
  }
  return "pending";
}

function statusFromRuns(group: BoardGroup): MissionBoardAgent["status"] | null {
  if (group.moduleRuns.some((run) => run.status === "failed")) return "failed";
  if (group.moduleRuns.some((run) => run.status === "running")) return "running";
  if (group.moduleRuns.length > 0 && group.moduleRuns.every((run) => run.status === "succeeded")) {
    return "succeeded";
  }

  if (group.approvals.some((approval) => approval?.approval.status === "pending")) {
    return "waiting_approval";
  }

  const hasBlockedInteraction = group.moduleRuns.some((run) => getCurrentInteraction(run)?.status === "blocked");
  const hasBlockedEvent = group.runEvents.some((event) => event.eventType === "agent.plan.step.blocked");
  const blockedByMetadata = group.moduleRuns.some(
    (run) => Boolean(metadataBlockingReason(run)) && run.status === "pending",
  );
  if (hasBlockedInteraction || hasBlockedEvent || blockedByMetadata) return "blocked";

  if (group.moduleRuns.some((run) => run.status === "pending")) return "pending";
  return null;
}

function sortBoard(left: MissionBoardAgent, right: MissionBoardAgent): number {
  const order: Record<MissionBoardAgent["status"], number> = {
    blocked: 0,
    failed: 1,
    waiting_approval: 2,
    running: 3,
    pending: 4,
    succeeded: 5,
  };
  if (order[left.status] !== order[right.status]) return order[left.status] - order[right.status];
  return left.displayName.localeCompare(right.displayName);
}

export async function projectExecutionBoard(
  repository: ExecutionBoardRepository,
  missionId: string,
): Promise<ExecutionBoardResult> {
  const mission = await repository.findMission(missionId);
  if (!mission) {
    throw new Error(`Mission not found: ${missionId}`);
  }

  const revisions = await repository.listRevisions(missionId);
  const revision = revisionForBoard(revisions);
  if (!revision) {
    return { missionId, revisionId: null, board: [] };
  }

  const groups = new Map<string, BoardGroup>();
  const stepById = new Map(revision.plan.steps.map((step) => [step.stepId, step]));

  for (const step of revision.plan.steps) {
    const key = groupKey({
      roleId: step.roleId,
      agentId: step.assignedAgentId,
      stepId: step.stepId,
      moduleId: step.moduleId,
    });
    const existing = groups.get(key);
    if (existing) {
      existing.planSteps.push(step);
      continue;
    }
    groups.set(key, {
      agentId: step.assignedAgentId,
      roleId: step.roleId,
      displayName: displayNameForStep(step),
      planSteps: [step],
      moduleRuns: [],
      pipelineRuns: [],
      runEvents: [],
      artifacts: [],
      approvals: [],
    });
  }

  const executionLink = await repository.findExecutionLink(missionId, revision.revisionId);
  const currentPipelineRunId = executionLink?.pipelineRunId ?? null;
  const pipelineRuns = await repository.listPipelineRuns();
  for (const pipelineRun of pipelineRuns) {
    if (currentPipelineRunId && pipelineRun.id !== currentPipelineRunId) continue;
    const moduleRuns = await repository.listModuleRunsByPipelineRunId(pipelineRun.id);
    for (const run of moduleRuns) {
      if (!belongsToRevision(run, pipelineRun, missionId, revision.revisionId)) continue;

      const matchedStep =
        (stepIdForRun(run) ? stepById.get(stepIdForRun(run)!) : undefined) ??
        revision.plan.steps.find((step) => {
          const stepAgentId = step.assignedAgentId;
          const runAgentId = readString(run.metadata?.["agentId"]);
          const stepSkillId = step.skillId ?? step.moduleId;
          const runSkillId = readString(run.metadata?.["skillId"]);
          return (
            (!stepAgentId || !runAgentId || stepAgentId === runAgentId) &&
            (stepSkillId === runSkillId || step.moduleId === run.moduleId)
          );
        });

      const key = groupKey({
        roleId: matchedStep?.roleId,
        agentId: matchedStep?.assignedAgentId ?? readString(run.metadata?.["agentId"]),
        stepId: matchedStep?.stepId ?? stepIdForRun(run),
        moduleId: matchedStep?.moduleId ?? run.moduleId,
      });

      const group =
        groups.get(key) ??
        {
          agentId: matchedStep?.assignedAgentId ?? readString(run.metadata?.["agentId"]),
          roleId: matchedStep?.roleId,
          displayName:
            matchedStep?.roleId ??
            matchedStep?.assignedAgentId ??
            readString(run.metadata?.["agentId"]) ??
            matchedStep?.title ??
            run.title ??
            run.moduleId,
          planSteps: matchedStep ? [matchedStep] : [],
          moduleRuns: [],
          pipelineRuns: [],
          runEvents: [],
          artifacts: [],
          approvals: [],
        };
      groups.set(key, group);

      group.moduleRuns.push(run);
      if (!group.pipelineRuns.some((item) => item.id === pipelineRun.id)) {
        group.pipelineRuns.push(pipelineRun);
      }

      const [events, artifacts] = await Promise.all([
        repository.listRunEvents(run.id),
        repository.listRunArtifacts(run.id),
      ]);
      group.runEvents.push(...events);
      group.artifacts.push(...artifacts);

      const approval = projectApprovalRequest(run, pipelineRun);
      if (approval && approval.approval.missionId === missionId && approval.approval.revisionId === revision.revisionId) {
        group.approvals.push(approval);
      }
    }
  }

  const board = [...groups.values()]
    .map<MissionBoardAgent>((group) => {
      const status = statusFromRuns(group) ?? statusFromPlan(group);
      const blockingReason = status === "succeeded" ? undefined : blockingReasonForGroup(group);
      return {
        ...(group.agentId ? { agentId: group.agentId } : {}),
        ...(group.roleId ? { roleId: group.roleId } : {}),
        displayName: group.displayName,
        status,
        currentAction: currentActionForGroup(group),
        ...(latestTimestamp(group) ? { lastEventAt: latestTimestamp(group) } : {}),
        ...(blockingReason ? { blockingReason } : {}),
        moduleRunIds: Array.from(new Set(group.moduleRuns.map((run) => run.id))),
        latestArtifacts: latestArtifacts(group.artifacts),
      };
    })
    .sort(sortBoard);

  return {
    missionId,
    revisionId: revision.revisionId,
    board,
  };
}
