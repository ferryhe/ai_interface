import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import {
  createDefaultBusinessSkillSettings,
  getAgentConfig,
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import type { AgentManifest } from "../agent-registry/agent-manifest";
import { createAgentRuntimeRegistry } from "../agent-registry/agent-runtime-registry";
import {
  createModuleRun,
  recordModuleRunEvent,
} from "../modules/ingest-service";
import {
  createAgentRun,
  getAgentRunDetail,
  getAgentRunTimeline,
  InMemoryAgentRuntimeRepository,
  listAgentRuns,
  OpenAIResponsesPlanner,
  parseDagMaxConcurrency,
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

function customReporterModuleOnlyPlanner(): AgentPlanner {
  return {
    async createPlan() {
      return {
        summary: "Create a custom report from module-only planner output.",
        warnings: [],
        steps: [
          {
            moduleId: "custom_reporter_module",
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

function customReporterSplitManifest() {
  return {
    skillId: "custom_reporter",
    moduleId: "custom_reporter_module",
    name: "Custom Reporter",
    description: "Create custom reports from artifacts.",
    category: "agent" as const,
    project: {
      source: "external" as const,
      defaultSiblingPath: "../custom_reporter",
      repoUrl: "https://example.com/custom-reporter",
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    artifactKinds: ["report_markdown"],
    interactionKinds: ["question" as const],
    execution: {
      kind: "http" as const,
      adapterId: "custom_reporter.http.v1",
      supportsResume: true,
      timeoutMs: 30000,
      maxOutputBytes: 65536,
      requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      optionalEnv: [],
      allowedCommands: [],
    },
    ui: {
      mode: "auto" as const,
      preferredRenderer: "markdown" as const,
      openOnTrigger: false,
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  };
}

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
      mode: "dag",
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

class CapturingAgentRuntimeRepository extends InMemoryAgentRuntimeRepository {
  readonly listPipelineRunsInputs: Array<
    Parameters<InMemoryAgentRuntimeRepository["listPipelineRuns"]>[0]
  > = [];

  override async listPipelineRuns(
    input: Parameters<
      InMemoryAgentRuntimeRepository["listPipelineRuns"]
    >[0] = {},
  ): ReturnType<InMemoryAgentRuntimeRepository["listPipelineRuns"]> {
    this.listPipelineRunsInputs.push(input);
    return super.listPipelineRuns(input);
  }
}

async function withAgentHttpServer(): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const server = createServer((req, res) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          executedBy: "real-http-test",
          input: data ? JSON.parse(data) : null,
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        (server as Server).close((error) =>
          error ? reject(error) : resolve(),
        );
      }),
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
  assert.equal(result.connection.status, "missing_key");
  assert.equal(result.connection.configuredProvider, "openai");
  assert.equal(result.connection.activeProvider, "deterministic");
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
      "ai_actuary",
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
    "ai_actuary.cli.v1",
  );
  assert.deepEqual(
    result.moduleRuns[2]?.metadata?.["adapterAllowedCommands"],
    ["python scripts/run_tool_pipeline.py"],
  );
  assert.equal(
    result.moduleRuns[3]?.metadata?.["adapterId"],
    "doc_to_md.http.v1",
  );
  assert.equal(runtimeRepository.threads.length, 1);
  assert.equal(runtimeRepository.messages.length, 2);
  assert.equal(runtimeRepository.pipelineRuns.length, 1);
  assert.equal(runtimeRepository.moduleRuns.length, 6);
  assert.equal(runtimeRepository.runEvents.length, 6);
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
  assert.equal(result.connection.status, "configured");
  assert.equal(result.connection.configuredProvider, "openai");
  assert.equal(result.connection.activeProvider, "openai");
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

test("OpenAI planner sends skill ids with module descriptions", async () => {
  const requests: unknown[] = [];
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          summary: "Use custom reporter.",
          warnings: [],
          steps: [
            {
              moduleId: "custom_reporter_module",
              title: "Create custom report",
              action: "Summarize artifacts.",
              input: { topic: "onboarding" },
              requiresApproval: false,
            },
          ],
        }),
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const planner = new OpenAIResponsesPlanner(
    { OPENAI_API_KEY: "sk-test-secret" },
    fetchFn,
  );

  await planner.createPlan({
    message: "Create a custom report.",
    config: {
      id: "config-1",
      configKey: "default",
      provider: "openai",
      endpoint: "responses",
      modelId: "gpt-5.5",
      reasoningEffort: "medium",
      systemPrompt: "Plan.",
      businessSkillSettings: [],
      generalSkillSettings: [],
      memorySettings: {
        shortTermEnabled: true,
        longTermEnabled: true,
        promotionMode: "agent_suggested",
        ragCollection: "agent-module-os",
        retentionDays: 90,
      },
      safetySettings: {
        requireApprovalForExternalActions: true,
        requireApprovalForPublishing: true,
        allowSelfLearning: true,
        maxToolSteps: 12,
      },
      publishSettings: {
        status: "draft",
        portalAccessMode: "token",
        portalTokenHash: null,
        portalTokenLast4: null,
        portalTokenUpdatedAt: null,
        publishedAt: null,
        versionLabel: "draft-0.3",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    enabledSkills: [
      {
        skillId: "custom_reporter",
        moduleId: "custom_reporter_module",
        displayName: "Custom Reporter",
        description: "Create custom reports from artifacts.",
        adapter: {
          adapterId: "custom_reporter.http.v1",
          moduleId: "custom_reporter_module",
          adapterKind: "http",
          displayName: "Custom Reporter Adapter",
          description: "Create custom reports from artifacts.",
          sourceRepo: "https://example.com/custom-reporter",
          requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
          optionalEnv: [],
          timeoutMs: 30000,
          maxOutputBytes: 65536,
          allowedCommands: [],
          supportsResume: true,
          readinessHint: "Configure custom reporter.",
        },
        adapterMode: "external_api",
        canonicalEntrypoints: ["custom_reporter.http.v1"],
        outputContracts: ["report_markdown"],
        inputSchema: { type: "object" },
        permissionDefaults: {
          approvalRequired: false,
          canUseNetwork: false,
          canWriteDatabase: true,
        },
      },
    ],
  });

  const [request] = requests as Array<{
    input: Array<{ role: string; content: string }>;
  }>;
  const userPayload = JSON.parse(request.input[1]!.content) as {
    enabledBusinessSkills: Array<{ skillId?: string; moduleId: string }>;
  };
  assert.deepEqual(userPayload.enabledBusinessSkills[0], {
    skillId: "custom_reporter",
    moduleId: "custom_reporter_module",
    description: "Create custom reports from artifacts.",
    canonicalEntrypoints: ["custom_reporter.http.v1"],
    outputContracts: ["report_markdown"],
    permissionDefaults: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  });
});

test("execute_ready uses injected registry adapters when custom skill id differs from module id", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Create a custom onboarding report.",
      enabledSkillIds: ["custom_reporter"],
      executionMode: "execute_ready",
    },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        CUSTOM_REPORTER_API_BASE_URL: "https://report.example.internal",
      },
      planner: customReporterModuleOnlyPlanner(),
      skillManifests: [customReporterSplitManifest()],
    },
  );

  assert.equal(result.status, "planned");
  assert.equal(result.plan.steps[0]?.skillId, "custom_reporter");
  assert.equal(result.plan.steps[0]?.moduleId, "custom_reporter_module");
  assert.equal(result.moduleRuns[0]?.moduleId, "custom_reporter_module");
  assert.equal(result.moduleRuns[0]?.status, "succeeded");
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterId"],
    "custom_reporter.http.v1",
  );
  assert.deepEqual(result.moduleRuns[0]?.outputJson, {
    adapterId: "custom_reporter.http.v1",
    moduleId: "custom_reporter_module",
    externalRunId: result.moduleRuns[0]?.externalRunId,
    inputJson: { topic: "onboarding" },
    simulated: true,
  });
  assert.equal(JSON.stringify(result).includes("report.example.internal"), false);
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

test("fallback for empty dag planner output resets to linear deterministic mode", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Try a bad DAG skill.",
        mode: "dag",
        warnings: [],
        steps: [
          {
            skillId: "unknown_skill",
            moduleId: "unknown_skill",
            title: "Unknown",
            action: "This should be ignored.",
            input: {},
            requiresApproval: false,
            stepId: "unknown",
          },
        ],
      } as any;
    },
  };

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Try a bad DAG skill.",
      enabledSkillIds: ["doc_to_md"],
    },
    {
      env: { OPENAI_API_KEY: "sk-test-secret" },
      planner,
    },
  );

  assert.equal(result.plan.mode, "linear");
  assert.deepEqual(
    result.moduleRuns.map((run) => run.moduleId),
    ["doc_to_md"],
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

test("execute_ready uses real executor only when explicitly enabled", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const server = await withAgentHttpServer();

  try {
    const result = await createAgentRun(
      runtimeRepository,
      configRepository,
      {
        message: "Create a custom onboarding report.",
        enabledSkillIds: ["custom_reporter"],
        executionMode: "execute_ready",
      },
      {
        env: {
          OPENAI_API_KEY: "sk-test-secret",
          AI_INTERFACE_TOOL_EXECUTION_MODE: "real",
          CUSTOM_REPORTER_API_BASE_URL: server.url,
        },
        planner: customReporterModuleOnlyPlanner(),
        skillManifests: [customReporterSplitManifest()],
      },
    );

    assert.equal(result.status, "planned");
    assert.equal(result.pipelineRun.status, "succeeded");
    assert.equal(result.moduleRuns[0]?.status, "succeeded");
    assert.deepEqual(result.moduleRuns[0]?.outputJson, {
      executedBy: "real-http-test",
      input: { topic: "onboarding" },
    });
    assert.equal(
      runtimeRepository.runEvents.some(
        (event) => event.eventType === "tool.execution.http_completed",
      ),
      true,
    );
    assert.equal(
      runtimeRepository.runEvents.some(
        (event) => event.eventType === "tool.execution.fake_completed",
      ),
      false,
    );
    assert.equal(JSON.stringify(result).includes(server.url), false);
  } finally {
    await server.close();
  }
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

test("defaults missing plan mode to linear and preserves module-run order", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Index first, then convert in planner order.",
        warnings: [],
        steps: [
          {
            moduleId: "md_to_rag",
            title: "Index Markdown",
            action: "Index Markdown in the planner-provided order.",
            input: { markdownArtifactIds: ["artifact-md-1"] },
            requiresApproval: false,
            stepId: "index",
            dependsOn: ["convert"],
          },
          {
            moduleId: "doc_to_md",
            title: "Convert source docs",
            action: "Convert uploaded source documents into Markdown.",
            input: { sourceArtifactIds: ["artifact-source-1"] },
            requiresApproval: false,
            stepId: "convert",
          },
        ],
      } as any;
    },
  };

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Planner omitted plan mode.",
      enabledSkillIds: ["md_to_rag", "doc_to_md"],
    },
    { env: { OPENAI_API_KEY: "sk-test-secret" }, planner },
  );

  assert.equal((result.plan as { mode?: string }).mode, "linear");
  assert.deepEqual(
    result.moduleRuns.map((run) => run.moduleId),
    ["md_to_rag", "doc_to_md"],
  );
  assert.equal(result.moduleRuns[0]?.metadata?.["dagStepId"], undefined);
  assert.equal(result.moduleRuns[1]?.metadata?.["dagStepId"], undefined);
});

