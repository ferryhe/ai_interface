import assert from "node:assert/strict";
import test from "node:test";

import type { AgentManifest } from "./agent-manifest";
import {
  assertMcpToolMetadataContract,
  exportMcpToolMetadata,
} from "./mcp-tool-exporter";

function agentFixture(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    agentId: "knowledge_builder",
    name: "Knowledge Builder",
    description: "Build knowledge artifacts.",
    source: "builtin",
    instructions: "Use approved sources.",
    skills: [{ skillId: "md_to_rag", required: true }],
    planner: { mode: "linear", failureStrategy: "fail_fast" },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
    memory: { promotionMode: "run_summary" },
    handoffs: [],
    tests: [],
    ...overrides,
  };
}

test("MCP exporter generates deterministic tool names from agent IDs", () => {
  assert.equal(
    exportMcpToolMetadata(agentFixture()).name,
    "run_knowledge_builder",
  );
  assert.equal(
    exportMcpToolMetadata(agentFixture({ agentId: "agent_2026_v2" })).name,
    "run_agent_2026_v2",
  );
});

test("MCP exporter returns ai_interface run wrapper input schema", () => {
  const metadata = exportMcpToolMetadata(agentFixture());

  assert.deepEqual(metadata, {
    name: "run_knowledge_builder",
    description: "Run the Knowledge Builder agent through ai_interface.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "User message to send to the agent.",
        },
        executionMode: {
          type: "string",
          enum: ["plan_only", "execute_ready"],
          description: "Whether to plan only or execute ready non-approval steps.",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  });
});

test("MCP exporter omits provider internals and redacts unsafe names", () => {
  const metadata = exportMcpToolMetadata(
    agentFixture({
      name: "Local Agent http://localhost:11434/v1 sk-proj-1234567890abcdef",
      provider: {
        provider: "ollama",
        modelId: "secret-local-model",
        reasoningEffort: "none",
      },
    }),
  );
  const serialized = JSON.stringify(metadata);

  assert.equal(serialized.includes("http://localhost:11434/v1"), false);
  assert.equal(serialized.includes("sk-proj-1234567890abcdef"), false);
  assert.equal(serialized.includes("secret-local-model"), false);
  assert.equal(serialized.includes("provider"), false);
  assert.equal(
    metadata.description,
    "Run the Local Agent [redacted] [redacted] agent through ai_interface.",
  );
});

test("MCP exporter redacts spaced and quoted local paths from descriptions", () => {
  const metadata = exportMcpToolMetadata(
    agentFixture({
      name: 'Quoted "C:\\Users\\Ferry He\\.env" and /home/ec2-user/work/My Project/.env agent',
    }),
  );
  const serialized = JSON.stringify(metadata);

  assert.equal(serialized.includes("C:\\Users\\Ferry He\\.env"), false);
  assert.equal(serialized.includes("He\\.env"), false);
  assert.equal(serialized.includes("/home/ec2-user/work/My Project/.env"), false);
  assert.equal(serialized.includes("Project/.env"), false);
  assert.match(metadata.description, /\[redacted\]/);
});

test("MCP metadata contract rejects non-deterministic input schema variants", () => {
  const metadata = exportMcpToolMetadata(agentFixture());

  assert.throws(
    () =>
      assertMcpToolMetadataContract({
        ...metadata,
        inputSchema: {
        ...metadata.inputSchema,
          required: ["message", "extra"] as unknown as ["message"],
        },
      }),
    /required must be exactly \["message"\]/,
  );
  assert.throws(
    () =>
      assertMcpToolMetadataContract({
        ...metadata,
        inputSchema: {
          ...metadata.inputSchema,
          additionalProperties: true as false,
        },
      }),
    /additionalProperties must be false/,
  );
});
