import type {
  AgentConfigRecord,
  AgentEndpoint,
} from "../agent-config/agent-config-service";
import type { BusinessSkillDefinition } from "./skill-registry";
import {
  AnthropicModelApi,
  OllamaModelApi,
  OpenAICompatibleModelApi,
  type ModelApi,
} from "./model-api";
import type {
  AgentRuntimePlanMode,
  DagFailureStrategy,
} from "./dag-executor";

export type { AgentRuntimePlanMode, DagFailureStrategy } from "./dag-executor";

export type AgentProvider =
  | "openai"
  | "openai_compatible"
  | "anthropic"
  | "ollama"
  | "deterministic";
export type AgentConnectionStatus = "configured" | "missing_key";

export interface PlannerProviderDefinition {
  provider: AgentProvider;
  displayName: string;
  requiredEnv: string[];
  defaultModelId: string;
  defaultEndpoint: AgentEndpoint;
  supportedEndpoints: AgentEndpoint[];
  apiKeyEnv: string | null;
  baseUrlEnv: string | null;
  supportsReasoningEffort: boolean;
}

export interface PlannerProviderReadiness extends PlannerProviderDefinition {
  configured: boolean;
  missingEnv: string[];
}

export interface AgentProviderConnectionStatus {
  status: AgentConnectionStatus;
  configuredProvider: AgentProvider;
  activeProvider: AgentProvider;
  configuredEndpoint: AgentEndpoint;
  activeEndpoint: AgentEndpoint;
  providers: PlannerProviderReadiness[];
  warnings: string[];
}

interface PlannerRequest {
  message: string;
  config: AgentConfigRecord;
  enabledSkills: BusinessSkillDefinition[];
}

export interface AgentRuntimePlannerStep {
  skillId?: string;
  moduleId: string;
  title: string;
  action: string;
  input: Record<string, unknown>;
  requiresApproval: boolean;
  stepId?: string;
  dependsOn?: string[];
}

export interface AgentRuntimePlannerPlan {
  summary: string;
  mode?: AgentRuntimePlanMode;
  failureStrategy?: DagFailureStrategy;
  steps: AgentRuntimePlannerStep[];
  warnings: string[];
}

export interface AgentPlanner {
  createPlan(request: PlannerRequest): Promise<AgentRuntimePlannerPlan>;
}

export const plannerProviderDefinitions: PlannerProviderDefinition[] = [
  {
    provider: "openai",
    displayName: "OpenAI",
    requiredEnv: ["OPENAI_API_KEY"],
    defaultModelId: "gpt-5.6-luna",
    defaultEndpoint: "responses",
    supportedEndpoints: ["responses", "chat_completions"],
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrlEnv: "OPENAI_API_BASE_URL",
    supportsReasoningEffort: true,
  },
  {
    provider: "openai_compatible",
    displayName: "OpenAI Compatible",
    requiredEnv: ["OPENAI_COMPATIBLE_API_BASE_URL"],
    defaultModelId: "gpt-5.6-luna",
    defaultEndpoint: "chat_completions",
    supportedEndpoints: ["responses", "chat_completions"],
    apiKeyEnv: "OPENAI_COMPATIBLE_API_KEY",
    baseUrlEnv: "OPENAI_COMPATIBLE_API_BASE_URL",
    supportsReasoningEffort: true,
  },
  {
    provider: "anthropic",
    displayName: "Anthropic",
    requiredEnv: ["ANTHROPIC_API_KEY"],
    defaultModelId: "claude-3-5-sonnet-latest",
    defaultEndpoint: "anthropic_messages",
    supportedEndpoints: ["anthropic_messages"],
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrlEnv: "ANTHROPIC_API_BASE_URL",
    supportsReasoningEffort: false,
  },
  {
    provider: "ollama",
    displayName: "Ollama",
    requiredEnv: ["OLLAMA_API_BASE_URL"],
    defaultModelId: "llama3.1",
    defaultEndpoint: "ollama_chat",
    supportedEndpoints: ["ollama_chat"],
    apiKeyEnv: null,
    baseUrlEnv: "OLLAMA_API_BASE_URL",
    supportsReasoningEffort: false,
  },
  {
    provider: "deterministic",
    displayName: "Deterministic",
    requiredEnv: [],
    defaultModelId: "deterministic-v1",
    defaultEndpoint: "deterministic",
    supportedEndpoints: ["deterministic"],
    apiKeyEnv: null,
    baseUrlEnv: null,
    supportsReasoningEffort: false,
  },
];

