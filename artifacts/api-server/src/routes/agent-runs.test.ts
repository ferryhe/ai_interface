import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import { InMemoryAgentRuntimeRepository } from "../agent-runtime/agent-runtime-service";
import { createAgentRunsRouter } from "./agent-runs";

async function requestAgentRun(input: {
  runtimeRepository: InMemoryAgentRuntimeRepository;
  configRepository: InMemoryAgentConfigRepository;
  body: unknown;
  headers?: Record<string, string>;
}): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const app = express();
  app.use(express.json());
  app.use(
    createAgentRunsRouter(input.runtimeRepository, input.configRepository),
  );

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    const response = await fetch(`http://127.0.0.1:${port}/agent-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.headers ?? {}),
      },
      body: JSON.stringify(input.body),
    });
    const text = await response.text();
    return { status: response.status, text, json: JSON.parse(text) };
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestAgentRunDetail(input: {
  runtimeRepository: InMemoryAgentRuntimeRepository;
  configRepository: InMemoryAgentConfigRepository;
  pipelineRunId: string;
  headers?: Record<string, string>;
}): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const app = express();
  app.use(express.json());
  app.use(
    createAgentRunsRouter(input.runtimeRepository, input.configRepository),
  );

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/agent-runs/${input.pipelineRunId}`,
      {
        headers: input.headers,
      },
    );
    const text = await response.text();
    return { status: response.status, text, json: JSON.parse(text) };
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("agent run route rejects Portal-origin writes without a verified token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const response = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Run this from the frontstage Portal.",
      executionMode: "execute_ready",
      metadata: { source: "agent-portal" },
    },
  });

  assert.equal(response.status, 403);
  assert.equal(response.text.includes("Portal access denied"), true);
  assert.equal(runtimeRepository.threads.length, 0);
  assert.equal(runtimeRepository.pipelineRuns.length, 0);
  assert.equal(runtimeRepository.moduleRuns.length, 0);
});

test("agent run route accepts Portal-origin writes with a published matching token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const response = await requestAgentRun({
    runtimeRepository,
    configRepository,
    headers: {
      "X-AI-Interface-Surface": "agent-portal",
      "X-Portal-Token": "portal-secret-token",
    },
    body: {
      message: "Run this from the frontstage Portal.",
      executionMode: "execute_ready",
      metadata: { source: "agent-portal" },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.json["status"], "missing_key");
  assert.equal(runtimeRepository.threads.length, 1);
  assert.equal(runtimeRepository.pipelineRuns.length, 1);
  assert.equal(runtimeRepository.moduleRuns.length, 4);
  assert.equal(response.text.includes("portal-secret-token"), false);
});

test("agent run route keeps non-Portal runtime writes available without a portal token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const response = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Run this from the admin console.",
      metadata: { source: "mockup-sandbox" },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.json["status"], "missing_key");
  assert.equal(runtimeRepository.threads.length, 1);
});

test("agent run route rejects Portal-origin reads without a verified token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const created = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Create an admin-owned run.",
      metadata: { source: "mockup-sandbox" },
    },
  });
  const pipelineRunId = (created.json["pipelineRun"] as { id: string }).id;

  const response = await requestAgentRunDetail({
    runtimeRepository,
    configRepository,
    pipelineRunId,
    headers: { "X-AI-Interface-Surface": "agent-portal" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.text.includes("Portal access denied"), true);
});

test("agent run route accepts Portal-origin reads with a published matching token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });
  const created = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Create an admin-owned run.",
      metadata: { source: "mockup-sandbox" },
    },
  });
  const pipelineRunId = (created.json["pipelineRun"] as { id: string }).id;

  const response = await requestAgentRunDetail({
    runtimeRepository,
    configRepository,
    pipelineRunId,
    headers: {
      "X-AI-Interface-Surface": "agent-portal",
      "X-Portal-Token": "portal-secret-token",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(
    response.json["pipelineRun"] && typeof response.json["pipelineRun"],
    "object",
  );
  assert.equal(response.text.includes("portal-secret-token"), false);
});

test("agent run route keeps non-Portal reads available without a portal token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const created = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Create an admin-owned run.",
      metadata: { source: "mockup-sandbox" },
    },
  });
  const pipelineRunId = (created.json["pipelineRun"] as { id: string }).id;

  const response = await requestAgentRunDetail({
    runtimeRepository,
    configRepository,
    pipelineRunId,
  });

  assert.equal(response.status, 200);
});
