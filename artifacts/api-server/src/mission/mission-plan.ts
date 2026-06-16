import type { AgentRuntimePlan } from "../agent-runtime/agent-runtime-service";

export type MissionRiskLevel = "low" | "medium" | "high";

export type MissionPlanStatus =
  | "draft"
  | "needs_confirmation"
  | "approved"
  | "executing"
  | "completed"
  | "failed";

export type MissionStepStatus =
  | "pending"
  | "waiting_approval"
  | "running"
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface MissionStepApproval {
  required: boolean;
  reason: string;
  riskLevel: MissionRiskLevel;
}

export type MissionStepRole = "executor" | "qa_reviewer";

export interface ActivationProfile {
  level: "full" | "sprint" | "micro";
  maxAgents?: number;
  reviewIntensity: "high" | "medium" | "low";
}

export interface EvidenceContract {
  requiredArtifacts: string[];
  assertionType: "presence" | "json_schema" | "content_contains";
  assertionConfig: Record<string, unknown>;
}

export interface MissionPlanStep {
  stepId: string;
  title: string;
  objective: string;
  skillId?: string;
  moduleId?: string;
  assignedAgentId?: string;
  roleId?: string;
  role?: MissionStepRole;
  evidenceContract?: EvidenceContract;
  dependsOn: string[];
  status: MissionStepStatus;
  approval?: MissionStepApproval;
}

export interface MissionPlan {
  missionId: string;
  title: string;
  userGoal: string;
  summary: string;
  status: MissionPlanStatus;
  riskLevel: MissionRiskLevel;
  steps: MissionPlanStep[];
  warnings: string[];
  nonGoals: string[];
  activationProfile?: ActivationProfile;
}

export interface AgentRuntimePlanMissionOptions {
  missionId: string;
  title: string;
  userGoal: string;
  status?: MissionPlanStatus;
  riskLevel?: MissionRiskLevel;
  nonGoals?: string[];
}

const MISSION_RISK_LEVELS: MissionRiskLevel[] = ["low", "medium", "high"];
const MISSION_PLAN_STATUSES: MissionPlanStatus[] = [
  "draft",
  "needs_confirmation",
  "approved",
  "executing",
  "completed",
  "failed",
];
const MISSION_STEP_STATUSES: MissionStepStatus[] = [
  "pending",
  "waiting_approval",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
];
const MISSION_STEP_ROLES: MissionStepRole[] = ["executor", "qa_reviewer"];
const EVIDENCE_ASSERTION_TYPES: EvidenceContract["assertionType"][] = [
  "presence",
  "json_schema",
  "content_contains",
];
const ACTIVATION_PROFILE_LEVELS: ActivationProfile["level"][] = [
  "full",
  "sprint",
  "micro",
];
const ACTIVATION_PROFILE_REVIEW_INTENSITIES: Array<
  ActivationProfile["reviewIntensity"]
> = ["high", "medium", "low"];

export const DEFAULT_ACTIVATION_PROFILE: ActivationProfile = {
  level: "micro",
  reviewIntensity: "medium",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissionRiskLevel(value: string): value is MissionRiskLevel {
  return MISSION_RISK_LEVELS.includes(value as MissionRiskLevel);
}

function isMissionPlanStatus(value: string): value is MissionPlanStatus {
  return MISSION_PLAN_STATUSES.includes(value as MissionPlanStatus);
}

function isMissionStepStatus(value: string): value is MissionStepStatus {
  return MISSION_STEP_STATUSES.includes(value as MissionStepStatus);
}

function isMissionStepRole(value: string): value is MissionStepRole {
  return MISSION_STEP_ROLES.includes(value as MissionStepRole);
}

function isEvidenceAssertionType(
  value: string,
): value is EvidenceContract["assertionType"] {
  return EVIDENCE_ASSERTION_TYPES.includes(
    value as EvidenceContract["assertionType"],
  );
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return normalized;
}

function normalizeStepId(value: string, index: number): string {
  return requireNonEmptyString(value, `Mission step ${index + 1} stepId`);
}

function normalizeDependsOn(step: MissionPlanStep, index: number): string[] {
  if (!Array.isArray(step.dependsOn)) {
    throw new Error(`Mission step ${index + 1} dependsOn must be an array.`);
  }

  return step.dependsOn.map((dependency, dependencyIndex) =>
    requireNonEmptyString(
      dependency,
      `Mission step ${step.stepId || index + 1} dependsOn[${dependencyIndex}]`,
    ),
  );
}

function normalizeStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value.map((item, index) =>
    requireNonEmptyString(item, `${label}[${index}]`),
  );
}