const plannerFallbackOrder: AgentProvider[] = [
  "openai",
  "openai_compatible",
  "anthropic",
  "ollama",
];

export function getPlannerProviderDefinition(
  provider: AgentProvider,
): PlannerProviderDefinition {
  const definition = plannerProviderDefinitions.find(
    (candidate) => candidate.provider === provider,
  );
  if (!definition) throw new Error(`Unknown planner provider: ${provider}`);
  return definition;
}

function hasRequiredEnv(
  definition: PlannerProviderDefinition,
  env: Record<string, string | undefined>,
): boolean {
  return definition.requiredEnv.every((name) => Boolean(env[name]?.trim()));
}

function missingEnv(
  definition: PlannerProviderDefinition,
  env: Record<string, string | undefined>,
): string[] {
  return definition.requiredEnv.filter((name) => !env[name]?.trim());
}

export function getPlannerProviderReadiness(
  env: Record<string, string | undefined>,
): PlannerProviderReadiness[] {
  return plannerProviderDefinitions.map((definition) => ({
    ...definition,
    configured: hasRequiredEnv(definition, env),
    missingEnv: missingEnv(definition, env),
  }));
}

export function selectPlannerProvider(
  config: Pick<AgentConfigRecord, "provider" | "endpoint">,
  env: Record<string, string | undefined>,
): {
  definition: PlannerProviderDefinition;
  endpoint: AgentEndpoint;
  connection: AgentProviderConnectionStatus;
  warnings: string[];
} {
  const configuredProvider = config.provider;
  const configuredEndpoint = config.endpoint;
  const readiness = getPlannerProviderReadiness(env);
  const configuredDefinition = getPlannerProviderDefinition(configuredProvider);
  const warnings: string[] = [];

  let activeDefinition = configuredDefinition;
  const endpointSupported = configuredDefinition.supportedEndpoints.includes(
    configuredEndpoint,
  );
  let activeEndpoint = endpointSupported
    ? configuredEndpoint
    : configuredDefinition.defaultEndpoint;
  if (!endpointSupported) {
    warnings.push(
      `Configured endpoint ${configuredEndpoint} is not supported by ${configuredDefinition.displayName}; using ${activeEndpoint}.`,
    );
  }

  if (!hasRequiredEnv(configuredDefinition, env)) {
    const missing = missingEnv(configuredDefinition, env);
    if (missing.length > 0) {
      warnings.push(
        `Configured planner provider ${configuredProvider} is missing required environment: ${missing.join(", ")}.`,
      );
    }

    activeDefinition =
      plannerFallbackOrder
        .map((provider) => getPlannerProviderDefinition(provider))
        .find((definition) => hasRequiredEnv(definition, env)) ??
      getPlannerProviderDefinition("deterministic");
    activeEndpoint = activeDefinition.defaultEndpoint;

    if (activeDefinition.provider !== configuredProvider) {
      warnings.push(
        `Using ${activeDefinition.displayName} planner instead of ${configuredDefinition.displayName}.`,
      );
    }
  }

  return {
    definition: activeDefinition,
    endpoint: activeEndpoint,
    warnings,
    connection: {
      status:
        activeDefinition.provider === "deterministic" &&
        configuredProvider !== "deterministic"
          ? "missing_key"
          : "configured",
      configuredProvider,
      activeProvider: activeDefinition.provider,
      configuredEndpoint,
      activeEndpoint,
      providers: readiness,
      warnings,
    },
  };
}

