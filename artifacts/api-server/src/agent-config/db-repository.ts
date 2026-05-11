import { eq } from "drizzle-orm";
import { agentConfigsTable, db } from "@workspace/db";

import {
  type AgentConfigRecord,
  type AgentConfigRepository,
  type AgentEndpoint,
  type AgentMemorySettings,
  type AgentProvider,
  type AgentReasoningEffort,
  type AgentSafetySettings,
  type AgentSkillSetting,
} from "./agent-config-service";

type AgentConfigRow = typeof agentConfigsTable.$inferSelect;

function firstOrThrow<T>(rows: T[], label: string): T {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label} upsert did not return a row`);
  }
  return row;
}

function mapAgentConfig(row: AgentConfigRow): AgentConfigRecord {
  return {
    id: row.id,
    configKey: row.configKey,
    provider: row.provider as AgentProvider,
    endpoint: row.endpoint as AgentEndpoint,
    modelId: row.modelId,
    reasoningEffort: row.reasoningEffort as AgentReasoningEffort,
    systemPrompt: row.systemPrompt,
    skillSettings: row.skillSettings as AgentSkillSetting[],
    memorySettings: row.memorySettings as AgentMemorySettings,
    safetySettings: row.safetySettings as AgentSafetySettings,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DbAgentConfigRepository implements AgentConfigRepository {
  async findConfig(configKey: string): Promise<AgentConfigRecord | null> {
    const rows = await db
      .select()
      .from(agentConfigsTable)
      .where(eq(agentConfigsTable.configKey, configKey))
      .limit(1);

    return rows[0] ? mapAgentConfig(rows[0]) : null;
  }

  async upsertConfig(input: {
    configKey: string;
    provider: AgentProvider;
    endpoint: AgentEndpoint;
    modelId: string;
    reasoningEffort: AgentReasoningEffort;
    systemPrompt: string;
    skillSettings: AgentSkillSetting[];
    memorySettings: AgentMemorySettings;
    safetySettings: AgentSafetySettings;
  }): Promise<AgentConfigRecord> {
    const rows = await db
      .insert(agentConfigsTable)
      .values(input)
      .onConflictDoUpdate({
        target: agentConfigsTable.configKey,
        set: {
          provider: input.provider,
          endpoint: input.endpoint,
          modelId: input.modelId,
          reasoningEffort: input.reasoningEffort,
          systemPrompt: input.systemPrompt,
          skillSettings: input.skillSettings,
          memorySettings: input.memorySettings,
          safetySettings: input.safetySettings,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapAgentConfig(firstOrThrow(rows, "agent config"));
  }
}
