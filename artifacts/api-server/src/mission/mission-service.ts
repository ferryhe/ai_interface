import type { AgentConfigRepository } from "../agent-config/agent-config-service";
import { defaultAgentRuntimeRegistry } from "../agent-registry/agent-runtime-registry";
import {
  createAgentRun,
  type AgentPlanner,
  type AgentRunResponse,
  type AgentRuntimeRepository,
  type PipelineRunRecord,
} from "../agent-runtime/agent-runtime-service";
import { getCurrentInteraction, type JsonObject, type ModuleRunRecord } from "../modules/ingest-service";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";
import {
  MissionRevisionConflictError,
  MissionValidationError,
  generateMissionId,
  type MissionExecutionStatus,
  type MissionPlanRevisionRecord,
  type MissionRecord,
  type MissionRepository,
} from "./mission-repository";
import { validateMissionPlan, type MissionPlan } from "./mission-plan";

function trimText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new MissionValidationError(`${label} must be a non-empty string.`);
  }
  return trimmed;
}

function trimTitle(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "Mission";
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

function clonePlan(plan: MissionPlan): MissionPlan {
  return structuredClone(plan);
}

function withPlanStatus(plan: MissionPlan, status: MissionPlan["status"]): MissionPlan {
  return validateMissionPlan({
    ...clonePlan(plan),
    status,
  });
}

function createDraftPlan(input: {
  missionId: string;
  message: string;
  agentId?: string;
  enabledSkillIds?: string[];
  reviewMode?: "draft_for_review" | "plan_only";
}): MissionPlan {
  const message = trimText(input.message, "Mission message");
  const title = trimTitle(message);
  const skillDefinitions = defaultSkillRuntimeRegistry.listBusinessSkillDefinitions();

  let allowedSkillIds: string[];

  if (input.agentId) {
    const agent = defaultAgentRuntimeRegistry.getAgent(input.agentId);
    if (!agent) {
      throw new MissionValidationError(`Agent is not registered: ${input.agentId}`);
    }
    allowedSkillIds = agent.skills.map((binding) => binding.skillId);
    if (allowedSkillIds.length === 0) {
      throw new MissionValidationError(`Agent ${input.agentId} has no skill bindings.`);
    }
  } else {
    allowedSkillIds = skillDefinitions.map((s) => s.skillId);
  }

  const requestedIds =
    input.enabledSkillIds && input.enabledSkillIds.length > 0
      ? input.enabledSkillIds
      : allowedSkillIds;

  const crossAgentSkills = input.agentId
    ? requestedIds.filter((id) => !allowedSkillIds.includes(id))
    : [];
  if (crossAgentSkills.length > 0) {
    throw new MissionValidationError(
      `Agent ${input.agentId} does not declare the following skill bindings: ${crossAgentSkills.join(", ")}`,
    );
  }

  const enabledSkills = requestedIds
    .map((skillId) => {
      const skill = skillDefinitions.find((d) => d.skillId === skillId);
      if (!skill) {
        throw new MissionValidationError(`Skill is not registered: ${skillId}`);
      }
      return skill;
    })
    .filter((skill, index, list) => list.findIndex((item) => item.skillId === skill.skillId) === index);

  if (enabledSkills.length === 0) {
    throw new MissionValidationError("At least one skill must be enabled before creating a mission.");
  }

  const steps = enabledSkills.map((skill, index) => ({
    stepId: `step-${index + 1}`,
    title: skill.displayName,
    objective: index === 0 ? message : `Continue mission work with ${skill.displayName}.`,
    skillId: skill.skillId,
    moduleId: skill.moduleId,
    ...(input.agentId ? { assignedAgentId: input.agentId } : {}),
    dependsOn: index === 0 ? [] : [`step-${index}`],
    status:
      index === enabledSkills.length - 1 && input.reviewMode !== "plan_only"
        ? ("waiting_approval" as const)
        : ("pending" as const),
    ...(index === enabledSkills.length - 1 && input.reviewMode !== "plan_only"
      ? {
          approval: {
            required: true,
            reason: "Mission requires explicit approval before execution.",
            riskLevel: "high" as const,
          },
        }
      : {}),
  }));

  return validateMissionPlan({
    missionId: input.missionId,
    title,
    userGoal: message,
    summary:
      input.reviewMode === "plan_only"
        ? "Draft mission plan prepared without requesting execution."
        : "Draft mission plan prepared for review and approval.",
    status: "needs_confirmation",
    riskLevel: steps.some((step) => step.approval?.required) ? "high" : enabledSkills.length > 2 ? "medium" : "low",
    steps,
    warnings:
      input.reviewMode === "plan_only"
        ? ["Mission is in plan-only mode; execution has not started."]
        : [],
    nonGoals: ["Do not execute runtime work until the mission is explicitly approved."],
  });
}

function createRevisedPlan(
  mission: MissionRecord,
  latestRevision: MissionPlanRevisionRecord,
  instruction: string,
): MissionPlan {
  const trimmedInstruction = trimText(instruction, "Revision instruction");
  const nextPlan = clonePlan(latestRevision.plan);
  nextPlan.title = mission.title;
  nextPlan.userGoal = mission.userGoal;
  nextPlan.summary = `${latestRevision.plan.summary} Revision note: ${trimmedInstruction}`;
  nextPlan.status = "needs_confirmation";
  nextPlan.warnings = [
    ...latestRevision.plan.warnings,
    `Revision requested: ${trimmedInstruction}`,
  ];
  nextPlan.nonGoals = Array.from(new Set(latestRevision.plan.nonGoals));
  nextPlan.steps = latestRevision.plan.steps.map((step, index) => ({
    ...step,
    dependsOn: [...step.dependsOn],
    status:
      index === latestRevision.plan.steps.length - 1 && step.approval?.required
        ? "waiting_approval"
        : "pending",
    ...(step.approval
      ? {
          approval: {
            ...step.approval,
          },
        }
      : {}),
  }));

  return validateMissionPlan(nextPlan);
}

function assertMissionExists(mission: MissionRecord | null, missionId: string): MissionRecord {
  if (!mission) {
    throw new Error(`Mission not found: ${missionId}`);
  }
  return mission;
}

function assertRevisionExists(
  revision: MissionPlanRevisionRecord | null,
  missionId: string,
): MissionPlanRevisionRecord {
  if (!revision) {
    throw new Error(`Mission revision not found for mission: ${missionId}`);
  }
  return revision;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function skillIdForMissionStep(
  step: MissionPlan["steps"][number],
  registry: SkillRuntimeRegistry,
): string | undefined {
  const skillId = step.skillId?.trim();
  if (skillId) return skillId;
  const moduleId = step.moduleId?.trim();
  if (!moduleId) return undefined;
  return registry.listSkills().find((manifest) => manifest.moduleId === moduleId)?.skillId;
}

function moduleIdForMissionStep(
  step: MissionPlan["steps"][number],
  registry: SkillRuntimeRegistry,
): string | undefined {
  const moduleId = step.moduleId?.trim();
  if (moduleId) return moduleId;
  const skillId = step.skillId?.trim();
  if (!skillId) return undefined;
  return registry.getSkill(skillId)?.moduleId;
}

function enabledSkillIdsForPlan(plan: MissionPlan, registry: SkillRuntimeRegistry): string[] {
  return uniqueStrings(plan.steps.map((step) => skillIdForMissionStep(step, registry)));
}

function singleAssignedAgentIdForPlan(plan: MissionPlan): string | undefined {
  const agentIds = uniqueStrings(plan.steps.map((step) => step.assignedAgentId));
  return agentIds.length === 1 ? agentIds[0] : undefined;
}

function executionAgentIdForPlan(plan: MissionPlan): string | undefined {
  const agentIds = uniqueStrings(plan.steps.map((step) => step.assignedAgentId));
  if (agentIds.length > 1) {
    throw new MissionValidationError(
      `Mission execution currently requires a single assigned agent; found ${agentIds.join(", ")}.`,
    );
  }
  return agentIds[0];
}

function missionStepMetadata(input: {
  mission: MissionRecord;
  revision: MissionPlanRevisionRecord;
  step: MissionPlan["steps"][number];
  includeExecutionMetadata: boolean;
}): JsonObject {
  const approval = input.step.approval;
  return {
    ...(input.includeExecutionMetadata
      ? {
          missionId: input.mission.missionId,
          revisionId: input.revision.revisionId,
          missionTitle: input.mission.title,
          missionRiskLevel: input.mission.riskLevel,
        }
      : { missionPlanPreview: true }),
    stepId: input.step.stepId,
    ...(input.step.assignedAgentId ? { agentId: input.step.assignedAgentId } : {}),
    ...(input.step.roleId ? { roleId: input.step.roleId } : {}),
    ...(approval
      ? {
          approvalReason: approval.reason,
          approvalRiskLevel: approval.riskLevel,
        }
      : {}),
  };
}

function missionPlannerForRevision(
  mission: MissionRecord,
  revision: MissionPlanRevisionRecord,
  includeExecutionMetadata: boolean,
  registry: SkillRuntimeRegistry,
): AgentPlanner {
  return {
    async createPlan() {
      return {
        summary: `Executing mission plan: ${revision.plan.summary}`,
        mode: "dag" as const,
        failureStrategy: "fail_fast" as const,
        warnings: [...revision.plan.warnings],
        steps: revision.plan.steps.map((step) => {
          const moduleId = moduleIdForMissionStep(step, registry);
          const skillId = skillIdForMissionStep(step, registry);
          if (!moduleId || !skillId) {
            throw new MissionValidationError(
              `Mission step ${step.stepId} must include a skillId or moduleId before execution.`,
            );
          }
          return {
            skillId,
            moduleId,
            title: step.title,
            action: step.objective,
            input: {
              missionId: mission.missionId,
              revisionId: revision.revisionId,
              stepId: step.stepId,
              userGoal: mission.userGoal,
              objective: step.objective,
            },
            requiresApproval: step.approval?.required === true,
            stepId: step.stepId,
            dependsOn: [...step.dependsOn],
            metadata: missionStepMetadata({
              mission,
              revision,
              step,
              includeExecutionMetadata,
            }),
          };
        }),
      };
    },
  };
}

function missionExecutionMetadata(input: {
  mission: MissionRecord;
  revision: MissionPlanRevisionRecord;
  rerun: boolean;
}): JsonObject {
  return {
    missionId: input.mission.missionId,
    revisionId: input.revision.revisionId,
    missionTitle: input.mission.title,
    missionRiskLevel: input.mission.riskLevel,
    missionExecutionSource: "mission-execute",
    ...(input.rerun ? { missionRerun: true } : {}),
  };
}

function hasActiveApprovalGate(runtime: AgentRunResponse): boolean {
  return runtime.moduleRuns.some(
    (run) => getCurrentInteraction(run)?.status === "waiting_for_approval",
  );
}

function isSkippedModuleRun(run: ModuleRunRecord): boolean {
  return run.metadata?.["adapterExecutionStatus"] === "skipped";
}

function hasSkippedAdapterExecution(runtime: AgentRunResponse): boolean {
  return runtime.moduleRuns.some(isSkippedModuleRun);
}

function missionExecutionReadiness(runtime: AgentRunResponse): {
  ready: boolean;
  status: "executing" | "needs_approval" | "completed" | "failed" | "plan_only";
  message: string;
} {
  if (runtime.pipelineRun.metadata?.["executionMode"] === "plan_only") {
    return {
      ready: true,
      status: "plan_only",
      message: "Mission runtime plan was created without starting adapter execution.",
    };
  }
  if (runtime.pipelineRun.status === "pending" && hasSkippedAdapterExecution(runtime)) {
    return {
      ready: false,
      status: "failed",
      message: "Mission runtime could not start because adapter configuration is missing.",
    };
  }
  if (runtime.status === "needs_approval" && hasActiveApprovalGate(runtime)) {
    return {
      ready: true,
      status: "needs_approval",
      message: "Mission runtime started and is paused at a required approval point.",
    };
  }
  if (runtime.pipelineRun.status === "succeeded") {
    return {
      ready: true,
      status: "completed",
      message: "Mission runtime execution completed and produced traceable run artifacts.",
    };
  }
  if (runtime.status === "failed" || runtime.pipelineRun.status === "failed") {
    return {
      ready: false,
      status: "failed",
      message: "Mission runtime execution failed. Inspect the run timeline for details.",
    };
  }
  return {
    ready: true,
    status: "executing",
    message: "Mission runtime execution has started and can be tracked from the run timeline.",
  };
}

function isActivePipelineStatus(status: PipelineRunRecord["status"]): boolean {
  return status === "pending" || status === "running";
}

function isMissionExecutionPipelineRun(
  run: PipelineRunRecord,
  input: { missionId: string; revisionId: string },
): boolean {
  const metadata = run.metadata ?? {};
  return (
    metadata["missionExecutionSource"] === "mission-execute" &&
    metadata["missionId"] === input.missionId &&
    metadata["revisionId"] === input.revisionId &&
    metadata["executionMode"] !== "plan_only"
  );
}

async function findActiveMissionExecutionRun(
  runtimeRepository: AgentRuntimeRepository,
  input: { missionId: string; revisionId: string },
): Promise<PipelineRunRecord | undefined> {
  const matchingRuns = (await runtimeRepository.listPipelineRuns()).filter((run) =>
    isMissionExecutionPipelineRun(run, input),
  );
  for (const run of matchingRuns) {
    const moduleRuns = await runtimeRepository.listModuleRunsByPipelineRunId(run.id);
    const hasActiveModules = moduleRuns.some(
      (moduleRun) => isActivePipelineStatus(moduleRun.status) && !isSkippedModuleRun(moduleRun),
    );
    if (hasActiveModules || (moduleRuns.length === 0 && isActivePipelineStatus(run.status))) {
      return run;
    }
  }
  return undefined;
}

function missionStatusForRuntime(runtime: AgentRunResponse): MissionExecutionStatus {
  if (
    runtime.status === "failed" ||
    runtime.pipelineRun.status === "failed" ||
    (runtime.pipelineRun.status === "pending" && hasSkippedAdapterExecution(runtime))
  ) {
    return "failed";
  }
  if (runtime.pipelineRun.status === "succeeded") {
    return "completed";
  }
  return "executing";
}

async function assertExecutableMission(
  runtimeRepository: AgentRuntimeRepository,
  mission: MissionRecord,
  latestRevision: MissionPlanRevisionRecord,
  missionId: string,
  executionMode: "plan_only" | "execute_ready",
): Promise<{ rerun: boolean }> {
  const approvedStart = mission.status === "approved" && latestRevision.status === "approved";
  const rerun =
    latestRevision.status === "executed" &&
    (mission.status === "executing" || mission.status === "completed" || mission.status === "failed");
  if (!approvedStart && !rerun) {
    throw new MissionRevisionConflictError(
      `Mission ${missionId} must be approved before execution.`,
    );
  }
  if (executionMode === "execute_ready") {
    const activeRun = await findActiveMissionExecutionRun(runtimeRepository, {
      missionId,
      revisionId: latestRevision.revisionId,
    });
    if (activeRun) {
      throw new MissionRevisionConflictError(
        `Mission ${missionId} already has an active execution run ${activeRun.id}; resume or inspect that run before starting a rerun.`,
      );
    }
  }
  return { rerun };
}

export async function createMissionService(
  repository: MissionRepository,
  input: {
    message: string;
    agentId?: string;
    enabledSkillIds?: string[];
    reviewMode?: "draft_for_review" | "plan_only";
  },
): Promise<{ mission: MissionRecord; revision: MissionPlanRevisionRecord; plan: MissionPlan }> {
  const missionId = generateMissionId();
  const plan = createDraftPlan({
    missionId,
    message: input.message,
    agentId: input.agentId,
    enabledSkillIds: input.enabledSkillIds,
    reviewMode: input.reviewMode,
  });

  const created = await repository.createMission({
    missionId,
    title: plan.title,
    userGoal: plan.userGoal,
    status: "needs_confirmation",
    riskLevel: plan.riskLevel,
    plan,
  });

  return {
    mission: created.mission,
    revision: created.revision,
    plan: created.revision.plan,
  };
}

export async function getMissionService(
  repository: MissionRepository,
  missionId: string,
): Promise<{ mission: MissionRecord; latestRevision: MissionPlanRevisionRecord; plan: MissionPlan }> {
  const mission = assertMissionExists(await repository.findMission(missionId), missionId);
  const latestRevision = assertRevisionExists(
    await repository.findLatestRevision(missionId),
    missionId,
  );

  return {
    mission,
    latestRevision,
    plan: latestRevision.plan,
  };
}

export async function reviseMissionService(
  repository: MissionRepository,
  missionId: string,
  input: { instruction: string; expectedRevisionId: string },
): Promise<{ mission: MissionRecord; revision: MissionPlanRevisionRecord; plan: MissionPlan }> {
  const mission = assertMissionExists(await repository.findMission(missionId), missionId);
  const latestRevision = assertRevisionExists(
    await repository.findLatestRevision(missionId),
    missionId,
  );

  if (latestRevision.revisionId !== input.expectedRevisionId) {
    throw new MissionRevisionConflictError(
      `Mission ${missionId} has a newer revision than ${input.expectedRevisionId}.`,
    );
  }

  const revisedPlan = createRevisedPlan(mission, latestRevision, input.instruction);
  const revision = await repository.createRevision({
    missionId,
    plan: revisedPlan,
  });
  const updatedMission = assertMissionExists(await repository.findMission(missionId), missionId);

  return {
    mission: updatedMission,
    revision,
    plan: revision.plan,
  };
}

export async function approveMissionService(
  repository: MissionRepository,
  missionId: string,
  input: { revisionId: string; approvedBy?: string },
): Promise<{
  mission: MissionRecord;
  approvedRevision: MissionPlanRevisionRecord;
  executionReadiness: {
    ready: boolean;
    status: "approved";
    message: string;
    revisionId: string;
  };
}> {
  const approved = await repository.approveRevision({
    missionId,
    revisionId: input.revisionId,
    approvedBy: input.approvedBy,
  });

  return {
    mission: approved.mission,
    approvedRevision: approved.revision,
    executionReadiness: {
      ready: true,
      status: "approved",
      message: "Mission approved. Call execute to transition into runtime execution when available.",
      revisionId: approved.revision.revisionId,
    },
  };
}

export async function executeMissionService(
  repository: MissionRepository,
  runtimeRepository: AgentRuntimeRepository,
  configRepository: AgentConfigRepository,
  missionId: string,
  input: { revisionId: string; executionMode?: "plan_only" | "execute_ready" },
  options: {
    env?: Record<string, string | undefined>;
    registry?: SkillRuntimeRegistry;
  } = {},
): Promise<{
  mission: MissionRecord;
  pipelineRun: AgentRunResponse["pipelineRun"];
  thread: AgentRunResponse["thread"];
  moduleRuns: AgentRunResponse["moduleRuns"];
  executionReadiness: ReturnType<typeof missionExecutionReadiness> & { revisionId: string };
}> {
  const mission = assertMissionExists(await repository.findMission(missionId), missionId);
  const latestRevision = assertRevisionExists(
    await repository.findLatestRevision(missionId),
    missionId,
  );

  if (latestRevision.revisionId !== input.revisionId) {
    throw new MissionRevisionConflictError(
      `Only the latest revision can be executed for mission ${missionId}.`,
    );
  }

  const executionMode = input.executionMode ?? "execute_ready";
  const skillRegistry = options.registry ?? defaultSkillRuntimeRegistry;
  const { rerun } = await assertExecutableMission(
    runtimeRepository,
    mission,
    latestRevision,
    missionId,
    executionMode,
  );
  const runtime = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: mission.userGoal,
      title: mission.title,
      agentId:
        executionMode === "execute_ready"
          ? executionAgentIdForPlan(latestRevision.plan)
          : singleAssignedAgentIdForPlan(latestRevision.plan),
      enabledSkillIds: enabledSkillIdsForPlan(latestRevision.plan, skillRegistry),
      executionMode,
      metadata:
        executionMode === "execute_ready"
          ? missionExecutionMetadata({
              mission,
              revision: latestRevision,
              rerun: rerun,
            })
          : { missionPlanPreview: true },
    },
    {
      env: options.env,
      registry: skillRegistry,
      planner: missionPlannerForRevision(
        mission,
        latestRevision,
        executionMode === "execute_ready",
        skillRegistry,
      ),
    },
  );

  let pipelineRun = runtime.pipelineRun;
  if (executionMode === "execute_ready" && hasSkippedAdapterExecution(runtime)) {
    pipelineRun = await runtimeRepository.updatePipelineRun(runtime.pipelineRun.id, {
      status: "failed",
      activeModuleId: runtime.moduleRuns.find(isSkippedModuleRun)?.moduleId ?? runtime.pipelineRun.activeModuleId,
    });
  }

  if (executionMode === "execute_ready") {
    await repository.linkExecution({
      missionId,
      revisionId: input.revisionId,
      executedAt: new Date(),
      threadId: runtime.thread.id,
      pipelineRunId: pipelineRun.id,
      sourceAgentRunId: runtime.agentMessage.id,
      status: missionStatusForRuntime({ ...runtime, pipelineRun }),
    });
  }

  const updatedMission = assertMissionExists(await repository.findMission(missionId), missionId);

  return {
    mission: updatedMission,
    thread: runtime.thread,
    pipelineRun,
    moduleRuns: runtime.moduleRuns,
    executionReadiness: {
      ...missionExecutionReadiness({ ...runtime, pipelineRun }),
      revisionId: latestRevision.revisionId,
    },
  };
}