function trimTitle(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "Agent run";
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

function moduleDescriptions(enabledSkills: BusinessSkillDefinition[]) {
  return enabledSkills.map((skill) => ({
    skillId: skill.skillId,
    moduleId: skill.moduleId,
    description: skill.description,
    canonicalEntrypoints: skill.canonicalEntrypoints,
    outputContracts: skill.outputContracts,
    permissionDefaults: skill.permissionDefaults,
  }));
}

export function createDeterministicPlannerPlan(
  message: string,
  enabledSkills: BusinessSkillDefinition[],
  reason: string,
): AgentRuntimePlannerPlan {
  const steps = enabledSkills.map((skill) => ({
    skillId: skill.skillId,
    moduleId: skill.moduleId,
    title: skill.displayName,
    action: `Prepare ${skill.displayName} handoff for: ${trimTitle(message)}`,
    input: {
      userRequest: message,
      adapterMode: skill.adapterMode,
      canonicalEntrypoints: skill.canonicalEntrypoints,
      outputContracts: skill.outputContracts,
      sourceRepo: skill.adapter.sourceRepo,
    },
    requiresApproval: skill.permissionDefaults.approvalRequired,
  }));

  return {
    summary:
      "Prepared a deterministic business-skill plan. Configure a ready model provider to let the model choose and refine steps.",
    mode: "linear",
    failureStrategy: "fail_fast",
    steps,
    warnings: reason ? [reason] : [],
  };
}

const plannerJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    mode: { type: "string", enum: ["linear", "dag"] },
    failureStrategy: {
      type: "string",
      enum: ["fail_fast", "continue_independent"],
    },
    warnings: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          moduleId: { type: "string" },
          skillId: { type: "string" },
          title: { type: "string" },
          action: { type: "string" },
          input: { type: "object", additionalProperties: true },
          requiresApproval: { type: "boolean" },
          stepId: { type: "string" },
          dependsOn: { type: "array", items: { type: "string" } },
        },
        required: [
          "moduleId",
          "title",
          "action",
          "input",
          "requiresApproval",
        ],
      },
    },
  },
  required: ["summary", "steps", "warnings"],
};

