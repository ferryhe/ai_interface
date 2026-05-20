import assert from "node:assert/strict";
import test from "node:test";

import type { JsonObject, ModuleRunRecord } from "../modules/ingest-service";
import type { ToolAdapterDefinition, ToolAdapterReadiness } from "./adapter-registry";
import type { ToolExecutionRequest } from "./executor";
import {
  McpToolAdapterExecutor,
  type McpToolCaller,
} from "./mcp-executor";

function mcpAdapter(
  input: Partial<ToolAdapterDefinition> = {},
): ToolAdapterDefinition {
  return {
    adapterId: "test.mcp.v1",
    moduleId: "rag_to_agent",
    adapterKind: "mcp",
    displayName: "Test MCP",
    description: "Test MCP adapter.",
    sourceRepo: "https://example.com/test-mcp",
    requiredEnv: ["TEST_MCP_SERVER_URL"],
    optionalEnv: ["TEST_MCP_AUTH_TOKEN"],
    timeoutMs: 1000,
    maxOutputBytes: 4096,
    allowedCommands: [],
    supportsResume: false,
    readinessHint: "Set TEST_MCP_SERVER_URL.",
    mcpServerEnv: "TEST_MCP_SERVER_URL",
    mcpToolName: "test.tool",
    ...input,
  };
}

