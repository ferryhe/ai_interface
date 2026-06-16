import assert from "node:assert/strict";
import test from "node:test";

import type { ToolAdapterDefinition } from "./adapter-registry";
import { CliToolAdapterExecutor } from "./cli-executor";
import { FakeToolAdapterExecutor } from "./executor";
import { HttpToolAdapterExecutor } from "./http-executor";
import { McpToolAdapterExecutor } from "./mcp-executor";
import { createToolAdapterExecutor } from "./executor-router";

function adapter(kind: ToolAdapterDefinition["adapterKind"]): ToolAdapterDefinition {
  return {
    adapterId: `test.${kind}.v1`,
    moduleId: "doc_to_md",
    adapterKind: kind,
    displayName: "Test Adapter",
    description: "Test adapter.",
    sourceRepo: "https://example.com/test",
    requiredEnv: [],
    optionalEnv: [],
    timeoutMs: 1000,
    maxOutputBytes: 4096,
    allowedCommands: [],
    supportsResume: false,
    readinessHint: "Configure test adapter.",
  };
}

test("defaults to the safe fake executor", () => {
  const executor = createToolAdapterExecutor(adapter("cli"), {});

  assert.equal(executor instanceof FakeToolAdapterExecutor, true);
});

test("real mode routes CLI adapters to the CLI executor", () => {
  const executor = createToolAdapterExecutor(adapter("cli"), {
    AI_INTERFACE_TOOL_EXECUTION_MODE: "real",
  });

  assert.equal(executor instanceof CliToolAdapterExecutor, true);
});

test("real mode routes HTTP adapters to the HTTP executor", () => {
  const executor = createToolAdapterExecutor(adapter("http"), {
    AI_INTERFACE_TOOL_EXECUTION_MODE: "real",
  });

  assert.equal(executor instanceof HttpToolAdapterExecutor, true);
});

test("fake mode keeps MCP adapters on the fake executor", () => {
  const executor = createToolAdapterExecutor(adapter("mcp"), {});

  assert.equal(executor instanceof FakeToolAdapterExecutor, true);
});

test("real mode routes MCP adapters to the MCP executor", () => {
  const executor = createToolAdapterExecutor(adapter("mcp"), {
    AI_INTERFACE_TOOL_EXECUTION_MODE: "real",
  });

  assert.equal(executor instanceof McpToolAdapterExecutor, true);
});

test("real mode keeps internal adapters on the safe fake executor", () => {
  const executor = createToolAdapterExecutor(adapter("internal"), {
    AI_INTERFACE_TOOL_EXECUTION_MODE: "real",
  });

  assert.equal(executor instanceof FakeToolAdapterExecutor, true);
});