function normalizeEvidenceContract(
  step: MissionPlanStep,
  index: number,
): void {
  if (step.evidenceContract === undefined) return;

  const stepLabel = step.stepId || String(index + 1);
  if (!isRecord(step.evidenceContract)) {
    throw new Error(
      `Mission step ${stepLabel} evidenceContract must be an object.`,
    );
  }

  const allowedKeys = new Set([
    "requiredArtifacts",
    "assertionType",
    "assertionConfig",
  ]);
  for (const key of Object.keys(step.evidenceContract)) {
    if (!allowedKeys.has(key)) {
      throw new Error(
        `Mission step ${stepLabel} evidenceContract has unsupported field: ${key}.`,
      );
    }
  }

  step.evidenceContract.requiredArtifacts = normalizeStringArray(
    step.evidenceContract.requiredArtifacts,
    `Mission step ${stepLabel} evidenceContract.requiredArtifacts`,
  );
  if (!isEvidenceAssertionType(step.evidenceContract.assertionType)) {
    throw new Error(
      `Mission step ${stepLabel} evidenceContract.assertionType must be one of: ${EVIDENCE_ASSERTION_TYPES.join(", ")}.`,
    );
  }
  if (!isRecord(step.evidenceContract.assertionConfig)) {
    throw new Error(
      `Mission step ${stepLabel} evidenceContract.assertionConfig must be an object.`,
    );
  }
}

function normalizeMissionStepRole(step: MissionPlanStep): void {
  if (step.role === undefined) {
    step.role = "executor";
    return;
  }
  if (!isMissionStepRole(step.role)) {
    throw new Error(
      `Mission step ${step.stepId} role must be one of: ${MISSION_STEP_ROLES.join(", ")}.`,
    );
  }
}

function validateApproval(step: MissionPlanStep, index: number): void {
  if (step.approval === undefined) return;

  if (typeof step.approval.required !== "boolean") {
    throw new Error(
      `Mission step ${step.stepId || index + 1} approval.required must be a boolean.`,
    );
  }

  requireNonEmptyString(
    step.approval.reason,
    `Mission step ${step.stepId || index + 1} approval.reason`,
  );

  if (!isMissionRiskLevel(step.approval.riskLevel)) {
    throw new Error(
      `Mission step ${step.stepId || index + 1} approval.riskLevel must be one of: ${MISSION_RISK_LEVELS.join(", ")}.`,
    );
  }

  if (step.approval.required && step.status !== "waiting_approval") {
    throw new Error(
      `Mission step ${step.stepId || index + 1} with approval.required=true must use waiting_approval status.`,
    );
  }
}

function normalizeActivationProfile(
  activationProfile: unknown,
): ActivationProfile {
  if (activationProfile === undefined) {
    return { ...DEFAULT_ACTIVATION_PROFILE };
  }
  if (!isRecord(activationProfile)) {
    throw new Error("Mission plan activationProfile must be an object.");
  }
  const level = activationProfile.level;
  if (
    typeof level !== "string" ||
    !ACTIVATION_PROFILE_LEVELS.includes(level as ActivationProfile["level"])
  ) {
    throw new Error(
      `Mission plan activationProfile.level must be one of: ${ACTIVATION_PROFILE_LEVELS.join(", ")}.`,
    );
  }
  const reviewIntensity = activationProfile.reviewIntensity;
  if (
    typeof reviewIntensity !== "string" ||
    !ACTIVATION_PROFILE_REVIEW_INTENSITIES.includes(
      reviewIntensity as ActivationProfile["reviewIntensity"],
    )
  ) {
    throw new Error(
      `Mission plan activationProfile.reviewIntensity must be one of: ${ACTIVATION_PROFILE_REVIEW_INTENSITIES.join(", ")}.`,
    );
  }
  const maxAgents = activationProfile.maxAgents;
  if (
    maxAgents !== undefined &&
    (typeof maxAgents !== "number" ||
      !Number.isInteger(maxAgents) ||
      maxAgents < 1)
  ) {
    throw new Error(
      "Mission plan activationProfile.maxAgents must be a positive integer.",
    );
  }
  return maxAgents === undefined
    ? {
        level: level as ActivationProfile["level"],
        reviewIntensity:
          reviewIntensity as ActivationProfile["reviewIntensity"],
      }
    : {
        level: level as ActivationProfile["level"],
        maxAgents,
        reviewIntensity:
          reviewIntensity as ActivationProfile["reviewIntensity"],
      };
}

