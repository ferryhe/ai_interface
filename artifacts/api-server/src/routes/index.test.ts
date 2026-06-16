import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";

import { createApiRouter } from "./index";

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
  body?: unknown;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: input.method ?? "GET",
    headers:
      input.body === undefined ? undefined : { "Content-Type": "application/json" },
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
