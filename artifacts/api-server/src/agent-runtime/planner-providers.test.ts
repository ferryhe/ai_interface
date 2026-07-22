import assert from "node:assert/strict";
import test from "node:test";

import {
  AnthropicMessagesPlanner,
  OllamaChatPlanner,
  getPlannerProviderReadiness,
  selectPlannerProvider,
} from "./planner-providers";
import {
  createAgentRun,
  InMemoryAgentRuntimeRepository,
} from "./agent-runtime-service";
import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
  type AgentConfigRecord,
} from "../agent-config/agent-config-service";

function configuredConfig(provider: AgentConfigRecord["provider"]): AgentConfigRecord {
  return {
    id: "config-1",
    configKey: "default",
    provider,
    endpoint: "responses",
    modelId: "provider-test-model",
    reasoningEffort: "medium",
    systemPrompt: "Plan with enabled skills.",
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
  };
}

function plannerJson() {
  return {
    summary: "Convert the provided documents.",
    warnings: [],
    steps: [
      {
        skillId: "doc_to_md",
        moduleId: "doc_to_md",
        title: "Convert documents",
        action: "Convert uploaded documents into Markdown.",
        input: { sourceArtifactIds: ["artifact-source-1"] },
        requiresApproval: false,
      },
    ],
  };
}

test("OpenAI configured env selects OpenAI provider", () => {
  const selection = selectPlannerProvider(configuredConfig("openai"), {
    OPENAI_API_KEY: "sk-test-secret",
  });

  assert.equal(selection.definition.provider, "openai");
  assert.equal(selection.connection.status, "configured");
  assert.equal(selection.connection.activeProvider, "openai");
  assert.deepEqual(selection.warnings, []);
});

test("missing configured provider env falls back to deterministic with warning", () => {
  const selection = selectPlannerProvider(configuredConfig("anthropic"), {});

  assert.equal(selection.definition.provider, "deterministic");
  assert.equal(selection.connection.status, "missing_key");
  assert.equal(selection.connection.activeProvider, "deterministic");
  assert.equal(
    selection.warnings.some((warning) =>
      warning.includes("ANTHROPIC_API_KEY"),
    ),
    true,
  );
});

test("provider readiness redacts key values and local base URLs", () => {
  const readiness = getPlannerProviderReadiness({
    OPENAI_API_KEY: "sk-test-secret",
    ANTHROPIC_API_KEY: "anthropic-secret",
    OLLAMA_API_BASE_URL: "http://127.0.0.1:11434",
  });
  const serialized = JSON.stringify(readiness);

  assert.equal(serialized.includes("sk-test-secret"), false);
  assert.equal(serialized.includes("anthropic-secret"), false);
  assert.equal(serialized.includes("127.0.0.1:11434"), false);
  assert.equal(
    readiness.find((provider) => provider.provider === "ollama")?.configured,
    true,
  );
});

test("explicit deterministic provider does not report fallback warning", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "deterministic",
  });

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    { env: {} },
  );

  assert.equal(result.connection.status, "configured");
  assert.equal(result.connection.configuredProvider, "deterministic");
  assert.equal(result.connection.activeProvider, "deterministic");
  assert.equal(
    result.plan.warnings.includes("Using deterministic fallback."),
    false,
  );
});

test("legacy endpoint keeps its configured provider and uses its default endpoint", () => {
  const legacyConfig = configuredConfig("deterministic");
  legacyConfig.endpoint = "responses";

  const selection = selectPlannerProvider(legacyConfig, {
    OPENAI_API_KEY: "sk-test-secret",
  });

  assert.equal(selection.definition.provider, "deterministic");
  assert.equal(selection.endpoint, "deterministic");
  assert.equal(selection.connection.activeProvider, "deterministic");
  assert.equal(selection.connection.activeEndpoint, "deterministic");
  assert.equal(
    selection.warnings.some((warning) => warning.includes("using deterministic")),
    true,
  );
});

test("Anthropic mocked HTTP planner returns valid normalized steps", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body)),
    });
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(plannerJson()) }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "anthropic",
    modelId: "claude-3-5-sonnet-latest",
  });

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: { ANTHROPIC_API_KEY: "anthropic-secret" },
      planner: new AnthropicMessagesPlanner(
        { ANTHROPIC_API_KEY: "anthropic-secret" },
        fetchFn,
      ),
    },
  );

  assert.equal(requests[0]?.url, "https://api.anthropic.com/v1/messages");
  assert.equal(requests[0]?.body["model"], "claude-3-5-sonnet-latest");
  assert.deepEqual(
    result.plan.steps.map((step) => [step.skillId, step.moduleId]),
    [["doc_to_md", "doc_to_md"]],
  );
});