function assertAcyclic(steps: MissionPlanStep[]): void {
  const byId = new Map(steps.map((step) => [step.stepId, step]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(stepId: string, path: string[]): void {
    if (visiting.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      const cyclePath = [
        ...(cycleStart === -1 ? path : path.slice(cycleStart)),
        stepId,
      ];
      throw new Error(
        `Mission plan has a dependency cycle: ${cyclePath.join(" -> ")}`,
      );
    }
    if (visited.has(stepId)) return;

    const step = byId.get(stepId);
    if (!step) return;

    visiting.add(stepId);
    for (const dependency of step.dependsOn) {
      visit(dependency, [...path, stepId]);
    }
    visiting.delete(stepId);
    visited.add(stepId);
  }

  for (const step of steps) {
    visit(step.stepId, []);
  }
}

function missionRiskLevelFromSteps(steps: MissionPlanStep[]): MissionRiskLevel {
  if (steps.some((step) => step.approval?.required)) return "high";
  if (steps.length > 2) return "medium";
  return "low";
}

export function validateMissionPlan(plan: MissionPlan): MissionPlan {
  requireNonEmptyString(plan.missionId, "Mission plan missionId");
  requireNonEmptyString(plan.title, "Mission plan title");
  requireNonEmptyString(plan.userGoal, "Mission plan userGoal");
  requireNonEmptyString(plan.summary, "Mission plan summary");

  if (!isMissionPlanStatus(plan.status)) {
    throw new Error(
      `Mission plan status must be one of: ${MISSION_PLAN_STATUSES.join(", ")}.`,
    );
  }

  if (!isMissionRiskLevel(plan.riskLevel)) {
    throw new Error(
      `Mission plan riskLevel must be one of: ${MISSION_RISK_LEVELS.join(", ")}.`,
    );
  }

  if (!Array.isArray(plan.steps)) {
    throw new Error("Mission plan steps must be an array.");
  }
  if (!Array.isArray(plan.warnings)) {
    throw new Error("Mission plan warnings must be an array.");
  }
  if (!Array.isArray(plan.nonGoals)) {
    throw new Error("Mission plan nonGoals must be an array.");
  }
  plan.activationProfile = normalizeActivationProfile(plan.activationProfile);

  const seen = new Set<string>();
  for (const [index, step] of plan.steps.entries()) {
    step.stepId = normalizeStepId(step.stepId, index);
    step.title = requireNonEmptyString(step.title, `Mission step ${step.stepId} title`);
    step.objective = requireNonEmptyString(
      step.objective,
      `Mission step ${step.stepId} objective`,
    );

    if (!isMissionStepStatus(step.status)) {
      throw new Error(
        `Mission step ${step.stepId} status must be one of: ${MISSION_STEP_STATUSES.join(", ")}.`,
      );
    }
    normalizeMissionStepRole(step);
    if (step.role === "qa_reviewer" && step.evidenceContract === undefined) {
      throw new Error(
        `Mission step ${step.stepId} with role=qa_reviewer requires evidenceContract.`,
      );
    }

    step.dependsOn = normalizeDependsOn(step, index);
    normalizeEvidenceContract(step, index);
    validateApproval(step, index);

    if (seen.has(step.stepId)) {
      throw new Error(`Mission stepId is duplicated: ${step.stepId}`);
    }
    seen.add(step.stepId);
  }

  for (const step of plan.steps) {
    for (const dependency of step.dependsOn) {
      if (!seen.has(dependency)) {
        throw new Error(
          `Mission step ${step.stepId} depends on unknown step ${dependency}`,
        );
      }
    }
  }

  assertAcyclic(plan.steps);
  return plan;
}

export function mapAgentRuntimePlanToMissionPlan(
  plan: AgentRuntimePlan,
  options: AgentRuntimePlanMissionOptions,
): MissionPlan {
  const missionPlan: MissionPlan = {
    missionId: requireNonEmptyString(options.missionId, "Mission plan missionId"),
    title: requireNonEmptyString(options.title, "Mission plan title"),
    userGoal: requireNonEmptyString(options.userGoal, "Mission plan userGoal"),
    summary: requireNonEmptyString(plan.summary, "Agent runtime plan summary"),
    status: options.status ?? "needs_confirmation",
    riskLevel: options.riskLevel ?? "low",
    steps: plan.steps.map((step, index) => {
      const stepId = step.stepId?.trim() || `step-${index + 1}`;
      const approvalRequired = step.requiresApproval === true;
      return {
        stepId,
        title: requireNonEmptyString(step.title, `Agent runtime step ${stepId} title`),
        objective: requireNonEmptyString(
          step.action,
          `Agent runtime step ${stepId} action`,
        ),
        ...(step.skillId ? { skillId: step.skillId } : {}),
        ...(step.moduleId ? { moduleId: step.moduleId } : {}),
        dependsOn: step.dependsOn?.map((dependency) => dependency.trim()).filter(Boolean) ?? [],
        status: approvalRequired ? "waiting_approval" : "pending",
        ...(approvalRequired
          ? {
              approval: {
                required: true,
                reason: `Step ${stepId} requires approval before execution.`,
                riskLevel: "high" as const,
              },
            }
          : {}),
      };
    }),
    warnings: [...plan.warnings],
    nonGoals: [...(options.nonGoals ?? [])],
  };

  missionPlan.riskLevel = options.riskLevel ?? missionRiskLevelFromSteps(missionPlan.steps);
  return validateMissionPlan(missionPlan);
}
