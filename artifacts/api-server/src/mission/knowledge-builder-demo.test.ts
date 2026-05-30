import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import YAML from "yaml";

import { validateMissionPlan, type MissionPlan } from "./mission-plan";

async function loadFixture(): Promise<MissionPlan> {
  const raw = await readFile(
    new URL("../../../../docs/contracts/fixtures/knowledge-builder-mission.json", import.meta.url),
    "utf8",
  );
  return JSON.parse(raw) as MissionPlan;
}

async function loadKnowledgeBuilderAgent(): Promise<{
  skills: Array<{ skillId: string; required: boolean }>;
  permissions: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
}> {
  const raw = await readFile(
    new URL("../../../../agents/builtin/knowledge_builder/agent.yaml", import.meta.url),
    "utf8",
  );
  return YAML.parse(raw) as {
    skills: Array<{ skillId: string; required: boolean }>;
    permissions: {
      approvalRequired: boolean;
      canUseNetwork: boolean;
      canWriteDatabase: boolean;
    };
  };
}

test("knowledge builder demo fixture is a valid mission plan", async () => {
  const fixture = await loadFixture();
  const validated = validateMissionPlan(structuredClone(fixture));

  assert.equal(validated.missionId, "knowledge-builder-demo-001");
  assert.equal(validated.status, "needs_confirmation");
  assert.equal(validated.riskLevel, "high");
  assert.equal(validated.steps.length, 5);
});

test("knowledge builder demo fixture contains the expected roles, skills, and approvals", async () => {
  const fixture = validateMissionPlan(structuredClone(await loadFixture()));

  const sourceCollectorSteps = fixture.steps.filter((step) => step.roleId === "source_collector");
  const knowledgeBuilderSteps = fixture.steps.filter((step) => step.roleId === "knowledge_builder");
  const qaReviewerSteps = fixture.steps.filter((step) => step.roleId === "qa_reviewer");

  assert.deepEqual(
    sourceCollectorSteps.map((step) => step.skillId),
    ["web_listening", "doc_to_md"],
  );
  assert.deepEqual(
    knowledgeBuilderSteps.map((step) => step.skillId),
    ["md_to_rag", "rag_to_agent"],
  );
  assert.equal(qaReviewerSteps.length, 1);
  assert.equal(qaReviewerSteps[0]?.skillId, undefined);

  const networkApprovalStep = fixture.steps.find((step) => step.stepId === "collect-approved-web-sources");
  assert.equal(networkApprovalStep?.status, "waiting_approval");
  assert.equal(networkApprovalStep?.approval?.required, true);
  assert.match(networkApprovalStep?.approval?.reason ?? "", /network access/i);

  const dbApprovalStep = fixture.steps.find((step) => step.stepId === "build-rag-corpus");
  assert.equal(dbApprovalStep?.status, "waiting_approval");
  assert.equal(dbApprovalStep?.approval?.required, true);
  assert.match(dbApprovalStep?.approval?.reason ?? "", /retrieval database|database/i);

  const deliveryStep = fixture.steps.find((step) => step.stepId === "generate-agent-config");
  assert.equal(deliveryStep?.skillId, "rag_to_agent");
  assert.deepEqual(deliveryStep?.dependsOn, ["build-rag-corpus"]);

  const qaStep = qaReviewerSteps[0];
  assert.deepEqual(qaStep?.dependsOn, ["build-rag-corpus", "generate-agent-config"]);

  assert.ok(
    fixture.nonGoals.some((item) => /traceability/i.test(item)),
    "demo should keep source traceability explicit",
  );
});

test("knowledge builder agent manifest matches the demo mission assumptions", async () => {
  const agent = await loadKnowledgeBuilderAgent();

  const skillRequirements = new Map(agent.skills.map((skill) => [skill.skillId, skill.required]));

  assert.equal(skillRequirements.get("web_listening"), false);
  assert.equal(skillRequirements.get("doc_to_md"), false);
  assert.equal(skillRequirements.get("md_to_rag"), true);
  assert.equal(skillRequirements.get("rag_to_agent"), true);

  assert.equal(agent.permissions.approvalRequired, true);
  assert.equal(agent.permissions.canUseNetwork, true);
  assert.equal(agent.permissions.canWriteDatabase, true);
});
