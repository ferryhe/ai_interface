import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import { InMemoryAgentConfigRepository } from "../agent-config/agent-config-service";
import type { AgentManifest } from "../agent-registry/agent-manifest";
import { createAgentRuntimeRegistry } from "../agent-registry/agent-runtime-registry";
import {
  createAgentRun,
  InMemoryAgentRuntimeRepository,
} from "../agent-runtime/agent-runtime-service";
import {
  createModuleRun,
  recordModuleRunArtifact,
  recordModuleRunEvent,
} from "../modules/ingest-service";
import { createRunInspectorRouter } from "./run-inspector";

function testAgentManifest(
  overrides: Partial<AgentManifest> = {},
): AgentManifest {
  return {
    agentId: "knowledge_builder",
    name: "Knowledge Builder",
    description:
      "Turn approved web and document sources into a RAG-backed agent configuration.",
    source: "builtin",
    instructions: "Build an inspectable knowledge pipeline.",
    skills: [
      { skillId: "web_listening", required: false },
      { skillId: "doc_to_md", required: false },
      { skillId: "md_to_rag", required: true },
      { skillId: "rag_to_agent", required: true },
    ],
    planner: {
      mode: "linear",
      failureStrategy: "fail_fast",
    },
    permissions: {
      approvalRequired: true,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
    memory: {
      promotionMode: "run_summary",
    },
    handoffs: [],
    tests: [],
    ...overrides,
  };
}

async function withInspectorApp<T>(
  repository: InMemoryAgentRuntimeRepository,
  callback: (baseUrl: string) => Promise<T>,
  options: {
    env?: Record<string, string | undefined>;
  } = {},
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(createRunInspectorRouter(repository, options));

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

test("GET /runs?agentId=knowledge_builder returns only runs with matching agent metadata", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const agentRegistry = createAgentRuntimeRegistry([testAgentManifest()]);
  const matching = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Build a knowledge agent.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["md_to_rag"],
    },
    { env: {}, agentRegistry },
  );
  await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert a document without an agent.",
      enabledSkillIds: ["doc_to_md"],
    },
    { env: {} },
  );

  const response = await withInspectorApp(runtimeRepository, (baseUrl) =>
    fetch(`${baseUrl}/runs?agentId=knowledge_builder`),
  );
  const json = (await response.json()) as {
    runs: Array<{ pipelineRun: { id: string; metadata: { agentId?: string } } }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.runs.map((run) => run.pipelineRun.id),
    [matching.pipelineRun.id],
  );
  assert.equal(json.runs[0]?.pipelineRun.metadata.agentId, "knowledge_builder");
});

test("GET /runs?skillId=md_to_rag returns runs with at least one matching module run", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const matching = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Index approved Markdown.",
      enabledSkillIds: ["md_to_rag"],
    },
    { env: {} },
  );
  await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Only convert source documents.",
      enabledSkillIds: ["doc_to_md"],
    },
    { env: {} },
  );

  const response = await withInspectorApp(runtimeRepository, (baseUrl) =>
    fetch(`${baseUrl}/runs?skillId=md_to_rag`),
  );
  const json = (await response.json()) as {
    runs: Array<{
      pipelineRun: { id: string };
      moduleRuns: Array<{ moduleId: string; metadata: { skillId?: string } }>;
    }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.runs.map((run) => run.pipelineRun.id),
    [matching.pipelineRun.id],
  );
  assert.equal(json.runs[0]?.moduleRuns[0]?.metadata.skillId, "md_to_rag");
});

