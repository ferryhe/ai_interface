import assert from "node:assert/strict";
import test from "node:test";

import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import type { AgentManifest } from "./agent-manifest";
import { createAgentRuntimeRegistry } from "./agent-runtime-registry";

function agentManifest(): AgentManifest {
  return {
    agentId: "custom_agent",
    name: "Custom Agent",
    description: "Coordinates a custom skill.",
    source: "custom",
    instructions: "Use approved skills.",
    skills: [
      { skillId: "known_skill", required: true },
      { skillId: "missing_skill", required: false },
    ],
    planner: {
      mode: "linear",
      failureStrategy: "fail_fast",
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
    memory: {
      promotionMode: "run_summary",
    },
    handoffs: [],
    tests: [],
  };
}

function skillManifest(): SkillManifest {
  return {
    skillId: "known_skill",
    moduleId: "known_skill",
    name: "Known Skill",
    description: "Known skill manifest.",
    category: "agent",
    project: {
      source: "external",
      defaultSiblingPath: "../known_skill",
    },
    execution: {
      kind: "internal",
      adapterId: "known_skill.internal.v1",
      requiredEnv: [],
      optionalEnv: [],
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      allowedCommands: [],
      supportsResume: false,
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    interactionKinds: [],
    artifactKinds: [],
    ui: {
      mode: "auto",
      openOnTrigger: false,
      preferredRenderer: "json",
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  };
}

test("registry reports missing skill references without crashing listing", () => {
  const registry = createAgentRuntimeRegistry(
    [agentManifest()],
    createSkillRuntimeRegistry([skillManifest()]),
  );

  assert.deepEqual(registry.listAgentIds(), ["custom_agent"]);
  assert.deepEqual(registry.listSkillIdsForAgent("custom_agent"), [
    "known_skill",
    "missing_skill",
  ]);
  assert.deepEqual(registry.validateSkillReferences(), [
    {
      agentId: "custom_agent",
      missingSkillIds: ["missing_skill"],
    },
  ]);
});

test("registry returns clones instead of mutable internals", () => {
  const registry = createAgentRuntimeRegistry(
    [agentManifest()],
    createSkillRuntimeRegistry([skillManifest()]),
  );

  const listed = registry.listAgents();
  listed[0]!.skills[0]!.skillId = "mutated";
  const fetched = registry.getAgent("custom_agent");

  assert.equal(fetched?.skills[0]?.skillId, "known_skill");
  assert.equal(registry.hasAgent("custom_agent"), true);
  assert.equal(registry.getAgent("missing"), null);
});