test("agent id selects exactly the skills declared by that agent", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const agentRegistry = createAgentRuntimeRegistry([testAgentManifest()]);

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Build a knowledge agent.",
      agentId: "knowledge_builder",
    },
    { env: {}, agentRegistry },
  );

  assert.deepEqual(
    result.moduleRuns.map((run) => run.metadata?.["skillId"]),
    ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
  );
});

test("enabled skill ids override agent skill bindings for one run", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const agentRegistry = createAgentRuntimeRegistry([testAgentManifest()]);

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Only convert source documents.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["doc_to_md"],
    },
    { env: {}, agentRegistry },
  );

  assert.deepEqual(
    result.moduleRuns.map((run) => run.metadata?.["skillId"]),
    ["doc_to_md"],
  );
});

test("agent skill bindings with missing skill references warn and do not create module runs", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const agentRegistry = createAgentRuntimeRegistry([
    testAgentManifest({
      skills: [
        { skillId: "doc_to_md", required: false },
        { skillId: "missing_agent_skill", required: true },
      ],
    }),
  ]);

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Build with one missing skill reference.",
      agentId: "knowledge_builder",
    },
    { env: {}, agentRegistry },
  );

  assert.deepEqual(
    result.moduleRuns.map((run) => run.metadata?.["skillId"]),
    ["doc_to_md"],
  );
  assert.equal(
    result.plan.warnings.some((warning) =>
      warning.includes("Agent references unregistered skill: missing_agent_skill"),
    ),
    true,
  );
});

