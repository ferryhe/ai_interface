import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentThreadStatusEnum = pgEnum("agent_thread_status", [
  "active",
  "archived",
]);

export const agentMessageRoleEnum = pgEnum("agent_message_role", [
  "user",
  "agent",
  "system",
  "tool",
]);

export const moduleCategoryEnum = pgEnum("module_category", [
  "source",
  "transform",
  "index",
  "agent",
]);

export const runStatusEnum = pgEnum("run_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const runEventSeverityEnum = pgEnum("run_event_severity", [
  "info",
  "warning",
  "error",
]);

export const agentProviderEnum = pgEnum("agent_provider", ["openai"]);

export const agentEndpointEnum = pgEnum("agent_endpoint", [
  "responses",
  "agents_sdk",
]);

export const agentReasoningEffortEnum = pgEnum("agent_reasoning_effort", [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
]);

export const agentThreadsTable = pgTable("agent_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  status: agentThreadStatusEnum("status").notNull().default("active"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentMessagesTable = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThreadsTable.id, { onDelete: "cascade" }),
    role: agentMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    threadCreatedAtIdx: index("agent_messages_thread_created_at_idx").on(
      table.threadId,
      table.createdAt,
    ),
  }),
);

export const moduleCatalogTable = pgTable("module_catalog", {
  moduleId: text("module_id").primaryKey(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  category: moduleCategoryEnum("category").notNull(),
  inputSchema: jsonb("input_schema").$type<Record<string, unknown>>(),
  outputSchema: jsonb("output_schema").$type<Record<string, unknown>>(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pipelineRunsTable = pgTable(
  "pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").references(() => agentThreadsTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: runStatusEnum("status").notNull().default("pending"),
    activeModuleId: text("active_module_id").references(
      () => moduleCatalogTable.moduleId,
      { onDelete: "set null" },
    ),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    threadIdx: index("pipeline_runs_thread_idx").on(table.threadId),
    statusIdx: index("pipeline_runs_status_idx").on(table.status),
  }),
);

export const moduleRunsTable = pgTable(
  "module_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineRunId: uuid("pipeline_run_id").references(() => pipelineRunsTable.id, {
      onDelete: "set null",
    }),
    moduleId: text("module_id")
      .notNull()
      .references(() => moduleCatalogTable.moduleId, { onDelete: "restrict" }),
    externalRunId: text("external_run_id").notNull(),
    title: text("title"),
    status: runStatusEnum("status").notNull().default("pending"),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>(),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
    summary: text("summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    externalRunUniqueIdx: uniqueIndex("module_runs_module_external_unique_idx").on(
      table.moduleId,
      table.externalRunId,
    ),
    moduleStatusIdx: index("module_runs_module_status_idx").on(
      table.moduleId,
      table.status,
    ),
    pipelineIdx: index("module_runs_pipeline_idx").on(table.pipelineRunId),
  }),
);

export const runEventsTable = pgTable(
  "run_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleRunId: uuid("module_run_id")
      .notNull()
      .references(() => moduleRunsTable.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title"),
    message: text("message"),
    severity: runEventSeverityEnum("severity").notNull().default("info"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runCreatedAtIdx: index("run_events_run_created_at_idx").on(
      table.moduleRunId,
      table.createdAt,
    ),
  }),
);

export const artifactsTable = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactKind: text("artifact_kind").notNull(),
    title: text("title").notNull(),
    contentText: text("content_text"),
    contentJson: jsonb("content_json").$type<Record<string, unknown>>(),
    sourceModuleId: text("source_module_id")
      .notNull()
      .references(() => moduleCatalogTable.moduleId, { onDelete: "restrict" }),
    sourceRunId: uuid("source_run_id")
      .notNull()
      .references(() => moduleRunsTable.id, { onDelete: "cascade" }),
    parentArtifactId: uuid("parent_artifact_id").references(
      (): AnyPgColumn => artifactsTable.id,
      { onDelete: "set null" },
    ),
    provenance: jsonb("provenance").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("artifacts_source_run_idx").on(table.sourceRunId),
    kindIdx: index("artifacts_kind_idx").on(table.artifactKind),
    parentIdx: index("artifacts_parent_idx").on(table.parentArtifactId),
  }),
);