function parsePlannerText(
  text: string,
  providerDisplayName: string,
): AgentRuntimePlannerPlan {
  if (!text.trim()) {
    throw new Error(`${providerDisplayName} planner returned an empty response.`);
  }

  let parsed: AgentRuntimePlannerPlan;
  try {
    parsed = JSON.parse(text) as AgentRuntimePlannerPlan;
  } catch {
    throw new Error(
      `${providerDisplayName} planner returned an invalid JSON response.`,
    );
  }

  return {
    summary: parsed.summary,
    ...(parsed.mode === "linear" || parsed.mode === "dag"
      ? { mode: parsed.mode }
      : {}),
    ...(parsed.failureStrategy === "fail_fast" ||
    parsed.failureStrategy === "continue_independent"
      ? { failureStrategy: parsed.failureStrategy }
      : {}),
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}

export class DeterministicPlanner implements AgentPlanner {
  constructor(private readonly reason: string) {}

  async createPlan(request: PlannerRequest): Promise<AgentRuntimePlannerPlan> {
    return createDeterministicPlannerPlan(
      request.message,
      request.enabledSkills,
      this.reason,
    );
  }
}

export class OpenAIResponsesPlanner implements AgentPlanner {
  constructor(
    private readonly env: Record<string, string | undefined>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async createPlan(request: PlannerRequest): Promise<AgentRuntimePlannerPlan> {
    const apiKey = this.env["OPENAI_API_KEY"]?.trim();
    if (!apiKey) {
      return createDeterministicPlannerPlan(
        request.message,
        request.enabledSkills,
        "OPENAI_API_KEY is missing.",
      );
    }
    return createModelApiPlanner(
      new OpenAICompatibleModelApi(
        {
          baseUrl:
            this.env["OPENAI_API_BASE_URL"]?.trim() ||
            "https://api.openai.com/v1/",
          apiKey,
          endpoint: "responses",
          supportsReasoningEffort: true,
        },
        this.fetchFn,
      ),
      "OpenAI",
    ).createPlan(request);
  }
}

export class AnthropicMessagesPlanner implements AgentPlanner {
  constructor(
    private readonly env: Record<string, string | undefined>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async createPlan(request: PlannerRequest): Promise<AgentRuntimePlannerPlan> {
    const apiKey = this.env["ANTHROPIC_API_KEY"]?.trim();
    if (!apiKey) {
      return createDeterministicPlannerPlan(
        request.message,
        request.enabledSkills,
        "ANTHROPIC_API_KEY is missing.",
      );
    }

    return createModelApiPlanner(
      new AnthropicModelApi(
        this.env["ANTHROPIC_API_BASE_URL"]?.trim() ||
          "https://api.anthropic.com/v1/",
        apiKey,
        this.fetchFn,
      ),
      "Anthropic",
    ).createPlan(request);
  }
}

export class OllamaChatPlanner implements AgentPlanner {
  constructor(
    private readonly env: Record<string, string | undefined>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async createPlan(request: PlannerRequest): Promise<AgentRuntimePlannerPlan> {
    const baseUrl = this.env["OLLAMA_API_BASE_URL"]?.trim();
    if (!baseUrl) {
      return createDeterministicPlannerPlan(
        request.message,
        request.enabledSkills,
        "OLLAMA_API_BASE_URL is missing.",
      );
    }
    return createModelApiPlanner(
      new OllamaModelApi(baseUrl, this.fetchFn),
      "Ollama",
    ).createPlan(request);
  }
}

function plannerSystemPrompt(config: AgentConfigRecord): string {
  return (
    `${config.systemPrompt}\n\n` +
    "Return only JSON with {summary, mode, failureStrategy, steps, warnings}. " +
    "Use mode \"linear\" unless dependency-aware DAG execution is needed. " +
    "Each step must use one enabled skillId/moduleId and must not claim external execution has already happened."
  );
}

function createModelApiPlanner(
  modelApi: ModelApi,
  displayName: string,
): AgentPlanner {
  return {
    async createPlan(request) {
      const text = await modelApi.generateJson({
        modelId: request.config.modelId,
        reasoningEffort: request.config.reasoningEffort,
        systemPrompt: plannerSystemPrompt(request.config),
        userPrompt: JSON.stringify({
          userRequest: request.message,
          enabledBusinessSkills: moduleDescriptions(request.enabledSkills),
          safetySettings: request.config.safetySettings,
          memorySettings: request.config.memorySettings,
        }),
        jsonSchema: plannerJsonSchema,
      });
      return parsePlannerText(text, displayName);
    },
  };
}

function createModelApiForConfig(
  config: Pick<AgentConfigRecord, "provider" | "endpoint">,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch = fetch,
): ModelApi {
  if (config.provider === "openai" || config.provider === "openai_compatible") {
    if (config.endpoint !== "responses" && config.endpoint !== "chat_completions") {
      throw new Error(`${config.provider} does not support ${config.endpoint}.`);
    }
    const isOfficialOpenAI = config.provider === "openai";
    const baseUrlEnv = isOfficialOpenAI
      ? "OPENAI_API_BASE_URL"
      : "OPENAI_COMPATIBLE_API_BASE_URL";
    const apiKeyEnv = isOfficialOpenAI
      ? "OPENAI_API_KEY"
      : "OPENAI_COMPATIBLE_API_KEY";
    const baseUrl =
      env[baseUrlEnv]?.trim() ||
      (isOfficialOpenAI ? "https://api.openai.com/v1/" : "");
    return new OpenAICompatibleModelApi(
      {
        baseUrl,
        apiKey: env[apiKeyEnv]?.trim(),
        endpoint: config.endpoint,
        supportsReasoningEffort: true,
      },
      fetchFn,
    );
  }

  if (config.provider === "anthropic") {
    return new AnthropicModelApi(
      env["ANTHROPIC_API_BASE_URL"]?.trim() ||
        "https://api.anthropic.com/v1/",
      env["ANTHROPIC_API_KEY"]?.trim() ?? "",
      fetchFn,
    );
  }

  return new OllamaModelApi(env["OLLAMA_API_BASE_URL"]?.trim() ?? "", fetchFn);
}

export function createPlannerForConfig(
  config: Pick<AgentConfigRecord, "provider" | "endpoint">,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch = fetch,
  fallbackReason = "Planner provider is not configured.",
): AgentPlanner {
  if (config.provider === "deterministic") {
    return new DeterministicPlanner(fallbackReason);
  }
  return createModelApiPlanner(
    createModelApiForConfig(config, env, fetchFn),
    getPlannerProviderDefinition(config.provider).displayName,
  );
}

/** @deprecated Use createPlannerForConfig so API protocol and provider are selected independently. */
export function createPlannerForProvider(
  provider: AgentProvider,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch = fetch,
  fallbackReason = "Planner provider is not configured.",
): AgentPlanner {
  const definition = getPlannerProviderDefinition(provider);
  return createPlannerForConfig(
    { provider, endpoint: definition.defaultEndpoint },
    env,
    fetchFn,
    fallbackReason,
  );
}
