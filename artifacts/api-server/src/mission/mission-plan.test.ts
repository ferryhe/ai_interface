import assert from "node:assert/strict";
import test from "node:test";

import type { AgentRuntimePlan } from "../agent-runtime/agent-runtime-service";
import {
  DEFAULT_ACTIVATION_PROFILE,
  mapAgentRuntimePlanToMissionPlan,
  validateMissionPlan,
  type MissionPlan,
} from "./mission-plan";

function baseMissionPlan(overrides: Partial<MissionPlan> = {}): MissionPlan {
  return {
    missionId: "mission-001",
    title: "Build onboarding knowledge base",
    userGoal: "Turn onboarding documents into a usable agent.",
    summary: "Prepare the work in two safe steps.",
    status: "needs_confirmation",
    riskLevel: "low",
    steps: [
      {
        stepId: "step-1",
        title: "Collect sources",
        objective: "Collect the source material.",
        moduleId: "web_listening",
        skillId: "web_listening",
        dependsOn: [],
        status: "pending",
      },
      {
        stepId: "step-2",
        title: "Index content",
        objective: "Index converted content into RAG.",
        moduleId: "md_to_rag",
        skillId: "md_to_rag",
        dependsOn: ["step-1"],
        status: "pending",
      },
    ],
    warnings: [],
    nonGoals: [],
    ...overrides,
  };
}

test("fails when mission plan stepId is duplicated", () => {
  const plan = baseMissionPlan({
    steps: [
      {
        stepId: "dup-step",
        title: "One",
        objective: "First",
        dependsOn: [],
        status: "pending",
      },
      {
        stepId: "dup-step",
        title: "Two",
        objective: "Second",
        dependsOn: [],
        status: "pending",
      },
    ],
  });

  assert.throws(() => validateMissionPlan(plan), /duplicated: dup-step/);
});

test("fails when mission plan depends on an unknown step", () => {
  const plan = baseMissionPlan({
    steps: [
      {
        stepId: "step-1",
        title: "Only step",
        objective: "Do a thing",
        dependsOn: ["missing-step"],
        status: "pending",
      },
    ],
  });

  assert.throws(() => validateMissionPlan(plan), /unknown step missing-step/);
});

test("fails when mission plan has a dependency cycle", () => {
  const plan = baseMissionPlan({
    steps: [
      {
        stepId: "step-1",
        title: "First",
        objective: "Start",
        dependsOn: ["step-2"],
        status: "pending",
      },
      {
        stepId: "step-2",
        title: "Second",
        objective: "Continue",
        dependsOn: ["step-1"],
        status: "pending",
      },
    ],
  });

  assert.throws(() => validateMissionPlan(plan), /dependency cycle/);
});

test("fails when approval-required fields are incomplete", () => {
  const missingReason = baseMissionPlan({
    riskLevel: "high",
    steps: [
      {
        stepId: "approve-step",
        title: "Publish agent",
        objective: "Publish the drafted agent configuration.",
        dependsOn: [],
        status: "waiting_approval",
        approval: {
          required: true,
          reason: "   ",
          riskLevel: "high",
        },
      },
    ],
  });

  const missingRiskLevel = baseMissionPlan({
    riskLevel: "high",
    steps: [
      {
        stepId: "approve-step",
        title: "Publish agent",
        objective: "Publish the drafted agent configuration.",
        dependsOn: [],
        status: "waiting_approval",
        approval: {
          required: true,
          reason: "This changes the published agent.",
          riskLevel: "severe" as never,
        },
      },
    ],
  });

  assert.throws(() => validateMissionPlan(missingReason), /approval.reason/);
  assert.throws(() => validateMissionPlan(missingRiskLevel), /approval.riskLevel/);
});

test("fails when mission step role is invalid", () => {
  const plan = baseMissionPlan({
    steps: [
      {
        stepId: "qa-step",
        title: "Review evidence",
        objective: "Review the generated artifacts.",
        role: "reviewer" as never,
        dependsOn: [],
        status: "pending",
      },
    ],
  });

  assert.throws(
    () => validateMissionPlan(plan),
    /Mission step qa-step role must be one of: executor, qa_reviewer/,
  );
});

