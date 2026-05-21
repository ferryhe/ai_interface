import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";

import type { AgentManifest } from "../agent-registry/agent-manifest";
import { createAgentRuntimeRegistry } from "../agent-registry/agent-runtime-registry";
import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import { createAgentsRouter } from "./agents";

async function withAgentsApp<T>(
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  const skillRegistry = createSkillRuntimeRegistry([customSkill()]);
  const agentRegistry = createAgentRuntimeRegistry(
    [customAgent()],
    skillRegistry,
  );
  app.use(createAgentsRouter(agentRegistry));

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function customAgent(): AgentManifest {
  return {
    agentId: "custom_agent",
    name: "Custom Agent",
    description: "Coordinates a custom skill.",
    source: "custom",
    instructions: "Use approved skills.",
    skills: [{ skillId: "custom_skill", required: true }],
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

function customSkill(): SkillManifest {
  return {
    skillId: "custom_skill",
    moduleId: "custom_skill",
    name: "Custom Skill",
    description: "Custom skill manifest.",
    category: "agent",
    project: {
      source: "external",
      defaultSiblingPath: "../custom_skill",
    },
    execution: {
      kind: "internal",
      adapterId: "custom_skill.internal.v1",
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

test("/agents serves an injected registry with readiness", async () => {
  const response = await withAgentsApp((baseUrl) => fetch(`${baseUrl}/agents`));
  const json = (await response.json()) as {
    agents: Array<{
      agentId: string;
      source: string;
      skills: Array<{ skillId: string; required: boolean }>;
    }>;
    readiness: Array<{
      agentId: string;
      status: string;
      missingSkillIds: string[];
      enabledSkillIds: string[];
    }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(json.agents, [
    {
      agentId: "custom_agent",
      name: "Custom Agent",
      description: "Coordinates a custom skill.",
      source: "custom",
      instructions: "Use approved skills.",
      skills: [{ skillId: "custom_skill", required: true }],
      planner: { mode: "linear", failureStrategy: "fail_fast" },
      permissions: {
        approvalRequired: false,
        canUseNetwork: false,
        canWriteDatabase: true,
      },
      memory: { promotionMode: "run_summary" },
      handoffs: [],
      tests: [],
    },
  ]);
  assert.deepEqual(json.readiness, [
    {
      agentId: "custom_agent",
      status: "ready",
      missingSkillIds: [],
      enabledSkillIds: ["custom_skill"],
    },
  ]);
});