export const typedDataRecordsTable = pgTable(
  "typed_data_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordKind: text("record_kind").notNull(),
    moduleId: text("module_id")
      .notNull()
      .references(() => moduleCatalogTable.moduleId, { onDelete: "restrict" }),
    moduleRunId: uuid("module_run_id").references(() => moduleRunsTable.id, {
      onDelete: "set null",
    }),
    artifactId: uuid("artifact_id").references(() => artifactsTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    contentText: text("content_text"),
    contentJson: jsonb("content_json").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    kindIdx: index("typed_data_records_kind_idx").on(table.recordKind),
    moduleIdx: index("typed_data_records_module_idx").on(table.moduleId),
    artifactIdx: index("typed_data_records_artifact_idx").on(table.artifactId),
  }),
);

export const agentConfigsTable = pgTable("agent_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  configKey: text("config_key").notNull().unique().default("default"),
  provider: agentProviderEnum("provider").notNull().default("openai"),
  endpoint: agentEndpointEnum("endpoint").notNull().default("responses"),
  modelId: text("model_id").notNull().default("gpt-5.5"),
  reasoningEffort: agentReasoningEffortEnum("reasoning_effort")
    .notNull()
    .default("medium"),
  systemPrompt: text("system_prompt").notNull(),
  businessSkillSettings: jsonb("business_skill_settings")
    .$type<
      Array<{
        moduleId: string;
        enabled: boolean;
        approvalRequired: boolean;
        canUseNetwork: boolean;
        canWriteDatabase: boolean;
      }>
    >()
    .notNull(),
  generalSkillSettings: jsonb("general_skill_settings")
    .$type<
      Array<{
        skillId: string;
        name: string;
        description: string;
        enabled: boolean;
        installed: boolean;
        installOnDemand: boolean;
        requiresApproval: boolean;
        canUseNetwork: boolean;
      }>
    >()
    .notNull(),
  memorySettings: jsonb("memory_settings")
    .$type<{
      shortTermEnabled: boolean;
      longTermEnabled: boolean;
      promotionMode: string;
      ragCollection: string;
      retentionDays: number;
    }>()
    .notNull(),
  safetySettings: jsonb("safety_settings")
    .$type<{
      requireApprovalForExternalActions: boolean;
      requireApprovalForPublishing: boolean;
      allowSelfLearning: boolean;
      maxToolSteps: number;
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentThreadSchema = createInsertSchema(agentThreadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAgentMessageSchema = createInsertSchema(agentMessagesTable).omit({
  id: true,
  createdAt: true,
});
export const insertModuleCatalogSchema = createInsertSchema(moduleCatalogTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertPipelineRunSchema = createInsertSchema(pipelineRunsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertModuleRunSchema = createInsertSchema(moduleRunsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRunEventSchema = createInsertSchema(runEventsTable).omit({
  id: true,
  createdAt: true,
});
export const insertArtifactSchema = createInsertSchema(artifactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTypedDataRecordSchema = createInsertSchema(
  typedDataRecordsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAgentConfigSchema = createInsertSchema(agentConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentThread = z.infer<typeof insertAgentThreadSchema>;
export type AgentThread = typeof agentThreadsTable.$inferSelect;
export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentMessage = typeof agentMessagesTable.$inferSelect;
export type InsertModuleCatalog = z.infer<typeof insertModuleCatalogSchema>;
export type ModuleCatalog = typeof moduleCatalogTable.$inferSelect;
export type InsertPipelineRun = z.infer<typeof insertPipelineRunSchema>;
export type PipelineRun = typeof pipelineRunsTable.$inferSelect;
export type InsertModuleRun = z.infer<typeof insertModuleRunSchema>;
export type ModuleRun = typeof moduleRunsTable.$inferSelect;
export type InsertRunEvent = z.infer<typeof insertRunEventSchema>;
export type RunEvent = typeof runEventsTable.$inferSelect;
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type Artifact = typeof artifactsTable.$inferSelect;
export type InsertTypedDataRecord = z.infer<typeof insertTypedDataRecordSchema>;
export type TypedDataRecord = typeof typedDataRecordsTable.$inferSelect;
export type InsertAgentConfig = z.infer<typeof insertAgentConfigSchema>;
export type AgentConfig = typeof agentConfigsTable.$inferSelect;