test("Anthropic planner reports empty provider responses clearly", async () => {
  const fetchFn = (async () =>
    new Response(JSON.stringify({ content: [] }), {
      status: 200,
    })) as typeof fetch;
  const planner = new AnthropicMessagesPlanner(
    { ANTHROPIC_API_KEY: "anthropic-secret" },
    fetchFn,
  );

  await assert.rejects(
    () =>
      planner.createPlan({
        message: "Convert these documents.",
        config: configuredConfig("anthropic"),
        enabledSkills: [],
      }),
    /Anthropic planner returned an empty response/,
  );
});

test("Ollama mocked HTTP planner returns valid normalized steps", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body)),
    });
    return new Response(
      JSON.stringify({
        message: { content: JSON.stringify(plannerJson()) },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "ollama",
    modelId: "llama3.1",
  });

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: { OLLAMA_API_BASE_URL: "http://127.0.0.1:11434" },
      planner: new OllamaChatPlanner(
        { OLLAMA_API_BASE_URL: "http://127.0.0.1:11434" },
        fetchFn,
      ),
    },
  );

  assert.equal(requests[0]?.url, "http://127.0.0.1:11434/api/chat");
  assert.equal(requests[0]?.body["model"], "llama3.1");
  assert.deepEqual(
    result.plan.steps.map((step) => [step.skillId, step.moduleId]),
    [["doc_to_md", "doc_to_md"]],
  );
});

test("OpenAI-compatible config selects custom API protocol and model", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(plannerJson()) } }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "openai_compatible",
    endpoint: "chat_completions",
    modelId: "local-model:latest",
    reasoningEffort: "none",
  });

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: {
        OPENAI_COMPATIBLE_API_BASE_URL: "http://127.0.0.1:9000/v1/",
      },
      fetchFn,
    },
  );

  assert.equal(result.connection.activeProvider, "openai_compatible");
  assert.equal(result.connection.activeEndpoint, "chat_completions");
  assert.equal(requests[0]?.url, "http://127.0.0.1:9000/v1/chat/completions");
  assert.equal(requests[0]?.body["model"], "local-model:latest");
});

test("OpenAI blank base URL falls back to the official API URL", async () => {
  const requests: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    requests.push(String(url));
    return new Response(
      JSON.stringify({ output_text: JSON.stringify(plannerJson()) }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: {
        OPENAI_API_KEY: "sk-test-secret",
        OPENAI_API_BASE_URL: "   ",
      },
      fetchFn,
    },
  );

  assert.equal(requests[0], "https://api.openai.com/v1/responses");
});

test("Anthropic blank base URL falls back to the official API URL", async () => {
  const requests: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    requests.push(String(url));
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(plannerJson()) }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, { provider: "anthropic" });

  await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: {
        ANTHROPIC_API_KEY: "anthropic-secret",
        ANTHROPIC_API_BASE_URL: "",
      },
      fetchFn,
    },
  );

  assert.equal(requests[0], "https://api.anthropic.com/v1/messages");
});

test("Anthropic configured with missing env falls back to OpenAI default model", async () => {
  const requests: Array<{ body: Record<string, unknown> }> = [];
  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({ body: JSON.parse(String(init?.body)) });
    return new Response(
      JSON.stringify({ output_text: JSON.stringify(plannerJson()) }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "anthropic",
    modelId: "claude-3-5-sonnet-latest",
  });

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: { OPENAI_API_KEY: "sk-test-secret" },
      fetchFn,
    },
  );

  assert.equal(result.connection.configuredProvider, "anthropic");
  assert.equal(result.connection.activeProvider, "openai");
  assert.equal(requests[0]?.body["model"], "gpt-5.6-luna");
});

test("OpenAI configured with missing env falls back to Anthropic default model", async () => {
  const requests: Array<{ body: Record<string, unknown> }> = [];
  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({ body: JSON.parse(String(init?.body)) });
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(plannerJson()) }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "openai",
    modelId: "gpt-5.5",
  });

  const result = await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: { ANTHROPIC_API_KEY: "anthropic-secret" },
      fetchFn,
    },
  );

  assert.equal(result.connection.configuredProvider, "openai");
  assert.equal(result.connection.activeProvider, "anthropic");
  assert.equal(requests[0]?.body["model"], "claude-3-5-sonnet-latest");
});

test("provider-only Anthropic config update sends Anthropic default model", async () => {
  const requests: Array<{ body: Record<string, unknown> }> = [];
  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({ body: JSON.parse(String(init?.body)) });
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(plannerJson()) }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    provider: "anthropic",
  });

  await createAgentRun(
    runtimeRepository,
    configRepository,
    { message: "Convert these documents." },
    {
      env: { ANTHROPIC_API_KEY: "anthropic-secret" },
      fetchFn,
    },
  );

  assert.equal(requests[0]?.body["model"], "claude-3-5-sonnet-latest");
});
