import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultBusinessSkillSettings,
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import {
  createAgentRun,
  getAgentRunDetail,
  InMemoryAgentRuntimeRepository,
  type AgentPlanner,
} from "./agent-runtime-service";

test("creates a deterministic missing-key plan and stores module runs", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message:
        "Watch the onboarding docs, convert them, index them, and draft an agent.",
    },
    { env: {} },
  );

  assert.equal(result.status, "missing_key");
  assert.deepEqual(result.connection, { status: "missing_key" });
  assert.equal(
    result.thread.title,
    "Watch the onboarding docs, convert them, index them, and draft an agent.",
  );
  assert.equal(result.userMessage.role, "user");
  assert.equal(result.agentMessage.role, "agent");
  assert.deepEqual(
    result.moduleRuns.map((run) => run.moduleId),
    ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
  );
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterId"],
    "web_listening.cli.v1",
  );
  assert.equal(result.moduleRuns[0]?.metadata?.["adapterKind"], "cli");
  assert.equal(result.moduleRuns[0]?.metadata?.["adapterSupportsResume"], true);
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterReadinessHint"],
    "Set WEB_LISTENING_CLI_PATH to enable CLI handoffs.",
  );
  assert.equal(
    result.moduleRuns[1]?.metadata?.["adapterId"],
    "doc_to_md.http.v1",
  );
  assert.equal(runtimeRepository.threads.length, 1);
  assert.equal(runtimeRepository.messages.length, 2);
  assert.equal(runtimeRepository.pipelineRuns.length, 1);
  assert.equal(runtimeRepository.moduleRuns.length, 4);
  assert.equal(runtimeRepository.runEvents.length, 4);
});

test("respects disabled business skills", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  await updateAgentConfig(configRepository, {
    businessSkillSettings: [
      {
        moduleId: "web_listening",
        enabled: true,
        approvalRequired: true,
        canUseNetwork: true,
        canWriteDatabase: true,
      },
      {
        moduleId: "doc_to_md",
        enabled: false,
        approvalRequired: false,
        canUseNetwork: false,
        canWriteDatabase: true,
      },
      {
        moduleId: "md_to_rag",
        enabled: true,
        approvalRequired: false,
        canUseNetwork: false,
        canWriteDatabase: true,
      },
      {
        moduleId: "rag_to_agent",
        enabled: false,
        approvalRequired: true,
        canUseNetwork: false,
        canWriteDatabase: true,
      },
    ],
  });

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Plan only with enabled modules.",
    },
    { env: {} },
  );

  assert.deepEqual(
    result.plan.steps.map((step) => step.moduleId),
    ["web_listening", "md_to_rag"],
  );
  assert.deepEqual(
    result.moduleRuns.map((run) => run.moduleId),
    ["web_listening", "md_to_rag"],
  );
});

test("uses an injected planner when OpenAI is configured", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Use document conversion first, then index the markdown.",
        warnings: [],
        steps: [
          {
            moduleId: "doc_to_md",
            title: "Convert source docs",
            action: "Convert uploaded source documents into Markdown.",
            input: {
              sourceArtifactIds: ["artifact-source-1"],
              engine: "opendataloader",
            },
            requiresApproval: false,
          },
          {
            moduleId: "md_to_rag",
            title: "Index Markdown",
            action: "Chunk converted Markdown and prepare RAG metadata.",
            input: {
              markdownArtifactIds: ["artifact-md-1"],
              collection: "agent-module-os",
            },
            requiresApproval: false,
          },
        ],
      };
    },
  };

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert these documents and prepare RAG.",
    },
    { env: { OPENAI_API_KEY: "sk-test-secret" }, planner },
  );

  assert.equal(result.status, "planned");
  assert.deepEqual(result.connection, { status: "configured" });
  assert.equal(
    result.plan.summary,
    "Use document conversion first, then index the markdown.",
  );
  assert.deepEqual(
    result.moduleRuns.map((run) => run.title),
    ["Convert source docs", "Index Markdown"],
  );
  assert.deepEqual(result.moduleRuns[0]?.inputJson, {
    sourceArtifactIds: ["artifact-source-1"],
    engine: "opendataloader",
  });
});

test("applies configured approval overrides consistently", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  await updateAgentConfig(configRepository, {
    businessSkillSettings: createDefaultBusinessSkillSettings().map(
      (setting) => ({
        ...setting,
        approvalRequired: setting.moduleId === "doc_to_md",
      }),
    ),
  });

  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Convert source docs.",
        warnings: [],
        steps: [
          {
            moduleId: "doc_to_md",
            title: "Convert source docs",
            action: "Convert uploaded source documents into Markdown.",
            input: { sourceArtifactIds: ["artifact-source-1"] },
            requiresApproval: false,
          },
        ],
      };
    },
  };

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert this document.",
    },
    { env: { OPENAI_API_KEY: "sk-test-secret" }, planner },
  );

  assert.equal(result.status, "needs_approval");
  assert.equal(result.plan.steps[0]?.requiresApproval, true);
  assert.equal(result.moduleRuns[0]?.metadata?.["requiresApproval"], true);
  assert.equal(
    runtimeRepository.runEvents[0]?.payload?.["requiresApproval"],
    true,
  );
});

test("keeps internal thread metadata source authoritative", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Run with caller metadata.",
      metadata: { source: "external-client", correlationId: "request-1" },
    },
    { env: {} },
  );

  assert.equal(result.thread.metadata?.["source"], "agent-runtime");
  assert.equal(result.thread.metadata?.["correlationId"], "request-1");
  assert.equal(result.userMessage.metadata?.["source"], "external-client");
});

test("rejects unknown thread ids", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  await assert.rejects(
    () =>
      createAgentRun(
        runtimeRepository,
        configRepository,
        {
          threadId: "11111111-1111-1111-1111-111111111111",
          message: "Continue a missing thread.",
        },
        { env: {} },
      ),
    /Agent thread not found: 11111111-1111-1111-1111-111111111111/,
  );

  assert.equal(runtimeRepository.pipelineRuns.length, 0);
  assert.equal(runtimeRepository.moduleRuns.length, 0);
});

test("reads agent run detail from the stored pipeline", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const created = await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Create a full four-step module plan." },
    { env: {} },
  );

  const detail = await getAgentRunDetail(
    runtimeRepository,
    created.pipelineRun.id,
  );

  assert.equal(detail.thread.id, created.thread.id);
  assert.equal(detail.pipelineRun.id, created.pipelineRun.id);
  assert.equal(detail.messages.length, 2);
  assert.equal(detail.moduleRuns.length, 4);
});
