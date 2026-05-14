import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { moduleRegistry, type ModuleId } from "../modules/registry";

export type AgentProvider = "openai";
export type AgentEndpoint = "responses" | "agents_sdk";
export type AgentReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
export type MemoryPromotionMode = "manual" | "agent_suggested";
export type ConnectionStatus = "configured" | "missing_key";
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

export function createDefaultBusinessSkillSettings(): BusinessSkillSetting[] {
  return moduleRegistry.map((moduleDefinition) => ({
    moduleId: moduleDefinition.moduleId,
    enabled: true,
    approvalRequired:
      moduleDefinition.moduleId === "rag_to_agent" ||
      moduleDefinition.moduleId === "climate_monitor",
    canUseNetwork:
      moduleDefinition.moduleId === "web_listening" ||
      moduleDefinition.moduleId === "climate_monitor",
    canWriteDatabase: true,
  }));
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

export function createDefaultAgentConfig(): UpsertAgentConfigInput {
  return {
    configKey: defaultAgentConfigKey,
    provider: "openai",
    endpoint: "responses",
    modelId: "gpt-5.5",
    reasoningEffort: "medium",
    systemPrompt:
      "You are the Agent Module OS orchestrator. Plan carefully, call registered modules through approved tools, store canonical results in Postgres memory, and explain progress with links to module results.",
    businessSkillSettings: createDefaultBusinessSkillSettings(),
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
): Promise<AgentConfigRecord> {
  const existing = await repository.findConfig(defaultAgentConfigKey);
  if (existing) return existing;

  return repository.upsertConfig(createDefaultAgentConfig());
}

export async function updateAgentConfig(
  repository: AgentConfigRepository,
  input: UpdateAgentConfigInput,
): Promise<AgentConfigRecord> {
  const current = await getAgentConfig(repository);

  return repository.upsertConfig({
    configKey: current.configKey,
    provider: input.provider ?? current.provider,
    endpoint: input.endpoint ?? current.endpoint,
    modelId: input.modelId ?? current.modelId,
    reasoningEffort: input.reasoningEffort ?? current.reasoningEffort,
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
): { status: ConnectionStatus } {
  return { status: env["OPENAI_API_KEY"]?.trim() ? "configured" : "missing_key" };
}
