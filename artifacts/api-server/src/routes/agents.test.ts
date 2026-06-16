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
  agents: AgentManifest[] = [customAgent()],
): Promise<T> {
  const app = express();
  const skillRegistry = createSkillRuntimeRegistry([customSkill()]);
  const agentRegistry = createAgentRuntimeRegistry(agents, skillRegistry);
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

function customAgent(options: {
  agentId?: string;
  name?: string;
  description?: string;
  teamId?: string;
  runtimeStatus?: "runnable" | "template";
  skillId?: string;
} = {}): AgentManifest {
  const skillId = options.skillId ?? "custom_skill";
  return {
    agentId: options.agentId ?? "custom_agent",
    name: options.name ?? "Custom Agent",
    description: options.description ?? "Coordinates a custom skill.",
    source: "custom",
    instructions: "Use approved skills.",
    skills: [{ skillId, required: true }],
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
    ...(options.teamId ? { teamId: options.teamId } : {}),
    ...(options.runtimeStatus
      ? { runtimeStatus: options.runtimeStatus }
      : {}),
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
      runtimeStatus: "runnable",
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

test("/agents filters agents and readiness by teamId and runtimeStatus", async () => {
  const response = await withAgentsApp(
    (baseUrl) =>
      fetch(`${baseUrl}/agents?teamId=insurance&runtimeStatus=template`),
    [
      customAgent({
        agentId: "pricing_actuary",
        name: "Pricing Actuary",
        teamId: "insurance",
        runtimeStatus: "template",
        skillId: "custom_skill",
      }),
      customAgent({
        agentId: "claims_runner",
        name: "Claims Runner",
        teamId: "insurance",
        runtimeStatus: "runnable",
        skillId: "custom_skill",
      }),
      customAgent({
        agentId: "knowledge_builder",
        name: "Knowledge Builder",
        teamId: "knowledge",
        runtimeStatus: "template",
        skillId: "missing_skill",
      }),
    ],
  );
  const json = (await response.json()) as {
    agents: Array<{ agentId: string; teamId?: string; runtimeStatus?: string }>;
    readiness: Array<{ agentId: string }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.agents.map((agent) => ({
      agentId: agent.agentId,
      teamId: agent.teamId,
      runtimeStatus: agent.runtimeStatus,
    })),
    [
      {
        agentId: "pricing_actuary",
        teamId: "insurance",
        runtimeStatus: "template",
      },
    ],
  );
  assert.deepEqual(
    json.readiness.map((item) => item.agentId),
    ["pricing_actuary"],
  );
});

test("/agents rejects repeated or invalid filters", async () => {
  await withAgentsApp(async (baseUrl) => {
    const repeatedTeam = await fetch(
      `${baseUrl}/agents?teamId=insurance&teamId=knowledge`,
    );
    const repeatedStatus = await fetch(
      `${baseUrl}/agents?runtimeStatus=template&runtimeStatus=runnable`,
    );
    const invalidStatus = await fetch(
      `${baseUrl}/agents?runtimeStatus=archived`,
    );

    assert.equal(repeatedTeam.status, 400);
    assert.equal(repeatedStatus.status, 400);
    assert.equal(invalidStatus.status, 400);
  });
});

test("/agents/:agentId/export/vscode-agent returns VS Code agent markdown", async () => {
  const response = await withAgentsApp((baseUrl) =>
    fetch(`${baseUrl}/agents/custom_agent/export/vscode-agent`),
  );
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type")?.includes("text/markdown"),
    true,
  );
  assert.match(
    text,
    /^---\ndescription: Coordinates a custom skill\.\ntools:\n  - custom_skill\n---\n\nUse approved skills\./,
  );
});

test("/agents/:agentId/export/mcp-tool returns MCP wrapper metadata", async () => {
  const response = await withAgentsApp((baseUrl) =>
    fetch(`${baseUrl}/agents/custom_agent/export/mcp-tool`),
  );
  const json = (await response.json()) as {
    name: string;
    description: string;
    inputSchema: {
      required: string[];
      properties: { executionMode: { enum: string[] } };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(json.name, "run_custom_agent");
  assert.equal(
    json.description,
    "Run the Custom Agent agent through ai_interface.",
  );
  assert.deepEqual(json.inputSchema.required, ["message"]);
  assert.deepEqual(json.inputSchema.properties.executionMode.enum, [
    "plan_only",
    "execute_ready",
  ]);
});

test("agent export endpoints return 404 for unknown agents", async () => {
  await withAgentsApp(async (baseUrl) => {
    const vscodeResponse = await fetch(
      `${baseUrl}/agents/unknown_agent/export/vscode-agent`,
    );
    const mcpResponse = await fetch(
      `${baseUrl}/agents/unknown_agent/export/mcp-tool`,
    );

    assert.equal(vscodeResponse.status, 404);
    assert.equal(mcpResponse.status, 404);
  });
});
