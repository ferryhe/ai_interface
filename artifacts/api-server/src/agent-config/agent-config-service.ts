import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import type { ModuleId } from "../modules/registry";
import {
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";
import {
  getPlannerProviderDefinition,
  selectPlannerProvider,
  type AgentProvider,
  type AgentConnectionStatus as ConnectionStatus,
  type AgentProviderConnectionStatus,
} from "../agent-runtime/planner-providers";

export type { AgentProvider } from "../agent-runtime/planner-providers";

export type AgentEndpoint =
  | "responses"
  | "chat_completions"
  | "anthropic_messages"
  | "ollama_chat"
  | "deterministic"
  | "agents_sdk";
export type AgentReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
export type MemoryPromotionMode = "manual" | "agent_suggested";
export type AgentPublishStatus = "draft" | "published" | "paused";
export type PortalAccessMode = "token";
export type GeneralSkillId =
  | "web_search"
  | "browser"
  | "github"
  | "notion"
  | "lark"
  | "file_tools";

export interface BusinessSkillSetting {
  moduleId: ModuleId;
  enabled: boolean;
  approvalRequired: boolean;
  canUseNetwork: boolean;
  canWriteDatabase: boolean;
}

export interface GeneralSkillSetting {
  skillId: GeneralSkillId;
  name: string;
  description: string;
  enabled: boolean;
  installed: boolean;
  installOnDemand: boolean;
  requiresApproval: boolean;
  canUseNetwork: boolean;
}

export interface AgentMemorySettings {
  shortTermEnabled: boolean;
  longTermEnabled: boolean;
  promotionMode: MemoryPromotionMode;
  ragCollection: string;
  retentionDays: number;
}

export interface AgentSafetySettings {
  requireApprovalForExternalActions: boolean;
  requireApprovalForPublishing: boolean;
  allowSelfLearning: boolean;
  maxToolSteps: number;
}

export interface AgentPublishSettings {
  status: AgentPublishStatus;
  portalAccessMode: PortalAccessMode;
  portalTokenHash: string | null;
  portalTokenLast4: string | null;
  portalTokenUpdatedAt: string | null;
  publishedAt: string | null;
  versionLabel: string;
}

export type PortalAccessStatus =
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published";

export interface PortalAccessVerification {
  status: PortalAccessStatus;
  authorized: boolean;
  publishStatus: AgentPublishStatus;
  versionLabel: string;
  portalTokenLast4: string | null;
  checkedAt: string;
}

export type PublicAgentPublishSettings = Omit<
  AgentPublishSettings,
  "portalTokenHash"
>;

export interface UpdateAgentPublishSettingsInput {
  status?: AgentPublishStatus;
  portalAccessMode?: PortalAccessMode;
  setPortalToken?: string;
  versionLabel?: string;
}

export interface AgentConfigRecord {
  id: string;
  configKey: string;
  provider: AgentProvider;
  endpoint: AgentEndpoint;
  modelId: string;
  reasoningEffort: AgentReasoningEffort;
  systemPrompt: string;
  businessSkillSettings: BusinessSkillSetting[];
  generalSkillSettings: GeneralSkillSetting[];
  memorySettings: AgentMemorySettings;
  safetySettings: AgentSafetySettings;
  publishSettings: AgentPublishSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicAgentConfigRecord = Omit<
  AgentConfigRecord,
  "publishSettings"
> & {
  publishSettings: PublicAgentPublishSettings;
};

export interface UpdateAgentConfigInput {
  provider?: AgentProvider;
  endpoint?: AgentEndpoint;
  modelId?: string;
  reasoningEffort?: AgentReasoningEffort;
  systemPrompt?: string;
  businessSkillSettings?: BusinessSkillSetting[];
  generalSkillSettings?: GeneralSkillSetting[];
  memorySettings?: AgentMemorySettings;
  safetySettings?: AgentSafetySettings;
  publishSettings?: UpdateAgentPublishSettingsInput;
}

interface UpsertAgentConfigInput {
  configKey: string;
  provider: AgentProvider;
  endpoint: AgentEndpoint;
  modelId: string;
  reasoningEffort: AgentReasoningEffort;
  systemPrompt: string;
  businessSkillSettings: BusinessSkillSetting[];
  generalSkillSettings: GeneralSkillSetting[];
  memorySettings: AgentMemorySettings;
  safetySettings: AgentSafetySettings;
  publishSettings: AgentPublishSettings;
}

export interface AgentConfigRepository {
  findConfig(configKey: string): Promise<AgentConfigRecord | null>;
  upsertConfig(input: UpsertAgentConfigInput): Promise<AgentConfigRecord>;
}

export const defaultAgentConfigKey = "default";

export function createDefaultBusinessSkillSettings(
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): BusinessSkillSetting[] {
  return registry.listModuleDefinitions().map((moduleDefinition) => {
    const definition = registry.getBusinessSkillDefinition(
      moduleDefinition.moduleId,
    );
    const source = definition.manifest?.project.source;
    return {
      moduleId: definition.moduleId,
      enabled: source === "community" || source === "custom" ? false : true,
      approvalRequired: definition.permissionDefaults.approvalRequired,
      canUseNetwork: definition.permissionDefaults.canUseNetwork,
      canWriteDatabase: definition.permissionDefaults.canWriteDatabase,
    };
  });
}

export function createDefaultGeneralSkillSettings(): GeneralSkillSetting[] {
  return [
    {
      skillId: "web_search",
      name: "Web Search",
      description: "Search current web sources when the Agent needs fresh external context.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "browser",
      name: "Browser",
      description: "Open and inspect local or web pages during an Agent conversation.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "github",
      name: "GitHub",
      description: "Inspect repositories, issues, pull requests, reviews, and CI status.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "notion",
      name: "Notion",
      description: "Capture decisions, prepare documentation, and read workspace knowledge.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "lark",
      name: "Lark",
      description: "Work with Lark messages, docs, tasks, calendars, and approvals.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "file_tools",
      name: "File Tools",
      description: "Read and prepare local project files inside the approved workspace.",
      enabled: true,
      installed: true,
      installOnDemand: false,
      requiresApproval: false,
      canUseNetwork: false,
    },
  ];
}

export function createDefaultPublishSettings(): AgentPublishSettings {
  return {
    status: "draft",
    portalAccessMode: "token",
    portalTokenHash: null,
    portalTokenLast4: null,
    portalTokenUpdatedAt: null,
    publishedAt: null,
    versionLabel: "draft-0.3",
  };
}

export function toPublicAgentConfig(
  config: AgentConfigRecord,
): PublicAgentConfigRecord {
  const { portalTokenHash: _portalTokenHash, ...publishSettings } =
    config.publishSettings;
  return {
    ...config,
    publishSettings,
  };
}

function hashPortalToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function hashesMatch(actualHash: string, expectedHash: string): boolean {
  if (actualHash.length !== expectedHash.length) return false;
  return timingSafeEqual(
    Buffer.from(actualHash, "hex"),
    Buffer.from(expectedHash, "hex"),
  );
}

function mergePublishSettings(
  current: AgentPublishSettings,
  input?: UpdateAgentPublishSettingsInput,
): AgentPublishSettings {
  if (!input) return current;

  const token = input.setPortalToken?.trim();
  const now = new Date().toISOString();

  return {
    ...current,
    status: input.status ?? current.status,
    portalAccessMode: input.portalAccessMode ?? current.portalAccessMode,
    versionLabel: input.versionLabel ?? current.versionLabel,
    portalTokenHash: token ? hashPortalToken(token) : current.portalTokenHash,
    portalTokenLast4: token ? token.slice(-4) : current.portalTokenLast4,
    portalTokenUpdatedAt: token ? now : current.portalTokenUpdatedAt,
    publishedAt:
      input.status === "published" && current.status !== "published"
        ? now
        : current.publishedAt,
  };
}

export function createDefaultAgentConfig(
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): UpsertAgentConfigInput {
  return {
    configKey: defaultAgentConfigKey,
    provider: "openai",
    endpoint: "responses",
    modelId: "gpt-5.6-luna",
    reasoningEffort: "medium",
    systemPrompt:
      "You are the Agent Module OS orchestrator. Plan carefully, call registered modules through approved tools, store canonical results in Postgres memory, and explain progress with links to module results.",
    businessSkillSettings: createDefaultBusinessSkillSettings(registry),
    generalSkillSettings: createDefaultGeneralSkillSettings(),
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
    publishSettings: createDefaultPublishSettings(),
  };
}

export class InMemoryAgentConfigRepository implements AgentConfigRepository {
  readonly configs: AgentConfigRecord[] = [];

  async findConfig(configKey: string): Promise<AgentConfigRecord | null> {
    return this.configs.find((config) => config.configKey === configKey) ?? null;
  }

  async upsertConfig(input: UpsertAgentConfigInput): Promise<AgentConfigRecord> {
    const existingIndex = this.configs.findIndex(
      (config) => config.configKey === input.configKey,
    );
    const now = new Date();

    if (existingIndex === -1) {
      const created: AgentConfigRecord = {
        id: randomUUID(),
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      this.configs.push(created);
      return created;
    }

    const existing = this.configs[existingIndex]!;
    const updated: AgentConfigRecord = {
      ...existing,
      ...input,
      updatedAt: now,
    };
    this.configs[existingIndex] = updated;
    return updated;
  }
}

export async function getAgentConfig(
  repository: AgentConfigRepository,
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): Promise<AgentConfigRecord> {
  const existing = await repository.findConfig(defaultAgentConfigKey);
  if (existing) return existing;

  return repository.upsertConfig(createDefaultAgentConfig(registry));
}

export async function updateAgentConfig(
  repository: AgentConfigRepository,
  input: UpdateAgentConfigInput,
  registry: SkillRuntimeRegistry = defaultSkillRuntimeRegistry,
): Promise<AgentConfigRecord> {
  const current = await getAgentConfig(repository, registry);
  const provider = input.provider ?? current.provider;
  const providerChanged = provider !== current.provider;
  const providerDefinition = providerChanged
    ? getPlannerProviderDefinition(provider)
    : null;
  const activeProviderDefinition =
    providerDefinition ?? getPlannerProviderDefinition(provider);
  const endpoint =
    input.endpoint ??
    (providerChanged ? activeProviderDefinition.defaultEndpoint : current.endpoint);
  if (!activeProviderDefinition.supportedEndpoints.includes(endpoint)) {
    throw new Error(
      `${activeProviderDefinition.displayName} does not support endpoint ${endpoint}.`,
    );
  }
  const modelId = (input.modelId ?? current.modelId).trim();
  if (!modelId) throw new Error("modelId must not be empty.");

  return repository.upsertConfig({
    configKey: current.configKey,
    provider,
    endpoint,
    modelId:
      input.modelId === undefined && providerChanged
        ? activeProviderDefinition.defaultModelId
        : modelId,
    reasoningEffort:
      input.reasoningEffort ??
      (providerChanged
        ? providerDefinition!.supportsReasoningEffort
          ? "medium"
          : "none"
        : current.reasoningEffort),
    systemPrompt: input.systemPrompt ?? current.systemPrompt,
    businessSkillSettings:
      input.businessSkillSettings ?? current.businessSkillSettings,
    generalSkillSettings: input.generalSkillSettings ?? current.generalSkillSettings,
    memorySettings: input.memorySettings ?? current.memorySettings,
    safetySettings: input.safetySettings ?? current.safetySettings,
    publishSettings: mergePublishSettings(
      current.publishSettings,
      input.publishSettings,
    ),
  });
}

export async function verifyPortalAccess(
  repository: AgentConfigRepository,
  tokenInput: string,
): Promise<PortalAccessVerification> {
  const config = await getAgentConfig(repository);
  const settings = config.publishSettings;
  const base = {
    authorized: false,
    publishStatus: settings.status,
    versionLabel: settings.versionLabel,
    portalTokenLast4: settings.portalTokenLast4,
    checkedAt: new Date().toISOString(),
  };
  const token = tokenInput.trim();

  if (!token) return { ...base, status: "missing_token" };
  if (settings.status !== "published") return { ...base, status: "not_published" };
  if (!settings.portalTokenHash) return { ...base, status: "invalid_token" };
  if (!hashesMatch(hashPortalToken(token), settings.portalTokenHash)) {
    return { ...base, status: "invalid_token" };
  }

  return { ...base, status: "authorized", authorized: true };
}

export function getConnectionStatus(
  env: Record<string, string | undefined>,
  config: Pick<AgentConfigRecord, "provider" | "endpoint"> | AgentProvider = {
    provider: "openai",
    endpoint: "responses",
  },
): AgentProviderConnectionStatus {
  const normalizedConfig =
    typeof config === "string"
      ? {
          provider: config,
          endpoint: getPlannerProviderDefinition(config).defaultEndpoint,
        }
      : config;
  return selectPlannerProvider(normalizedConfig, env).connection;
}