test("GET /runs/:pipelineRunId/timeline returns run events in creation order", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const thread = await repository.createThread({
    title: "Timeline test",
    metadata: null,
  });
  await repository.createMessage({
    threadId: thread.id,
    role: "user",
    content: "Show event ordering.",
    metadata: null,
  });
  const pipelineRun = await repository.createPipelineRun({
    threadId: thread.id,
    title: "Timeline test",
    status: "pending",
    activeModuleId: "doc_to_md",
    metadata: null,
  });
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `timeline-${randomUUID()}`,
    pipelineRunId: pipelineRun.id,
    title: "Convert document",
  });

  const later = await recordModuleRunEvent(repository, run.id, {
    eventType: "timeline.later",
    title: "Later",
  });
  const earlier = await recordModuleRunEvent(repository, run.id, {
    eventType: "timeline.earlier",
    title: "Earlier",
  });
  later.createdAt = new Date("2026-05-21T12:00:02.000Z");
  earlier.createdAt = new Date("2026-05-21T12:00:01.000Z");

  const response = await withInspectorApp(repository, (baseUrl) =>
    fetch(`${baseUrl}/runs/${pipelineRun.id}/timeline`),
  );
  const json = (await response.json()) as {
    messages: Array<{ role: string }>;
    pipelineRun: { id: string };
    moduleRuns: Array<{ id: string }>;
    runEvents: Array<{ eventType: string }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.runEvents.map((event) => event.eventType),
    ["timeline.earlier", "timeline.later"],
  );
  assert.deepEqual(
    json.messages.map((message) => message.role),
    ["user"],
  );
  assert.equal(json.pipelineRun.id, pipelineRun.id);
  assert.deepEqual(
    json.moduleRuns.map((moduleRun) => moduleRun.id),
    [run.id],
  );
});

test("GET /artifacts?pipelineRunId returns artifacts from all module runs in that pipeline", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const firstPipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Pipeline with artifacts",
    status: "pending",
    activeModuleId: "doc_to_md",
    metadata: null,
  });
  const otherPipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Other pipeline",
    status: "pending",
    activeModuleId: "rag_to_agent",
    metadata: null,
  });
  const firstModule = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `artifact-doc-${randomUUID()}`,
    pipelineRunId: firstPipelineRun.id,
    title: "Convert document",
  });
  const secondModule = await createModuleRun(repository, {
    moduleId: "md_to_rag",
    externalRunId: `artifact-rag-${randomUUID()}`,
    pipelineRunId: firstPipelineRun.id,
    title: "Index Markdown",
  });
  const otherModule = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: `artifact-agent-${randomUUID()}`,
    pipelineRunId: otherPipelineRun.id,
    title: "Publish Agent",
  });
  await recordModuleRunArtifact(repository, firstModule.run.id, {
    artifactKind: "markdown",
    title: "Converted Markdown",
  });
  await recordModuleRunArtifact(repository, secondModule.run.id, {
    artifactKind: "rag_records",
    title: "RAG Records",
  });
  await recordModuleRunArtifact(repository, otherModule.run.id, {
    artifactKind: "agent_config",
    title: "Other Agent Config",
  });

  const response = await withInspectorApp(repository, (baseUrl) =>
    fetch(`${baseUrl}/artifacts?pipelineRunId=${firstPipelineRun.id}`),
  );
  const json = (await response.json()) as {
    artifacts: Array<{ artifactKind: string; title: string }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.artifacts.map((artifact) => artifact.title),
    ["Converted Markdown", "RAG Records"],
  );
  assert.deepEqual(
    json.artifacts.map((artifact) => artifact.artifactKind),
    ["markdown", "rag_records"],
  );
});

