import { asc, eq } from "drizzle-orm";
import {
  agentMessagesTable,
  agentThreadsTable,
  db,
  moduleRunsTable,
  pipelineRunsTable,
} from "@workspace/db";

import { DbModuleRunRepository } from "../modules/db-repository";
import {
  type JsonObject,
  type ModuleRunRecord,
  type ModuleRunStatus,
} from "../modules/ingest-service";
import { type ModuleId } from "../modules/registry";
import {
  type AgentMessageRecord,
  type AgentMessageRole,
  type AgentRuntimeRepository,
  type AgentThreadRecord,
  type PipelineRunRecord,
} from "./agent-runtime-service";

type AgentThreadRow = typeof agentThreadsTable.$inferSelect;
type AgentMessageRow = typeof agentMessagesTable.$inferSelect;
type PipelineRunRow = typeof pipelineRunsTable.$inferSelect;
type ModuleRunRow = typeof moduleRunsTable.$inferSelect;

function firstOrThrow<T>(rows: T[], label: string): T {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label} insert did not return a row`);
  }
  return row;
}

function mapThread(row: AgentThreadRow): AgentThreadRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status as "active" | "archived",
    metadata: row.metadata as JsonObject | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMessage(row: AgentMessageRow): AgentMessageRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role as AgentMessageRole,
    content: row.content,
    metadata: row.metadata as JsonObject | null,
    createdAt: row.createdAt,
  };
}

function mapPipelineRun(row: PipelineRunRow): PipelineRunRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    title: row.title,
    status: row.status as ModuleRunStatus,
    activeModuleId: row.activeModuleId as ModuleId | null,
    metadata: row.metadata as JsonObject | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapModuleRun(row: ModuleRunRow): ModuleRunRecord {
  return {
    id: row.id,
    pipelineRunId: row.pipelineRunId,
    moduleId: row.moduleId as ModuleId,
    externalRunId: row.externalRunId,
    title: row.title,
    status: row.status as ModuleRunStatus,
    inputJson: row.inputJson as JsonObject | null,
    outputJson: row.outputJson as JsonObject | null,
    summary: row.summary,
    metadata: row.metadata as JsonObject | null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DbAgentRuntimeRepository
  extends DbModuleRunRepository
  implements AgentRuntimeRepository
{
  async createThread(input: {
    title: string;
    metadata: JsonObject | null;
  }): Promise<AgentThreadRecord> {
    const rows = await db
      .insert(agentThreadsTable)
      .values({
        title: input.title,
        metadata: input.metadata,
      })
      .returning();

    return mapThread(firstOrThrow(rows, "agent thread"));
  }

  async findThreadById(id: string): Promise<AgentThreadRecord | null> {
    const rows = await db
      .select()
      .from(agentThreadsTable)
      .where(eq(agentThreadsTable.id, id))
      .limit(1);

    return rows[0] ? mapThread(rows[0]) : null;
  }

  async createMessage(input: {
    threadId: string;
    role: AgentMessageRole;
    content: string;
    metadata: JsonObject | null;
  }): Promise<AgentMessageRecord> {
    const rows = await db
      .insert(agentMessagesTable)
      .values(input)
      .returning();

    return mapMessage(firstOrThrow(rows, "agent message"));
  }

  async listMessages(threadId: string): Promise<AgentMessageRecord[]> {
    const rows = await db
      .select()
      .from(agentMessagesTable)
      .where(eq(agentMessagesTable.threadId, threadId))
      .orderBy(asc(agentMessagesTable.createdAt));

    return rows.map(mapMessage);
  }

  async createPipelineRun(input: {
    threadId: string | null;
    title: string;
    status: ModuleRunStatus;
    activeModuleId: ModuleId | null;
    metadata: JsonObject | null;
  }): Promise<PipelineRunRecord> {
    const rows = await db.insert(pipelineRunsTable).values(input).returning();
    return mapPipelineRun(firstOrThrow(rows, "pipeline run"));
  }

  async updatePipelineRun(
    id: string,
    input: {
      status?: ModuleRunStatus;
      activeModuleId?: ModuleId | null;
      metadata?: JsonObject | null;
    },
  ): Promise<PipelineRunRecord> {
    const rows = await db
      .update(pipelineRunsTable)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(pipelineRunsTable.id, id))
      .returning();

    return mapPipelineRun(firstOrThrow(rows, "pipeline run"));
  }

  async findPipelineRunById(id: string): Promise<PipelineRunRecord | null> {
    const rows = await db
      .select()
      .from(pipelineRunsTable)
      .where(eq(pipelineRunsTable.id, id))
      .limit(1);

    return rows[0] ? mapPipelineRun(rows[0]) : null;
  }

  async listModuleRunsByPipelineRunId(
    pipelineRunId: string,
  ): Promise<ModuleRunRecord[]> {
    const rows = await db
      .select()
      .from(moduleRunsTable)
      .where(eq(moduleRunsTable.pipelineRunId, pipelineRunId))
      .orderBy(asc(moduleRunsTable.createdAt));

    return rows.map(mapModuleRun);
  }
}