test("agent planner defaults provide dag mode when injected planner omits mode", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const agentRegistry = createAgentRuntimeRegistry([testAgentManifest()]);
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Convert then index from planner defaults.",
        warnings: [],
        steps: [
          {
            moduleId: "doc_to_md",
            title: "Convert source docs",
            action: "Convert uploaded source documents into Markdown.",
            input: { sourceArtifactIds: ["artifact-source-1"] },
            requiresApproval: false,
            stepId: "convert",
          },
          {
            moduleId: "md_to_rag",
            title: "Index Markdown",
            action: "Index Markdown after conversion.",
            input: { markdownArtifactIds: ["artifact-md-1"] },
            requiresApproval: false,
            stepId: "index",
            dependsOn: ["convert"],
          },
        ],
      };
    },
  };

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Planner omitted mode.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["doc_to_md", "md_to_rag"],
    },
    { env: { OPENAI_API_KEY: "sk-test-secret" }, planner, agentRegistry },
  );

  assert.equal(result.plan.mode, "dag");
  assert.equal(result.plan.failureStrategy, "fail_fast");
  assert.equal(result.moduleRuns[0]?.metadata?.["dagStepId"], "convert");
  assert.deepEqual(result.moduleRuns[1]?.metadata?.["dagDependsOn"], [
    "convert",
  ]);
});