function run(inputJson: JsonObject | null = { prompt: "hello" }): ModuleRunRecord {
  const now = new Date();
  return {
    id: "run-1",
    pipelineRunId: null,
    moduleId: "rag_to_agent",
    externalRunId: "external-run-1",
    title: null,
    status: "running",
    inputJson,
    outputJson: null,
    summary: null,
    metadata: null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function request(
  adapter: ToolAdapterDefinition,
  inputJson: JsonObject | null = { prompt: "hello" },
): ToolExecutionRequest {
  return {
    run: run(inputJson),
    adapter,
    readiness: {
      ...adapter,
      configured: true,
      status: "ready",
      missingRequiredEnv: [],
      configuredOptionalEnv: [],
    } satisfies ToolAdapterReadiness,
  };
}

test("rejects missing server env before calling MCP transport", async () => {
  let called = false;
  const caller: McpToolCaller = async () => {
    called = true;
    return { content: [] };
  };

  const result = await new McpToolAdapterExecutor({}, caller).execute(
    request(mcpAdapter()),
  );

  assert.equal(called, false);
  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.mcp_configuration_failed");
  assert.match(result.summary ?? "", /server/i);
});

test("rejects missing MCP tool name before calling MCP transport", async () => {
  let called = false;
  const caller: McpToolCaller = async () => {
    called = true;
    return { content: [] };
  };

  const result = await new McpToolAdapterExecutor(
    { TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp" },
    caller,
  ).execute(request(mcpAdapter({ mcpToolName: undefined })));

  assert.equal(called, false);
  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.mcp_configuration_failed");
  assert.match(result.summary ?? "", /tool name/i);
});

test("maps a successful mocked MCP tool call to succeeded", async () => {
  const observedRequests: Parameters<McpToolCaller>[0][] = [];
  const caller: McpToolCaller = async (callRequest) => {
    observedRequests.push(callRequest);
    return {
      content: [
        { type: "text", text: "completed" },
        { type: "json", json: { ok: true, count: 2 } },
      ],
    };
  };

  const result = await new McpToolAdapterExecutor(
    { TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp" },
    caller,
  ).execute(request(mcpAdapter(), { prompt: "summarize" }));

  assert.equal(result.status, "succeeded");
  assert.equal(result.eventType, "tool.execution.mcp_completed");
  assert.deepEqual(result.outputJson?.["content"], [
    { type: "text", text: "completed" },
    { type: "json", json: { ok: true, count: 2 } },
  ]);
  assert.equal(result.outputJson?.["contentTruncated"], false);
  const observedRequest = observedRequests[0];
  assert.ok(observedRequest);
  assert.equal(observedRequest?.toolName, "test.tool");
  assert.equal(observedRequest?.serverUrl, "http://127.0.0.1:7331/mcp");
  assert.deepEqual(observedRequest?.input, { prompt: "summarize" });
});

test("maps a mocked MCP tool error to failed", async () => {
  const caller: McpToolCaller = async () => ({
    isError: true,
    content: [{ type: "text", text: "tool rejected input" }],
  });

  const result = await new McpToolAdapterExecutor(
    { TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp" },
    caller,
  ).execute(request(mcpAdapter()));

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.mcp_failed");
  assert.equal(result.outputJson?.["isError"], true);
  assert.equal(result.eventSeverity, "error");
});

test("truncates large MCP tool result content", async () => {
  const caller: McpToolCaller = async () => ({
    content: [
      {
        type: "text",
        text: "abcdefghijklmnopqrstuvwxyz",
      },
    ],
  });

  const result = await new McpToolAdapterExecutor(
    { TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp" },
    caller,
  ).execute(request(mcpAdapter({ maxOutputBytes: 16 })));

  assert.equal(result.status, "succeeded");
  assert.equal(result.outputJson?.["contentTruncated"], true);
  assert.equal(JSON.stringify(result).includes("qrstuvwxyz"), false);
});

test("redacts server URL, auth token, and raw header-like content", async () => {
  const serverUrl = "http://127.0.0.1:7331/mcp";
  const token = "secret-mcp-token";
  const caller: McpToolCaller = async () => ({
    content: [
      {
        type: "text",
        text: `callback=${serverUrl} Authorization: Bearer ${token}`,
      },
      {
        type: "json",
        json: {
          callback: serverUrl,
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      },
    ],
  });

  const result = await new McpToolAdapterExecutor(
    {
      TEST_MCP_SERVER_URL: serverUrl,
      TEST_MCP_AUTH_TOKEN: token,
    },
    caller,
  ).execute(request(mcpAdapter()));
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "succeeded");
  assert.equal(serialized.includes(serverUrl), false);
  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes("Authorization: Bearer"), false);
});

test("redacts JSON-quoted header text and escaped env values from MCP content", async () => {
  const serverUrl = "http://127.0.0.1:7331/mcp";
  const token = "secret/mcp-token";
  const escapedServerUrl = serverUrl.split("/").join("\\/");
  const escapedToken = token.split("/").join("\\/");
  const caller: McpToolCaller = async () => ({
    content: [
      {
        type: "text",
        text:
          `{"authorization":"Bearer leaked-header-token",` +
          `"x-api-key":"leaked-api-key",` +
          `"callback":"${escapedServerUrl}",` +
          `"token":"${escapedToken}"}`,
      },
    ],
  });

  const result = await new McpToolAdapterExecutor(
    {
      TEST_MCP_SERVER_URL: serverUrl,
      TEST_MCP_AUTH_TOKEN: token,
    },
    caller,
  ).execute(request(mcpAdapter()));
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "succeeded");
  assert.equal(serialized.includes("leaked-header-token"), false);
  assert.equal(serialized.includes("leaked-api-key"), false);
  assert.equal(serialized.includes(escapedServerUrl), false);
  assert.equal(serialized.includes(escapedToken), false);
});

test("redacts JSON-quoted headers and escaped env values from MCP errors", async () => {
  const serverUrl = "http://127.0.0.1:7331/mcp";
  const token = "secret/mcp-token";
  const escapedServerUrl = serverUrl.split("/").join("\\/");
  const escapedToken = token.split("/").join("\\/");
  const caller: McpToolCaller = async () => {
    throw new Error(
      `failed with {"authorization":"Bearer leaked-error-token",` +
        `"x-api-key":"leaked-error-api-key",` +
        `"callback":"${escapedServerUrl}",` +
        `"token":"${escapedToken}"}`,
    );
  };

  const result = await new McpToolAdapterExecutor(
    {
      TEST_MCP_SERVER_URL: serverUrl,
      TEST_MCP_AUTH_TOKEN: token,
    },
    caller,
  ).execute(request(mcpAdapter()));
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.mcp_failed");
  assert.equal(serialized.includes("leaked-error-token"), false);
  assert.equal(serialized.includes("leaked-error-api-key"), false);
  assert.equal(serialized.includes(escapedServerUrl), false);
  assert.equal(serialized.includes(escapedToken), false);
});

test("cancels a non-OK MCP HTTP response body before failing", async () => {
  const originalFetch = globalThis.fetch;
  let bodyCanceled = false;
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("MCP failed"));
        },
        cancel() {
          bodyCanceled = true;
        },
      }),
      { status: 500 },
    )) as typeof fetch;

  try {
    const result = await new McpToolAdapterExecutor({
      TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp",
    }).execute(request(mcpAdapter()));

    assert.equal(result.status, "failed");
    assert.equal(result.eventType, "tool.execution.mcp_failed");
    assert.equal(bodyCanceled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("times out unresolved MCP tool calls", async () => {
  let signalAborted = false;
  const caller: McpToolCaller = async (callRequest) => {
    callRequest.signal.addEventListener("abort", () => {
      signalAborted = true;
    });
    return new Promise(() => {});
  };
  const startedAt = Date.now();

  const result = await new McpToolAdapterExecutor(
    { TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp" },
    caller,
  ).execute(request(mcpAdapter({ timeoutMs: 10 })));

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.mcp_timeout");
  assert.equal(result.eventSeverity, "warning");
  assert.equal(signalAborted, true);
  assert.ok(Date.now() - startedAt < 500);
});
