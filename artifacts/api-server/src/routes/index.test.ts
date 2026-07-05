import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";

import { createApiRouter } from "./index";
import { isPortalRuntimeRequest } from "./portal-access-guard";

async function withApiApp<T>(
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({ AI_INTERFACE_REPOSITORY_MODE: "memory" }));

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

async function requestJson(input: {
  baseUrl: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: input.method ?? "GET",
    headers:
      input.body === undefined
        ? input.headers
        : { ...input.headers, "Content-Type": "application/json" },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  return { status: response.status, json };
}

test("memory API router serves config, agent runs, and missions without DATABASE_URL", async () => {
  await withApiApp(async (baseUrl) => {
    const config = await requestJson({ baseUrl, path: "/api/agent-config" });
    assert.equal(config.status, 200);
    assert.equal(
      (config.json["connection"] as { status: string }).status,
      "missing_key",
    );

    const updatedConfig = await requestJson({
      baseUrl,
      path: "/api/agent-config",
      method: "PUT",
      body: {
        provider: "deterministic",
        endpoint: "responses",
        modelId: "deterministic-v1",
        reasoningEffort: "none",
      },
    });
    assert.equal(updatedConfig.status, 200);
    assert.equal(
      (updatedConfig.json["connection"] as { status: string }).status,
      "configured",
    );

    const run = await requestJson({
      baseUrl,
      path: "/api/agent-runs",
      method: "POST",
      body: {
        message: "Prepare a local memory-mode E2E run.",
        executionMode: "plan_only",
        enabledSkillIds: ["doc_to_md"],
        metadata: { source: "memory-router-test" },
      },
    });
    assert.equal(run.status, 201);
    assert.equal(typeof (run.json["pipelineRun"] as { id: string }).id, "string");

    const mission = await requestJson({
      baseUrl,
      path: "/api/missions",
      method: "POST",
      body: {
        message: "Prepare a local memory-mode mission.",
        enabledSkillIds: ["doc_to_md"],
      },
    });
    assert.equal(mission.status, 201);
    assert.equal(
      (mission.json["mission"] as { status: string }).status,
      "needs_confirmation",
    );
  });
});

test("Portal surface classifier ignores non-string metadata.source", () => {
  assert.equal(
    isPortalRuntimeRequest(
      { headers: {} } as Parameters<typeof isPortalRuntimeRequest>[0],
      { source: 123 },
    ),
    false,
  );
});

test("memory API router denies Portal access to non-allowlisted admin surfaces", async () => {
  await withApiApp(async (baseUrl) => {
    const agents = await requestJson({
      baseUrl,
      path: "/api/agents",
      headers: { "X-AI-Interface-Surface": "agent-portal" },
    });
    assert.equal(agents.status, 403);
    assert.match(String(agents.json["error"]), /Portal runtime is not allowed/);

    const mixedCaseAgents = await requestJson({
      baseUrl,
      path: "/api/agents",
      headers: { "X-AI-Interface-Surface": " Agent-Portal " },
    });
    assert.equal(mixedCaseAgents.status, 403);
    assert.match(
      String(mixedCaseAgents.json["error"]),
      /Portal runtime is not allowed/,
    );

    const metadataOnlyPortal = await requestJson({
      baseUrl,
      path: "/api/module-runs",
      method: "POST",
      body: { metadata: { source: " Agent-Portal " } },
    });
    assert.equal(metadataOnlyPortal.status, 403);
    assert.match(
      String(metadataOnlyPortal.json["error"]),
      /Portal runtime is not allowed/,
    );

    const health = await requestJson({
      baseUrl,
      path: "/api/healthz",
      headers: { "X-AI-Interface-Surface": "agent-portal" },
    });
    assert.equal(health.status, 403);
    assert.match(String(health.json["error"]), /Portal runtime is not allowed/);

    const verification = await requestJson({
      baseUrl,
      path: "/api/portal-auth/verify",
      method: "POST",
      headers: { "X-AI-Interface-Surface": "agent-portal" },
      body: { token: "" },
    });
    assert.notEqual(verification.status, 403);
  });
});

test("memory API router protects governance read surfaces with the local admin guard", async () => {
  await withApiApp(async (baseUrl) => {
    const responses = await Promise.all([
      requestJson({
        baseUrl,
        path: "/api/agents",
        headers: { "Sec-Fetch-Site": "cross-site" },
      }),
      requestJson({
        baseUrl,
        path: "/api/skills",
        headers: { "Sec-Fetch-Site": "cross-site" },
      }),
      requestJson({
        baseUrl,
        path: "/api/modules",
        headers: { "Sec-Fetch-Site": "cross-site" },
      }),
      requestJson({
        baseUrl,
        path: "/api/climate-monitor/status",
        headers: { "Sec-Fetch-Site": "cross-site" },
      }),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [403, 403, 403, 403],
    );
    for (const response of responses) {
      assert.match(String(response.json["error"]), /Cross-site local admin read/);
    }
  });
});