test("fails when mission evidence contract is malformed", () => {
  const missingContract = baseMissionPlan({
    steps: [
      {
        stepId: "qa-step",
        title: "Review evidence",
        objective: "Review the generated artifacts.",
        role: "qa_reviewer",
        dependsOn: [],
        status: "pending",
      },
    ],
  });
  const invalidArtifacts = baseMissionPlan({
    steps: [
      {
        stepId: "qa-step",
        title: "Review evidence",
        objective: "Review the generated artifacts.",
        role: "qa_reviewer",
        evidenceContract: {
          requiredArtifacts: "artifact-1",
          assertionType: "presence",
          assertionConfig: {},
        } as never,
        dependsOn: [],
        status: "pending",
      },
    ],
  });
  const invalidAssertion = baseMissionPlan({
    steps: [
      {
        stepId: "qa-step",
        title: "Review evidence",
        objective: "Review the generated artifacts.",
        role: "qa_reviewer",
        evidenceContract: {
          requiredArtifacts: ["artifact-1"],
          assertionType: "regex" as never,
          assertionConfig: {},
        },
        dependsOn: [],
        status: "pending",
      },
    ],
  });

  assert.throws(
    () => validateMissionPlan(missingContract),
    /Mission step qa-step with role=qa_reviewer requires evidenceContract/,
  );
  assert.throws(
    () => validateMissionPlan(invalidArtifacts),
    /Mission step qa-step evidenceContract.requiredArtifacts must be an array/,
  );
  assert.throws(
    () => validateMissionPlan(invalidAssertion),
    /Mission step qa-step evidenceContract.assertionType must be one of: presence, json_schema, content_contains/,
  );
});

test("fills default activation profile from shared defaults", () => {
  const plan = validateMissionPlan(baseMissionPlan());

  assert.deepEqual(plan.activationProfile, DEFAULT_ACTIVATION_PROFILE);
  assert.equal(plan.steps[0]?.role, "executor");
});

test("fails when mission activation profile is malformed", () => {
  const nullProfile = {
    ...baseMissionPlan(),
    activationProfile: null,
  } as unknown as MissionPlan;
  const invalidMaxAgents = {
    ...baseMissionPlan(),
    activationProfile: {
      level: "micro",
      maxAgents: 0,
      reviewIntensity: "medium",
    },
  } as MissionPlan;

  assert.throws(
    () => validateMissionPlan(nullProfile),
    /Mission plan activationProfile must be an object/,
  );
  assert.throws(
    () => validateMissionPlan(invalidMaxAgents),
    /Mission plan activationProfile.maxAgents must be a positive integer/,
  );
});

test("maps AgentRuntimePlan to a valid MissionPlan", () => {
  const runtimePlan: AgentRuntimePlan = {
    summary: "Review sources, index them, and prepare the agent.",
    mode: "dag",
    failureStrategy: "fail_fast",
    steps: [
      {
        stepId: "collect-sources",
        skillId: "web_listening",
        moduleId: "web_listening",
        title: "Collect sources",
        action: "Collect approved website sources.",
        input: { url: "https://example.com/docs" },
        requiresApproval: false,
      },
      {
        stepId: "publish-agent",
        skillId: "rag_to_agent",
        moduleId: "rag_to_agent",
        title: "Publish agent",
        action: "Publish the drafted agent configuration.",
        input: { draftId: "draft-001" },
        requiresApproval: true,
        dependsOn: ["collect-sources"],
      },
    ],
    warnings: ["Planner skipped one disabled skill."],
  };

  const missionPlan = mapAgentRuntimePlanToMissionPlan(runtimePlan, {
    missionId: "mission-123",
    title: "Launch onboarding agent",
    userGoal: "Prepare an onboarding agent from approved sources.",
    nonGoals: ["Do not create a child-agent scheduler."],
  });

  assert.equal(missionPlan.missionId, "mission-123");
  assert.equal(missionPlan.status, "needs_confirmation");
  assert.equal(missionPlan.riskLevel, "high");
  assert.deepEqual(missionPlan.activationProfile, DEFAULT_ACTIVATION_PROFILE);
  assert.deepEqual(missionPlan.warnings, ["Planner skipped one disabled skill."]);
  assert.deepEqual(missionPlan.nonGoals, ["Do not create a child-agent scheduler."]);
  assert.equal(missionPlan.steps[0]?.skillId, "web_listening");
  assert.equal(missionPlan.steps[0]?.moduleId, "web_listening");
  assert.equal(missionPlan.steps[0]?.role, "executor");
  assert.equal(missionPlan.steps[0]?.status, "pending");
  assert.equal(missionPlan.steps[1]?.skillId, "rag_to_agent");
  assert.equal(missionPlan.steps[1]?.moduleId, "rag_to_agent");
  assert.equal(missionPlan.steps[1]?.role, "executor");
  assert.equal(missionPlan.steps[1]?.status, "waiting_approval");
  assert.deepEqual(missionPlan.steps[1]?.dependsOn, ["collect-sources"]);
  assert.equal(missionPlan.steps[1]?.approval?.required, true);
  assert.match(
    missionPlan.steps[1]?.approval?.reason ?? "",
    /requires approval before execution/,
  );
  assert.equal(missionPlan.steps[1]?.approval?.riskLevel, "high");

  assert.doesNotThrow(() => validateMissionPlan(missionPlan));
});