test("agent metadata is recorded on pipeline and module runs", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const agentRegistry = createAgentRuntimeRegistry([testAgentManifest()]);

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Build a knowledge agent.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["md_to_rag"],
    },
    { env: {}, agentRegistry },
  );

  assert.equal(result.pipelineRun.metadata?.["agentId"], "knowledge_builder");
  assert.equal(result.pipelineRun.metadata?.["agentName"], "Knowledge Builder");
  assert.deepEqual(result.pipelineRun.metadata?.["agentSkillIds"], [
    "web_listening",
    "doc_to_md",
    "md_to_rag",
    "rag_to_agent",
  ]);
  assert.equal(result.moduleRuns[0]?.metadata?.["agentId"], "knowledge_builder");
  assert.equal(result.moduleRuns[0]?.metadata?.["skillId"], "md_to_rag");
});

test("agent provider overrides apply to planner config without persisting", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "openai",
    modelId: "saved-openai-model",
    reasoningEffort: "medium",
  });
  const agentRegistry = createAgentRuntimeRegistry([
    testAgentManifest({
      provider: {
        provider: "deterministic",
        modelId: "agent-deterministic-model",
        reasoningEffort: "low",
      },
      planner: {
        mode: "linear",
        failureStrategy: "fail_fast",
      },
    }),
  ]);
  let capturedConfig:
    | Awaited<ReturnType<typeof getAgentConfig>>
    | undefined;
  const planner: AgentPlanner = {
    async createPlan(request) {
      capturedConfig = request.config;
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

  await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Use the agent provider for this run only.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["doc_to_md"],
    },
    { env: {}, planner, agentRegistry },
  );

  assert.ok(capturedConfig);
  assert.equal(capturedConfig.provider, "deterministic");
  assert.equal(capturedConfig.modelId, "agent-deterministic-model");
  assert.equal(capturedConfig.reasoningEffort, "low");

  const savedConfig = await getAgentConfig(configRepository);
  assert.equal(savedConfig.provider, "openai");
  assert.equal(savedConfig.modelId, "saved-openai-model");
  assert.equal(savedConfig.reasoningEffort, "medium");
});

test("parses DAG max concurrency environment values", () => {
  assert.equal(parseDagMaxConcurrency(undefined), undefined);
  assert.equal(parseDagMaxConcurrency(""), undefined);
  assert.equal(parseDagMaxConcurrency(" 2 "), 2);
  assert.equal(parseDagMaxConcurrency("0"), undefined);
  assert.equal(parseDagMaxConcurrency("-1"), undefined);
  assert.equal(parseDagMaxConcurrency("2.5"), undefined);
  assert.equal(parseDagMaxConcurrency("not-a-number"), undefined);
});

test("dag mode rejects unknown dependencies before creating module runs", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Invalid DAG.",
        mode: "dag",
        warnings: [],
        steps: [
          {
            moduleId: "md_to_rag",
            title: "Index Markdown",
            action: "Index Markdown after conversion.",
            input: { markdownArtifactIds: ["artifact-md-1"] },
            requiresApproval: false,
            stepId: "index",
            dependsOn: ["convert"],
          },
        ],
      } as any;
    },
  };

  await assert.rejects(
    () =>
      createAgentRun(
        runtimeRepository,
        configRepository,
        {
          message: "Run invalid DAG.",
          enabledSkillIds: ["md_to_rag"],
        },
        { env: { OPENAI_API_KEY: "sk-test-secret" }, planner },
      ),
    /DAG step index depends on unknown step convert/,
  );

  assert.equal(runtimeRepository.moduleRuns.length, 0);
});

