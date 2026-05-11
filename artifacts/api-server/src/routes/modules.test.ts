import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import {
  createModuleRun,
  InMemoryModuleRunRepository,
  requestModuleRunInteraction,
  submitModuleRunFeedback,
} from "../modules/ingest-service";
import { createModulesRouter } from "./modules";

async function withModulesApp<T>(
  repository: InMemoryModuleRunRepository,
  configRepository: InMemoryAgentConfigRepository,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(createModulesRouter(repository, configRepository));

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

async function createInteractiveRun(
  repository: InMemoryModuleRunRepository,
): Promise<string> {
  const { run } = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: `portal-runtime-guard-test-${randomUUID()}`,
    title: "Generate agent",
  });
  await requestModuleRunInteraction(repository, run.id, {
    kind: "approval",
    title: "Approve generated agent",
    message: "Approve this generated agent?",
    resumeHandle: "resume-generated-agent",
    metadata: { source: "agent-portal" },
  });
  return run.id;
}

test("modules route rejects Portal feedback without a token before mutating the run", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const runId = await createInteractiveRun(repository);

  const response = await withModulesApp(
    repository,
    configRepository,
    (baseUrl) =>
      fetch(`${baseUrl}/module-runs/${runId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Interface-Surface": "agent-portal",
        },
        body: JSON.stringify({
          approved: true,
          metadata: { source: "agent-portal" },
        }),
      }),
  );

  assert.equal(response.status, 403);
  const run = await repository.findModuleRunById(runId);
  assert.equal(
    run?.metadata?.["interaction"] && typeof run.metadata["interaction"],
    "object",
  );
  assert.equal(
    (run?.metadata?.["interaction"] as { status?: string }).status,
    "waiting_for_approval",
  );
});

test("modules route accepts Portal feedback with a published matching token", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const runId = await createInteractiveRun(repository);
  await updateAgentConfig(configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const response = await withModulesApp(
    repository,
    configRepository,
    (baseUrl) =>
      fetch(`${baseUrl}/module-runs/${runId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Interface-Surface": "agent-portal",
          "X-Portal-Token": "portal-secret-token",
        },
        body: JSON.stringify({
          approved: true,
          resumeHandle: "resume-generated-agent",
          metadata: { source: "agent-portal" },
        }),
      }),
  );

  const text = await response.text();
  const json = JSON.parse(text) as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(
    (json["interaction"] as { status?: string }).status,
    "resumable",
  );
  assert.equal(text.includes("portal-secret-token"), false);
});

test("modules route rejects Portal resume without a token before consuming feedback", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const runId = await createInteractiveRun(repository);
  await submitModuleRunFeedback(repository, runId, {
    approved: true,
    resumeHandle: "resume-generated-agent",
    metadata: { source: "agent-portal" },
  });

  const response = await withModulesApp(
    repository,
    configRepository,
    (baseUrl) =>
      fetch(`${baseUrl}/module-runs/${runId}/resume`, {
        method: "POST",
        headers: { "X-AI-Interface-Surface": "agent-portal" },
      }),
  );

  assert.equal(response.status, 403);
  const run = await repository.findModuleRunById(runId);
  assert.equal(
    (run?.metadata?.["interaction"] as { status?: string }).status,
    "resumable",
  );
});

test("modules route accepts Portal resume with a published matching case-insensitive bearer token", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const runId = await createInteractiveRun(repository);
  const previousBaseUrl = process.env["RAG_TO_AGENT_API_BASE_URL"];
  await updateAgentConfig(configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });
  await submitModuleRunFeedback(repository, runId, {
    approved: true,
    resumeHandle: "resume-generated-agent",
    metadata: { source: "agent-portal" },
  });

  process.env["RAG_TO_AGENT_API_BASE_URL"] = "http://127.0.0.1:1";
  try {
    const response = await withModulesApp(
      repository,
      configRepository,
      (baseUrl) =>
        fetch(`${baseUrl}/module-runs/${runId}/resume`, {
          method: "POST",
          headers: {
            Authorization: "bearer portal-secret-token",
            "X-AI-Interface-Surface": "agent-portal",
          },
        }),
    );

    const text = await response.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(
      (json["interaction"] as { status?: string }).status,
      "resumed",
    );
    assert.equal(text.includes("portal-secret-token"), false);
  } finally {
    if (previousBaseUrl === undefined) {
      delete process.env["RAG_TO_AGENT_API_BASE_URL"];
    } else {
      process.env["RAG_TO_AGENT_API_BASE_URL"] = previousBaseUrl;
    }
  }
});