test("inspector routes return 400 for invalid generated request parameters", async () => {
  const repository = new InMemoryAgentRuntimeRepository();

  await withInspectorApp(repository, async (baseUrl) => {
    const responses = await Promise.all([
      fetch(`${baseUrl}/runs?agentId=Bad-Agent`),
      fetch(`${baseUrl}/runs?status=unknown`),
      fetch(`${baseUrl}/runs?limit=0`),
      fetch(`${baseUrl}/runs/not-a-uuid/timeline`),
      fetch(`${baseUrl}/artifacts?pipelineRunId=not-a-uuid`),
      fetch(`${baseUrl}/artifacts?moduleRunId=not-a-uuid`),
      fetch(`${baseUrl}/artifacts?limit=201`),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [400, 400, 400, 400, 400, 400, 400],
    );
  });
});

test("inspector responses redact configured env values and token-like payloads", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const env = {
    OPENAI_API_KEY: "sk-test-secret",
    OLLAMA_API_BASE_URL: "http://127.0.0.1:11434",
    TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp",
    AI_ACTUARY_PROJECT_PATH: "C:\\Sensitive\\ai_actuary",
  };
  const thread = await repository.createThread({
    title: "Redaction test",
    metadata: null,
  });
  const pipelineRun = await repository.createPipelineRun({
    threadId: thread.id,
    title: "Redaction test",
    status: "pending",
    activeModuleId: "doc_to_md",
    metadata: {
      providerKey: env.OPENAI_API_KEY,
      localProviderUrl: env.OLLAMA_API_BASE_URL,
    },
  });
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `redaction-${randomUUID()}`,
    pipelineRunId: pipelineRun.id,
    title: "Convert secrets",
    inputJson: {
      path: env.AI_ACTUARY_PROJECT_PATH,
      mcpServerUrl: env.TEST_MCP_SERVER_URL,
      headers: { authorization: "Bearer raw-header-token" },
    },
    metadata: { token: "metadata-token" },
  });
  await recordModuleRunEvent(repository, run.id, {
    eventType: "redaction.event",
    payload: {
      apiKey: env.OPENAI_API_KEY,
      callback: env.TEST_MCP_SERVER_URL,
    },
  });
  await recordModuleRunArtifact(repository, run.id, {
    artifactKind: "markdown",
    title: "Secret artifact",
    contentText: `url=${env.OLLAMA_API_BASE_URL} path=${env.AI_ACTUARY_PROJECT_PATH}`,
    contentJson: { token: "artifact-token" },
    provenance: { mcp: env.TEST_MCP_SERVER_URL },
  });

  const timelineResponse = await withInspectorApp(
    repository,
    (baseUrl) => fetch(`${baseUrl}/runs/${pipelineRun.id}/timeline`),
    { env },
  );
  const artifactsResponse = await withInspectorApp(
    repository,
    (baseUrl) => fetch(`${baseUrl}/artifacts?pipelineRunId=${pipelineRun.id}`),
    { env },
  );
  const serialized = `${await timelineResponse.text()}\n${await artifactsResponse.text()}`;

  assert.equal(timelineResponse.status, 200);
  assert.equal(artifactsResponse.status, 200);
  for (const value of Object.values(env)) {
    assert.equal(serialized.includes(value), false, value);
  }
  assert.equal(serialized.includes("raw-header-token"), false);
  assert.equal(serialized.includes("metadata-token"), false);
  assert.equal(serialized.includes("artifact-token"), false);
});

