import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryModuleRunRepository,
  createModuleRun,
} from "../modules/ingest-service";
import {
  FakeToolAdapterExecutor,
  executeModuleRunWithAdapter,
  type ToolAdapterExecutor,
  type ToolExecutionRequest,
} from "./executor";
import { getAdapterDefinition } from "./adapter-registry";

test("skips unconfigured adapters without calling the executor", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: "doc-skip-001",
    metadata: {
      source: "agent-runtime",
      adapterId: "doc_to_md.http.v1",
    },
  });
  let callCount = 0;
  const executor: ToolAdapterExecutor = {
    async execute() {
      callCount += 1;
      throw new Error("executor should not be called");
    },
  };

  const result = await executeModuleRunWithAdapter(
    repository,
    run.id,
    executor,
    { env: {} },
  );

  assert.equal(callCount, 0);
  assert.equal(result.result, null);
  assert.equal(result.run.status, "pending");
  assert.equal(result.run.metadata?.["source"], "agent-runtime");
  assert.equal(result.run.metadata?.["adapterExecutionStatus"], "skipped");
  assert.equal(result.run.metadata?.["adapterId"], "doc_to_md.http.v1");
  assert.equal(result.run.metadata?.["adapterKind"], "http");
  assert.equal(
    result.run.metadata?.["adapterReadinessStatus"],
    "missing_required_env",
  );
  assert.deepEqual(result.run.metadata?.["adapterMissingRequiredEnv"], [
    "DOC_TO_MD_API_BASE_URL",
  ]);
  assert.equal(result.event.eventType, "tool.execution.skipped");
  assert.equal(result.event.severity, "warning");
  assert.equal(result.event.payload?.["adapterId"], "doc_to_md.http.v1");
  assert.equal(result.event.payload?.["moduleId"], "doc_to_md");
  assert.deepEqual(result.event.payload?.["missingRequiredEnv"], [
    "DOC_TO_MD_API_BASE_URL",
  ]);
  assert.equal(JSON.stringify(result.event.payload).includes("secret"), false);
});

test("runs a configured fake adapter and records success metadata", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: "doc-success-001",
    inputJson: { sourceArtifactIds: ["artifact-1"], engine: "auto" },
    metadata: {
      action: "Convert uploaded document",
      adapterReadinessHint: "Set DOC_TO_MD_API_BASE_URL to enable HTTP handoffs.",
    },
  });

  const result = await executeModuleRunWithAdapter(
    repository,
    run.id,
    new FakeToolAdapterExecutor(),
    { env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" } },
  );

  assert.equal(result.result?.status, "succeeded");
  assert.equal(result.run.status, "succeeded");
  assert.equal(
    result.run.summary,
    "Fake adapter execution completed for doc_to_md.http.v1.",
  );
  assert.deepEqual(result.run.outputJson, {
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
    externalRunId: "doc-success-001",
    inputJson: { sourceArtifactIds: ["artifact-1"], engine: "auto" },
    simulated: true,
  });
  assert.equal(result.run.metadata?.["action"], "Convert uploaded document");
  assert.equal(result.run.metadata?.["adapterExecutionStatus"], "succeeded");
  assert.equal(result.run.metadata?.["adapterId"], "doc_to_md.http.v1");
  assert.deepEqual(result.run.metadata?.["adapterMissingRequiredEnv"], []);
  assert.equal(result.run.startedAt instanceof Date, true);
  assert.equal(result.run.completedAt instanceof Date, true);
  assert.equal(result.event.eventType, "tool.execution.fake_completed");
  assert.equal(result.event.severity, "info");
  assert.equal(
    JSON.stringify(result.run).includes("doc.example.internal"),
    false,
  );
});

test("passes the running module run to the executor", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: "agent-success-001",
  });
  const requests: ToolExecutionRequest[] = [];
  const executor: ToolAdapterExecutor = {
    async execute(input) {
      requests.push(input);
      return new FakeToolAdapterExecutor().execute(input);
    },
  };

  await executeModuleRunWithAdapter(repository, run.id, executor, {
    env: { RAG_TO_AGENT_API_BASE_URL: "https://agent.example.internal" },
  });

  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.ok(request);
  assert.equal(request.run.status, "running");
  assert.equal(request.adapter.adapterId, "rag_to_agent.http.v1");
  assert.equal(request.readiness.status, "ready");
});

test("passes a copied adapter definition to executors", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: "listen-copy-001",
  });
  const original = getAdapterDefinition("web_listening");
  const originalAllowedCommands = [...original.allowedCommands];
  const executor: ToolAdapterExecutor = {
    async execute(input) {
      input.adapter.allowedCommands.push("mutated-command");
      input.adapter.requiredEnv.push("MUTATED_ENV");
      return new FakeToolAdapterExecutor().execute(input);
    },
  };

  await executeModuleRunWithAdapter(repository, run.id, executor, {
    env: { WEB_LISTENING_CLI_PATH: "C:\\tools\\web-listening.exe" },
  });

  assert.deepEqual(original.allowedCommands, originalAllowedCommands);
  assert.deepEqual(original.requiredEnv, ["WEB_LISTENING_CLI_PATH"]);
});

test("records failed execution state when an executor throws", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: "doc-failure-001",
    metadata: { source: "agent-runtime" },
  });
  const executor: ToolAdapterExecutor = {
    async execute() {
      throw new Error("upstream token=secret-token failed");
    },
  };

  const result = await executeModuleRunWithAdapter(
    repository,
    run.id,
    executor,
    { env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" } },
  );

  assert.equal(result.result?.status, "failed");
  assert.equal(result.run.status, "failed");
  assert.equal(
    result.run.summary,
    "Adapter execution failed for doc_to_md.http.v1.",
  );
  assert.equal(result.run.metadata?.["source"], "agent-runtime");
  assert.equal(result.run.metadata?.["adapterExecutionStatus"], "failed");
  assert.equal(result.event.eventType, "tool.execution.failed");
  assert.equal(result.event.severity, "error");
  assert.deepEqual(result.event.payload, {
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
  });
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
});

test("fails before execution when the module run is missing", async () => {
  const repository = new InMemoryModuleRunRepository();
  let callCount = 0;
  const executor: ToolAdapterExecutor = {
    async execute() {
      callCount += 1;
      throw new Error("executor should not be called");
    },
  };

  await assert.rejects(
    () =>
      executeModuleRunWithAdapter(repository, "missing-run", executor, {
        env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
      }),
    /Module run not found: missing-run/,
  );

  assert.equal(callCount, 0);
  assert.equal(repository.runEvents.length, 0);
});
