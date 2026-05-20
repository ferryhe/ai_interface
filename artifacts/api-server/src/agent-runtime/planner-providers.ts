import type { AgentConfigRecord } from "../agent-config/agent-config-service";
import type { BusinessSkillDefinition } from "./skill-registry";

export type AgentProvider = "openai" | "anthropic" | "ollama" | "deterministic";
export type AgentConnectionStatus = "configured" | "missing_key";

export interface PlannerProviderDefinition {
  provider: AgentProvider;
  displayName: string;
  requiredEnv: string[];
  defaultModelId: string;
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
}

export interface AgentRuntimePlannerPlan {
  summary: string;
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
    defaultModelId: "gpt-5.5",
    supportsReasoningEffort: true,
  },
  {
    provider: "anthropic",
    displayName: "Anthropic",
    requiredEnv: ["ANTHROPIC_API_KEY"],
    defaultModelId: "claude-3-5-sonnet-latest",
    supportsReasoningEffort: false,
  },
  {
    provider: "ollama",
    displayName: "Ollama",
    requiredEnv: ["OLLAMA_API_BASE_URL"],
    defaultModelId: "llama3.1",
    supportsReasoningEffort: false,
  },
  {
    provider: "deterministic",
    displayName: "Deterministic",
    requiredEnv: [],
    defaultModelId: "deterministic-v1",
    supportsReasoningEffort: false,
  },
];

const plannerFallbackOrder: AgentProvider[] = ["openai", "anthropic", "ollama"];

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
  config: Pick<AgentConfigRecord, "provider">,
  env: Record<string, string | undefined>,
): {
  definition: PlannerProviderDefinition;
  connection: AgentProviderConnectionStatus;
  warnings: string[];
} {
  const configuredProvider = config.provider;
  const readiness = getPlannerProviderReadiness(env);
  const configuredDefinition = getPlannerProviderDefinition(configuredProvider);
  const warnings: string[] = [];

  let activeDefinition = configuredDefinition;
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

    if (activeDefinition.provider !== configuredProvider) {
      warnings.push(
        `Using ${activeDefinition.displayName} planner instead of ${configuredDefinition.displayName}.`,
      );
    }
  }

  return {
    definition: activeDefinition,
    warnings,
    connection: {
      status:
        activeDefinition.provider === "deterministic" &&
        configuredProvider !== "deterministic"
          ? "missing_key"
          : "configured",
      configuredProvider,
      activeProvider: activeDefinition.provider,
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

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
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
    steps,
    warnings: reason ? [reason] : [],
  };
}

function extractOpenAIResponseText(payload: unknown): string {
  const asRecord = normalizeJsonObject(payload);
  if (typeof asRecord["output_text"] === "string") {
    return asRecord["output_text"];
  }

  const output = asRecord["output"];
  if (!Array.isArray(output)) return "";

  const fragments: string[] = [];
  for (const item of output) {
    const content = normalizeJsonObject(item)["content"];
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const partRecord = normalizeJsonObject(part);
      if (typeof partRecord["text"] === "string") {
        fragments.push(partRecord["text"]);
      }
    }
  }
  return fragments.join("\n");
}

function extractAnthropicResponseText(payload: unknown): string {
  const content = normalizeJsonObject(payload)["content"];
  if (!Array.isArray(content)) return "";

  const fragments: string[] = [];
  for (const part of content) {
    const partRecord = normalizeJsonObject(part);
    if (typeof partRecord["text"] === "string") {
      fragments.push(partRecord["text"]);
    }
  }
  return fragments.join("\n");
}

function extractOllamaResponseText(payload: unknown): string {
  const asRecord = normalizeJsonObject(payload);
  const message = normalizeJsonObject(asRecord["message"]);
  if (typeof message["content"] === "string") return message["content"];
  if (typeof asRecord["response"] === "string") return asRecord["response"];
  return "";
}

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

    const response = await this.fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: request.config.modelId,
        reasoning:
          request.config.reasoningEffort === "none"
            ? undefined
            : { effort: request.config.reasoningEffort },
        input: [
          {
            role: "system",
            content:
              `${request.config.systemPrompt}\n\n` +
              "Return only JSON with {summary, steps, warnings}. " +
              "Each step must use one enabled skillId/moduleId and must not claim external execution has already happened.",
          },
          {
            role: "user",
            content: JSON.stringify({
              userRequest: request.message,
              enabledBusinessSkills: moduleDescriptions(request.enabledSkills),
              safetySettings: request.config.safetySettings,
              memorySettings: request.config.memorySettings,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "agent_runtime_plan",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
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
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI planner request failed with status ${response.status}`,
      );
    }

    return parsePlannerText(
      extractOpenAIResponseText(await response.json()),
      "OpenAI",
    );
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

    const response = await this.fetchFn("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: request.config.modelId,
        max_tokens: 4096,
        system:
          `${request.config.systemPrompt}\n\n` +
          "Return only JSON with {summary, steps, warnings}. " +
          "Each step must use one enabled skillId/moduleId and must not claim external execution has already happened.",
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              userRequest: request.message,
              enabledBusinessSkills: moduleDescriptions(request.enabledSkills),
              safetySettings: request.config.safetySettings,
              memorySettings: request.config.memorySettings,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic planner request failed with status ${response.status}`,
      );
    }

    return parsePlannerText(
      extractAnthropicResponseText(await response.json()),
      "Anthropic",
    );
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
    const url = new URL("/api/chat", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

    const response = await this.fetchFn(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: request.config.modelId,
        stream: false,
        format: "json",
        messages: [
          {
            role: "system",
            content:
              `${request.config.systemPrompt}\n\n` +
              "Return only JSON with {summary, steps, warnings}. " +
              "Each step must use one enabled skillId/moduleId and must not claim external execution has already happened.",
          },
          {
            role: "user",
            content: JSON.stringify({
              userRequest: request.message,
              enabledBusinessSkills: moduleDescriptions(request.enabledSkills),
              safetySettings: request.config.safetySettings,
              memorySettings: request.config.memorySettings,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama planner request failed with status ${response.status}`,
      );
    }

    return parsePlannerText(
      extractOllamaResponseText(await response.json()),
      "Ollama",
    );
  }
}

export function createPlannerForProvider(
  provider: AgentProvider,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch = fetch,
  fallbackReason = "Planner provider is not configured.",
): AgentPlanner {
  if (provider === "openai") return new OpenAIResponsesPlanner(env, fetchFn);
  if (provider === "anthropic") return new AnthropicMessagesPlanner(env, fetchFn);
  if (provider === "ollama") return new OllamaChatPlanner(env, fetchFn);
  return new DeterministicPlanner(fallbackReason);
}
