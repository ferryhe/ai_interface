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

function singleDocToMarkdownPlanner(input: {
  requiresApproval?: boolean;
} = {}): AgentPlanner {
  return {
    async createPlan() {
      return {
        summary: "Convert source docs.",
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
            requiresApproval: input.requiresApproval ?? false,
          },
        ],
      };
    },
  };
}

function customReporterPlanner(): AgentPlanner {
  return {
    async createPlan() {
      return {
        summary: "Create a custom report.",
        warnings: [],
        steps: [
          {
            skillId: "custom_reporter",
            moduleId: "custom_reporter",
            title: "Create custom report",
            action: "Summarize the available artifacts.",
            input: { topic: "onboarding" },
            requiresApproval: false,
          },
        ],
      };
    },
  };
}

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
    [
      "web_listening",
      "climate_monitor",
      "doc_to_md",
      "md_to_rag",
      "rag_to_agent",
    ],
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
    "climate_monitor.cli.v1",
  );
  assert.deepEqual(
    result.moduleRuns[1]?.metadata?.["adapterAllowedCommands"],
    ["scripts/run_climate_monitor.py"],
  );
  assert.equal(
    result.moduleRuns[2]?.metadata?.["adapterId"],
    "doc_to_md.http.v1",
  );
  assert.equal(runtimeRepository.threads.length, 1);
  assert.equal(runtimeRepository.messages.length, 2);
  assert.equal(runtimeRepository.pipelineRuns.length, 1);
  assert.equal(runtimeRepository.moduleRuns.length, 5);
  assert.equal(runtimeRepository.runEvents.length, 5);
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

test("uses registered custom skill manifests in planner output", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Create a custom onboarding report.",
      enabledSkillIds: ["custom_reporter"],
    },
    {
      env: { OPENAI_API_KEY: "sk-test-secret" },
      planner: customReporterPlanner(),
      skillManifests: [
        {
          skillId: "custom_reporter",
          moduleId: "custom_reporter",
          name: "Custom Reporter",
          description: "Create custom reports from artifacts.",
          category: "agent",
          project: {
            source: "external",
            defaultSiblingPath: "../custom_reporter",
          },
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          artifactKinds: ["report_markdown"],
          interactionKinds: ["question"],
          execution: {
            kind: "internal",
            adapterId: "custom_reporter.internal.v1",
            supportsResume: false,
            timeoutMs: 30000,
            maxOutputBytes: 65536,
            requiredEnv: [],
            optionalEnv: [],
            allowedCommands: [],
          },
          ui: {
            mode: "auto",
            preferredRenderer: "markdown",
            openOnTrigger: false,
          },
          permissions: {
            approvalRequired: false,
            canUseNetwork: false,
            canWriteDatabase: true,
          },
        },
      ],
    },
  );

  assert.equal(result.status, "planned");
  assert.equal(result.plan.steps[0]?.skillId, "custom_reporter");
  assert.equal(result.plan.steps[0]?.moduleId, "custom_reporter");
  assert.equal(result.moduleRuns[0]?.moduleId, "custom_reporter");
  assert.equal(result.moduleRuns[0]?.metadata?.["skillId"], "custom_reporter");
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterId"],
    "custom_reporter.internal.v1",
  );
});

test("drops unknown planner skill ids with a warning", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Try an unknown skill.",
        warnings: [],
        steps: [
          {
            skillId: "unknown_skill",
            moduleId: "unknown_skill",
            title: "Unknown",
            action: "This should be ignored.",
            input: {},
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
      message: "Try a bad skill.",
      enabledSkillIds: ["doc_to_md"],
    },
    {
      env: { OPENAI_API_KEY: "sk-test-secret" },
      planner,
    },
  );

  assert.deepEqual(
    result.moduleRuns.map((run) => run.moduleId),
    ["doc_to_md"],
  );
  assert.equal(
    result.plan.warnings.some((warning) =>
      warning.includes("unknown skill: unknown_skill"),
    ),
    true,
  );
});

test("defaults to plan-only mode and leaves configured module runs pending", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert this document.",
    },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
      },
      planner: singleDocToMarkdownPlanner(),
    },
  );

  assert.equal(result.status, "planned");
  assert.equal(result.pipelineRun.status, "pending");
  assert.equal(result.pipelineRun.metadata?.["executionMode"], "plan_only");
  assert.equal(result.pipelineRun.metadata?.["executedModuleRunCount"], 0);
  assert.equal(
    result.pipelineRun.metadata?.["skippedApprovalModuleRunCount"],
    0,
  );
  assert.equal(result.moduleRuns.length, 1);
  assert.equal(result.moduleRuns[0]?.status, "pending");
  assert.equal(result.moduleRuns[0]?.outputJson, null);
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterExecutionStatus"],
    undefined,
  );
  assert.equal(
    runtimeRepository.runEvents.some(
      (event) => event.eventType === "tool.execution.fake_completed",
    ),
    false,
  );
});

test("execute_ready runs configured non-approval module runs with the fake adapter", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert this document.",
      executionMode: "execute_ready",
    },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
      },
      planner: singleDocToMarkdownPlanner(),
    },
  );

  assert.equal(result.status, "planned");
  assert.equal(result.pipelineRun.status, "succeeded");
  assert.equal(result.pipelineRun.activeModuleId, null);
  assert.equal(result.pipelineRun.metadata?.["executionMode"], "execute_ready");
  assert.equal(result.pipelineRun.metadata?.["executedModuleRunCount"], 1);
  assert.equal(
    result.pipelineRun.metadata?.["skippedApprovalModuleRunCount"],
    0,
  );
  assert.equal(result.moduleRuns.length, 1);
  assert.equal(result.moduleRuns[0]?.status, "succeeded");
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterExecutionStatus"],
    "succeeded",
  );
  assert.deepEqual(result.moduleRuns[0]?.outputJson, {
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
    externalRunId: result.moduleRuns[0]?.externalRunId,
    inputJson: {
      sourceArtifactIds: ["artifact-source-1"],
      engine: "opendataloader",
    },
    simulated: true,
  });
  assert.equal(
    runtimeRepository.runEvents.some(
      (event) => event.eventType === "tool.execution.fake_completed",
    ),
    true,
  );
  assert.equal(JSON.stringify(result).includes("doc.example.internal"), false);
});

