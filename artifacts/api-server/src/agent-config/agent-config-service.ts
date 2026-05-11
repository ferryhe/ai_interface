import { randomUUID } from "node:crypto";

import { moduleRegistry, type ModuleId } from "../modules/registry";

export type AgentProvider = "openai";
export type AgentEndpoint = "responses" | "agents_sdk";
export type AgentReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
export type MemoryPromotionMode = "manual" | "agent_suggested";
export type ConnectionStatus = "configured" | "missing_key";
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
  createdAt: Date;
  updatedAt: Date;
}

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
    approvalRequired: moduleDefinition.moduleId === "rag_to_agent",
    canUseNetwork: moduleDefinition.moduleId === "web_listening",
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
  });
}

export function getConnectionStatus(
  env: Record<string, string | undefined>,
): { status: ConnectionStatus } {
  return { status: env["OPENAI_API_KEY"]?.trim() ? "configured" : "missing_key" };
}