test("inspector responses redact credential-like response keys even when values are not configured env values", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const credentials = {
    apiKey: "tool-returned-api-key",
    accessToken: "tool-returned-access-token",
    refreshToken: "tool-returned-refresh-token",
    bearerToken: "tool-returned-bearer-token",
    clientSecret: "tool-returned-client-secret",
    clientToken: "tool-returned-client-token",
  };
  const thread = await repository.createThread({
    title: "Response key redaction test",
    metadata: null,
  });
  const pipelineRun = await repository.createPipelineRun({
    threadId: thread.id,
    title: "Response key redaction test",
    status: "pending",
    activeModuleId: "doc_to_md",
    metadata: { nestedCredential: { ...credentials }, tokenCount: 7 },
  });
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `response-key-redaction-${randomUUID()}`,
    pipelineRunId: pipelineRun.id,
    title: "Return credential-like keys",
    outputJson: {
      ...credentials,
      tokenCount: 7,
      nested: {
        accessToken: credentials.accessToken,
        clientSecret: credentials.clientSecret,
      },
    },
  });
  await recordModuleRunEvent(repository, run.id, {
    eventType: "response-key.redaction",
    payload: {
      ...credentials,
      tokenCount: 7,
    },
  });
  await recordModuleRunArtifact(repository, run.id, {
    artifactKind: "markdown",
    title: "Credential-like key artifact",
    contentJson: {
      ...credentials,
      tokenCount: 7,
    },
  });

  const timelineResponse = await withInspectorApp(
    repository,
    (baseUrl) => fetch(`${baseUrl}/runs/${pipelineRun.id}/timeline`),
    { env: {} },
  );
  const artifactsResponse = await withInspectorApp(
    repository,
    (baseUrl) => fetch(`${baseUrl}/artifacts?pipelineRunId=${pipelineRun.id}`),
    { env: {} },
  );
  const serialized = `${await timelineResponse.text()}\n${await artifactsResponse.text()}`;

  assert.equal(timelineResponse.status, 200);
  assert.equal(artifactsResponse.status, 200);
  for (const value of Object.values(credentials)) {
    assert.equal(serialized.includes(value), false, value);
  }
  assert.equal(serialized.includes('"tokenCount":7'), true);
});

test("inspector responses redact configured adapter and workdir env values from skill manifests", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const env = {
    EXAMPLE_REPORTER_ENABLED: "example-reporter-enabled-secret",
    WEB_LISTENING_WORKDIR: "C:\\Sensitive\\web-listening-workdir",
    CROSS2_WORKDIR: "C:\\Sensitive\\cross2-workdir",
    CROSS2_PROJECT_PATH: "C:\\Sensitive\\cross2-project",
  };
  const thread = await repository.createThread({
    title: "Adapter env redaction test",
    metadata: null,
  });
  const pipelineRun = await repository.createPipelineRun({
    threadId: thread.id,
    title: "Adapter env redaction test",
    status: "pending",
    activeModuleId: "web_listening",
    metadata: {
      exampleReporterFlag: env.EXAMPLE_REPORTER_ENABLED,
      crossProjectPath: env.CROSS2_PROJECT_PATH,
    },
  });
  const { run } = await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: `adapter-redaction-${randomUUID()}`,
    pipelineRunId: pipelineRun.id,
    title: "Read adapter env values",
    inputJson: {
      workdir: env.WEB_LISTENING_WORKDIR,
      downstreamWorkdir: env.CROSS2_WORKDIR,
    },
  });
  await recordModuleRunEvent(repository, run.id, {
    eventType: "adapter.redaction.event",
    payload: {
      exampleReporterFlag: env.EXAMPLE_REPORTER_ENABLED,
      crossWorkdir: env.CROSS2_WORKDIR,
    },
  });
  await recordModuleRunArtifact(repository, run.id, {
    artifactKind: "markdown",
    title: "Adapter env artifact",
    contentText: [
      env.EXAMPLE_REPORTER_ENABLED,
      env.WEB_LISTENING_WORKDIR,
      env.CROSS2_WORKDIR,
      env.CROSS2_PROJECT_PATH,
    ].join("\n"),
    provenance: {
      webListeningWorkdir: env.WEB_LISTENING_WORKDIR,
      crossProjectPath: env.CROSS2_PROJECT_PATH,
    },
  });

  const timelineResponse = await withInspectorApp(
    repository,
    (baseUrl) => fetch(`${baseUrl}/runs/${pipelineRun.id}/timeline`),
    { env },
  );
  const artifactsResponse = await withInspectorApp(
    repository,
    (baseUrl) => fetch(`${baseUrl}/artifacts?pipelineRunId=${pipelineRun.id}`),
    { env },
  );
  const serialized = `${await timelineResponse.text()}\n${await artifactsResponse.text()}`;

  assert.equal(timelineResponse.status, 200);
  assert.equal(artifactsResponse.status, 200);
  for (const value of Object.values(env)) {
    assert.equal(serialized.includes(value), false, value);
  }
});