test("execute_ready skips approval-required runs without calling the executor", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert this document.",
      executionMode: "execute_ready",
    },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
      },
      planner: singleDocToMarkdownPlanner({ requiresApproval: true }),
    },
  );

  assert.equal(result.status, "needs_approval");
  assert.equal(result.pipelineRun.status, "pending");
  assert.equal(result.pipelineRun.metadata?.["executionMode"], "execute_ready");
  assert.equal(result.pipelineRun.metadata?.["executedModuleRunCount"], 0);
  assert.equal(
    result.pipelineRun.metadata?.["skippedApprovalModuleRunCount"],
    1,
  );
  assert.equal(result.moduleRuns.length, 1);
  assert.equal(result.moduleRuns[0]?.status, "pending");
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterExecutionStatus"],
    "approval_required",
  );
  assert.equal(result.moduleRuns[0]?.startedAt, null);
  assert.equal(result.moduleRuns[0]?.outputJson, null);
  assert.equal(
    runtimeRepository.runEvents.some(
      (event) => event.eventType === "tool.execution.fake_completed",
    ),
    false,
  );
  const approvalEvent = runtimeRepository.runEvents.find(
    (event) => event.eventType === "tool.execution.approval_required",
  );
  assert.ok(approvalEvent);
  assert.equal(approvalEvent.moduleRunId, result.moduleRuns[0]?.id);
  assert.deepEqual(approvalEvent.payload, {
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
    externalRunId: result.moduleRuns[0]?.externalRunId,
  });
});

test("execute_ready with missing adapter env records a redacted skip and stays pending", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert this document.",
      executionMode: "execute_ready",
    },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        DOC_TO_MD_API_TOKEN: "secret-token",
      },
      planner: singleDocToMarkdownPlanner(),
    },
  );

  assert.equal(result.status, "planned");
  assert.equal(result.pipelineRun.status, "pending");
  assert.equal(result.pipelineRun.metadata?.["executionMode"], "execute_ready");
  assert.equal(result.pipelineRun.metadata?.["executedModuleRunCount"], 0);
  assert.equal(
    result.pipelineRun.metadata?.["skippedApprovalModuleRunCount"],
    0,
  );
  assert.equal(result.moduleRuns.length, 1);
  assert.equal(result.moduleRuns[0]?.status, "pending");
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterExecutionStatus"],
    "skipped",
  );
  assert.deepEqual(
    result.moduleRuns[0]?.metadata?.["adapterMissingRequiredEnv"],
    ["DOC_TO_MD_API_BASE_URL"],
  );
  const skipEvent = runtimeRepository.runEvents.find(
    (event) => event.eventType === "tool.execution.skipped",
  );
  assert.ok(skipEvent);
  assert.deepEqual(skipEvent.payload?.["missingRequiredEnv"], [
    "DOC_TO_MD_API_BASE_URL",
  ]);
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
  assert.equal(JSON.stringify(skipEvent).includes("secret-token"), false);
});

test("execute_ready executes ready steps while leaving approval steps pending", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Convert a document and publish an agent.",
        warnings: [],
        steps: [
          {
            moduleId: "doc_to_md",
            title: "Convert source docs",
            action: "Convert uploaded source documents into Markdown.",
            input: { sourceArtifactIds: ["artifact-source-1"] },
            requiresApproval: false,
          },
          {
            moduleId: "rag_to_agent",
            title: "Publish generated agent",
            action: "Create and publish the generated agent config.",
            input: { agentConfigArtifactId: "agent-config-1" },
            requiresApproval: true,
          },
        ],
      };
    },
  };

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert this document and prepare an agent.",
      executionMode: "execute_ready",
    },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
        RAG_TO_AGENT_API_BASE_URL: "https://agent.example.internal",
      },
      planner,
    },
  );

  assert.equal(result.status, "needs_approval");
  assert.equal(result.pipelineRun.status, "running");
  assert.equal(result.pipelineRun.activeModuleId, "rag_to_agent");
  assert.equal(result.pipelineRun.metadata?.["executedModuleRunCount"], 1);
  assert.equal(
    result.pipelineRun.metadata?.["skippedApprovalModuleRunCount"],
    1,
  );
  assert.deepEqual(
    result.moduleRuns.map((run) => [run.moduleId, run.status]),
    [
      ["doc_to_md", "succeeded"],
      ["rag_to_agent", "pending"],
    ],
  );
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterExecutionStatus"],
    "succeeded",
  );
  assert.equal(
    result.moduleRuns[1]?.metadata?.["adapterExecutionStatus"],
    "approval_required",
  );
  assert.equal(
    runtimeRepository.runEvents.filter(
      (event) => event.eventType === "tool.execution.fake_completed",
    ).length,
    1,
  );
  assert.equal(
    runtimeRepository.runEvents.filter(
      (event) => event.eventType === "tool.execution.approval_required",
    ).length,
    1,
  );
  assert.equal(JSON.stringify(result).includes("doc.example.internal"), false);
  assert.equal(JSON.stringify(result).includes("agent.example.internal"), false);
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
  assert.equal(detail.moduleRuns.length, 5);
});
