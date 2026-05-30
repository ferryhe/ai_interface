import { defaultAgentRuntimeRegistry } from "../agent-registry/agent-runtime-registry";
import { defaultSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import {
  MissionRevisionConflictError,
  MissionValidationError,
  generateMissionId,
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
  missionId: string,
  input: { revisionId: string; executionMode?: "plan_only" | "execute_ready" },
): Promise<{
  mission: MissionRecord;
  pipelineRun?: null;
  thread?: null;
  moduleRuns?: [];
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

  if (mission.status !== "approved" || latestRevision.status !== "approved") {
    throw new MissionRevisionConflictError(
      `Mission ${missionId} must be approved before execution.`,
    );
  }

  await repository.linkExecution({
    missionId,
    revisionId: input.revisionId,
    executedAt: new Date(),
    threadId: null,
    pipelineRunId: null,
    sourceAgentRunId: null,
  });

  const updatedMission = assertMissionExists(await repository.findMission(missionId), missionId);

  return {
    mission: updatedMission,
    thread: null,
    pipelineRun: null,
    moduleRuns: [],
  };
}