test("dag execute_ready keeps approval upstream pending and blocks downstream", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const planner: AgentPlanner = {
    async createPlan() {
      return {
        summary: "Convert then index with approval.",
        mode: "dag",
        warnings: [],
        steps: [
          {
            moduleId: "doc_to_md",
            title: "Approve document conversion",
            action: "Wait for approval before conversion.",
            input: { sourceArtifactIds: ["artifact-source-1"] },
            requiresApproval: true,
            stepId: "convert",
          },
          {
            moduleId: "md_to_rag",
            title: "Index Markdown",
            action: "Index only after conversion succeeds.",
            input: { markdownArtifactIds: ["artifact-md-1"] },
            requiresApproval: false,
            stepId: "index",
            dependsOn: ["convert"],
          },
        ],
      } as any;
    },
  };

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    {
      message: "Convert then index.",
      executionMode: "execute_ready",
      enabledSkillIds: ["doc_to_md", "md_to_rag"],
    },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
        MD_TO_RAG_API_BASE_URL: "https://rag.example.internal",
      },
      planner,
    },
  );

  assert.equal(result.status, "needs_approval");
  assert.equal(result.pipelineRun.status, "pending");
  assert.deepEqual(
    result.moduleRuns.map((run) => [run.moduleId, run.status]),
    [
      ["doc_to_md", "pending"],
      ["md_to_rag", "pending"],
    ],
  );
  assert.equal(
    result.moduleRuns[0]?.metadata?.["adapterExecutionStatus"],
    "approval_required",
  );
  assert.equal(
    result.moduleRuns[1]?.metadata?.["dagExecutionStatus"],
    "blocked",
  );
  assert.equal(
    result.moduleRuns[1]?.metadata?.["dagBlockedReason"],
    "approval_required",
  );
  assert.deepEqual(result.moduleRuns[1]?.metadata?.["dagBlockedByStepIds"], [
    "convert",
  ]);
  assert.equal(
    runtimeRepository.runEvents.some(
      (event) => event.eventType === "agent.plan.step.blocked",
    ),
    true,
  );
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
  assert.equal(detail.moduleRuns.length, 6);
});

test("lists agent runs by agent metadata and matching module skill id", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const agentRegistry = createAgentRuntimeRegistry([testAgentManifest()]);
  const agentRun = await createAgentRun(
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
      message: "Convert only.",
      enabledSkillIds: ["doc_to_md"],
    },
    { env: {} },
  );

  const byAgent = await listAgentRuns(runtimeRepository, {
    agentId: "knowledge_builder",
  });
  const bySkill = await listAgentRuns(runtimeRepository, {
    skillId: "md_to_rag",
  });

  assert.deepEqual(
    byAgent.map((run) => run.pipelineRun.id),
    [agentRun.pipelineRun.id],
  );
  assert.deepEqual(
    bySkill.map((run) => run.pipelineRun.id),
    [agentRun.pipelineRun.id],
  );
});

test("passes list run limit to the repository when no module post-filter is needed", async () => {
  const runtimeRepository = new CapturingAgentRuntimeRepository();

  await listAgentRuns(runtimeRepository, {
    agentId: "knowledge_builder",
    status: "pending",
    limit: 12,
  });

  assert.equal(runtimeRepository.listPipelineRunsInputs[0]?.limit, 12);
});

test("keeps repository run listing unbounded when module post-filtering is needed", async () => {
  const runtimeRepository = new CapturingAgentRuntimeRepository();

  await listAgentRuns(runtimeRepository, { skillId: "md_to_rag", limit: 1 });
  await listAgentRuns(runtimeRepository, { moduleId: "doc_to_md", limit: 1 });

  assert.deepEqual(
    runtimeRepository.listPipelineRunsInputs.map((input) => input?.limit),
    [undefined, undefined],
  );
});

test("agent run timeline returns events ordered by creation time", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const thread = await runtimeRepository.createThread({
    title: "Timeline service test",
    metadata: null,
  });
  const pipelineRun = await runtimeRepository.createPipelineRun({
    threadId: thread.id,
    title: "Timeline service test",
    status: "pending",
    activeModuleId: "doc_to_md",
    metadata: null,
  });
  const { run } = await createModuleRun(runtimeRepository, {
    moduleId: "doc_to_md",
    externalRunId: "timeline-service-test",
    pipelineRunId: pipelineRun.id,
  });

  const second = await recordModuleRunEvent(runtimeRepository, run.id, {
    eventType: "timeline.second",
  });
  const first = await recordModuleRunEvent(runtimeRepository, run.id, {
    eventType: "timeline.first",
  });
  second.createdAt = new Date("2026-05-21T13:00:02.000Z");
  first.createdAt = new Date("2026-05-21T13:00:01.000Z");

  const timeline = await getAgentRunTimeline(
    runtimeRepository,
    pipelineRun.id,
  );

  assert.deepEqual(
    timeline.runEvents.map((event) => event.eventType),
    ["timeline.first", "timeline.second"],
  );
});
