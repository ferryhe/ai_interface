import { randomUUID } from "node:crypto";

import {
  createModuleRun,
  recordModuleRunEvent,
  InMemoryModuleRunRepository,
  type JsonObject,
  type ModuleRunRecord,
  type ModuleRunRepository,
  type ModuleRunStatus,
} from "../modules/ingest-service";
import { type ModuleId, isKnownModuleId } from "../modules/registry";
import {
  getAgentConfig,
  getConnectionStatus,
  type AgentConfigRecord,
  type AgentConfigRepository,
} from "../agent-config/agent-config-service";
import {
  getBusinessSkillDefinition,
  getBusinessSkillSetting,
  listEnabledBusinessSkillDefinitions,
  type BusinessSkillDefinition,
} from "./skill-registry";
import {
  executeModuleRunWithAdapter,
  FakeToolAdapterExecutor,
} from "../tool-adapters/executor";

export type AgentRuntimeStatus =
  | "planned"
  | "missing_key"
  | "needs_approval"
  | "failed";

export type AgentRunExecutionMode = "plan_only" | "execute_ready";

export type AgentMessageRole = "user" | "agent" | "system" | "tool";

export interface AgentThreadRecord {
  id: string;
  title: string;
  status: "active" | "archived";
  metadata: JsonObject | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessageRecord {
  id: string;
  threadId: string;
  role: AgentMessageRole;
  content: string;
  metadata: JsonObject | null;
  createdAt: Date;
}

export interface PipelineRunRecord {
  id: string;
  threadId: string | null;
  title: string;
  status: ModuleRunStatus;
  activeModuleId: ModuleId | null;
  metadata: JsonObject | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRuntimeRepository extends ModuleRunRepository {
  createThread(input: {
    title: string;
    metadata: JsonObject | null;
  }): Promise<AgentThreadRecord>;
  findThreadById(id: string): Promise<AgentThreadRecord | null>;
  createMessage(input: {
    threadId: string;
    role: AgentMessageRole;
    content: string;
    metadata: JsonObject | null;
  }): Promise<AgentMessageRecord>;
  listMessages(threadId: string): Promise<AgentMessageRecord[]>;
  createPipelineRun(input: {
    threadId: string | null;
    title: string;
    status: ModuleRunStatus;
    activeModuleId: ModuleId | null;
    metadata: JsonObject | null;
  }): Promise<PipelineRunRecord>;
  updatePipelineRun(
    id: string,
    input: {
      status?: ModuleRunStatus;
      activeModuleId?: ModuleId | null;
      metadata?: JsonObject | null;
    },
  ): Promise<PipelineRunRecord>;
  findPipelineRunById(id: string): Promise<PipelineRunRecord | null>;
  listModuleRunsByPipelineRunId(
    pipelineRunId: string,
  ): Promise<ModuleRunRecord[]>;
}

export interface AgentRuntimePlanStep {
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
}

export interface AgentRuntimePlan {
  summary: string;
  steps: AgentRuntimePlanStep[];
  warnings: string[];
}

interface PlannerRequest {
  message: string;
  config: AgentConfigRecord;
  enabledSkills: BusinessSkillDefinition[];
}

export interface AgentPlanner {
  createPlan(request: PlannerRequest): Promise<AgentRuntimePlan>;
}

export interface CreateAgentRunInput {
  message: string;
  threadId?: string;
  title?: string;
  metadata?: JsonObject;
  executionMode?: AgentRunExecutionMode;
}

export interface AgentRunResponse {
  status: AgentRuntimeStatus;
  connection: ReturnType<typeof getConnectionStatus>;
  thread: AgentThreadRecord;
  userMessage: AgentMessageRecord;
  agentMessage: AgentMessageRecord;
  pipelineRun: PipelineRunRecord;
  moduleRuns: ModuleRunRecord[];
  plan: AgentRuntimePlan;
}

export interface AgentRunDetail {
  thread: AgentThreadRecord;
  messages: AgentMessageRecord[];
  pipelineRun: PipelineRunRecord;
  moduleRuns: ModuleRunRecord[];
}

function trimTitle(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "Agent run";
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

function normalizeJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function executionMetadata(
  metadata: JsonObject | null,
  status: "approval_required",
): JsonObject {
  return {
    ...(metadata ?? {}),
    adapterExecutionStatus: status,
  };
}

function pipelineStatusForModuleRuns(
  moduleRuns: ModuleRunRecord[],
): ModuleRunStatus {
  if (moduleRuns.some((run) => run.status === "failed")) return "failed";
  if (
    moduleRuns.length > 0 &&
    moduleRuns.every((run) => run.status === "succeeded")
  ) {
    return "succeeded";
  }
  if (
    moduleRuns.some((run) => run.status === "succeeded") &&
    moduleRuns.some((run) => run.status === "pending")
  ) {
    return "running";
  }
  if (moduleRuns.some((run) => run.status === "running")) return "running";
  return "pending";
}

function activeModuleIdForPipelineRun(
  moduleRuns: ModuleRunRecord[],
): ModuleId | null {
  return (
    moduleRuns.find((run) => run.status !== "succeeded")?.moduleId ?? null
  );
}

function countExecutedModuleRuns(moduleRuns: ModuleRunRecord[]): number {
  return moduleRuns.filter(
    (run) => run.status === "succeeded" || run.status === "failed",
  ).length;
}

function normalizePlan(
  rawPlan: AgentRuntimePlan,
  enabledSkills: BusinessSkillDefinition[],
): AgentRuntimePlan {
  const enabledModuleIds = new Set(
    enabledSkills.map((skill) => skill.moduleId),
  );
  const warnings = [...rawPlan.warnings];
  const steps: AgentRuntimePlanStep[] = [];

  for (const rawStep of rawPlan.steps) {
    if (!isKnownModuleId(rawStep.moduleId)) {
      warnings.push(
        `Planner returned unknown module: ${String(rawStep.moduleId)}`,
      );
      continue;
    }
    if (!enabledModuleIds.has(rawStep.moduleId)) {
      warnings.push(`Planner returned disabled module: ${rawStep.moduleId}`);
      continue;
    }
    const definition = getBusinessSkillDefinition(rawStep.moduleId);
    steps.push({
      moduleId: rawStep.moduleId,
      title: rawStep.title || definition.displayName,
      action: rawStep.action || definition.description,
      input: normalizeJsonObject(rawStep.input),
      requiresApproval: rawStep.requiresApproval,
    });
  }

  return {
    summary: rawPlan.summary || "Agent prepared a module execution plan.",
    steps,
    warnings,
  };
}

function deterministicPlan(
  message: string,
  enabledSkills: BusinessSkillDefinition[],
  reason: string,
): AgentRuntimePlan {
  const steps = enabledSkills.map((skill) => ({
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
      "Prepared a deterministic business-skill plan. Connect OPENAI_API_KEY to let the model choose and refine steps.",
    steps,
    warnings: [reason],
  };
}

function extractResponseText(payload: unknown): string {
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

export class OpenAIResponsesPlanner implements AgentPlanner {
  constructor(
    private readonly env: Record<string, string | undefined>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async createPlan(request: PlannerRequest): Promise<AgentRuntimePlan> {
    const apiKey = this.env["OPENAI_API_KEY"]?.trim();
    if (!apiKey) {
      return deterministicPlan(
        request.message,
        request.enabledSkills,
        "OPENAI_API_KEY is missing.",
      );
    }

    const moduleDescriptions = request.enabledSkills.map((skill) => ({
      moduleId: skill.moduleId,
      description: skill.description,
      canonicalEntrypoints: skill.canonicalEntrypoints,
      outputContracts: skill.outputContracts,
      permissionDefaults: skill.permissionDefaults,
    }));

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
              "Each step must use one enabled moduleId and must not claim external execution has already happened.",
          },
          {
            role: "user",
            content: JSON.stringify({
              userRequest: request.message,
              enabledBusinessSkills: moduleDescriptions,
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

    const payload = await response.json();
    const text = extractResponseText(payload);
    const parsed = JSON.parse(text) as AgentRuntimePlan;
    return normalizePlan(parsed, request.enabledSkills);
  }
}

export class InMemoryAgentRuntimeRepository
  extends InMemoryModuleRunRepository
  implements AgentRuntimeRepository
{
  readonly threads: AgentThreadRecord[] = [];
  readonly messages: AgentMessageRecord[] = [];
  readonly pipelineRuns: PipelineRunRecord[] = [];

  async createThread(input: {
    title: string;
    metadata: JsonObject | null;
  }): Promise<AgentThreadRecord> {
    const now = new Date();
    const thread: AgentThreadRecord = {
      id: randomUUID(),
      title: input.title,
      status: "active",
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.threads.push(thread);
    return thread;
  }

  async findThreadById(id: string): Promise<AgentThreadRecord | null> {
    return this.threads.find((thread) => thread.id === id) ?? null;
  }

  async createMessage(input: {
    threadId: string;
    role: AgentMessageRole;
    content: string;
    metadata: JsonObject | null;
  }): Promise<AgentMessageRecord> {
    const message: AgentMessageRecord = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
    };
    this.messages.push(message);
    return message;
  }

  async listMessages(threadId: string): Promise<AgentMessageRecord[]> {
    return this.messages.filter((message) => message.threadId === threadId);
  }

  async createPipelineRun(input: {
    threadId: string | null;
    title: string;
    status: ModuleRunStatus;
    activeModuleId: ModuleId | null;
    metadata: JsonObject | null;
  }): Promise<PipelineRunRecord> {
    const now = new Date();
    const pipelineRun: PipelineRunRecord = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.pipelineRuns.push(pipelineRun);
    this.pipelineRunIds.add(pipelineRun.id);
    return pipelineRun;
  }

  async updatePipelineRun(
    id: string,
    input: {
      status?: ModuleRunStatus;
      activeModuleId?: ModuleId | null;
      metadata?: JsonObject | null;
    },
  ): Promise<PipelineRunRecord> {
    const index = this.pipelineRuns.findIndex((run) => run.id === id);
    if (index === -1) throw new Error(`Pipeline run not found: ${id}`);

    const updated = {
      ...this.pipelineRuns[index]!,
      ...input,
      updatedAt: new Date(),
    };
    this.pipelineRuns[index] = updated;
    return updated;
  }

  async findPipelineRunById(id: string): Promise<PipelineRunRecord | null> {
    return this.pipelineRuns.find((run) => run.id === id) ?? null;
  }

  async listModuleRunsByPipelineRunId(
    pipelineRunId: string,
  ): Promise<ModuleRunRecord[]> {
    return this.moduleRuns.filter((run) => run.pipelineRunId === pipelineRunId);
  }
}

export async function createAgentRun(
  repository: AgentRuntimeRepository,
  configRepository: AgentConfigRepository,
  input: CreateAgentRunInput,
  options: {
    env?: Record<string, string | undefined>;
    planner?: AgentPlanner;
  } = {},
): Promise<AgentRunResponse> {
  const env = options.env ?? process.env;
  const executionMode = input.executionMode ?? "plan_only";
  const config = await getAgentConfig(configRepository);
  const connection = getConnectionStatus(env);
  const enabledSkills = listEnabledBusinessSkillDefinitions(
    config.businessSkillSettings,
  );

  if (enabledSkills.length === 0) {
    throw new Error(
      "At least one business skill must be enabled before creating an Agent run.",
    );
  }

  const title = input.title ?? trimTitle(input.message);
  const thread = input.threadId
    ? await repository.findThreadById(input.threadId)
    : await repository.createThread({
        title,
        metadata: { ...(input.metadata ?? {}), source: "agent-runtime" },
      });

  if (!thread) {
    throw new Error(`Agent thread not found: ${input.threadId}`);
  }

  const userMessage = await repository.createMessage({
    threadId: thread.id,
    role: "user",
    content: input.message,
    metadata: input.metadata ?? null,
  });

  let pipelineRun = await repository.createPipelineRun({
    threadId: thread.id,
    title,
    status: "pending",
    activeModuleId: enabledSkills[0]?.moduleId ?? null,
    metadata: {
      source: "agent-runtime",
      connectionStatus: connection.status,
    },
  });

  const planner =
    options.planner ??
    (connection.status === "configured"
      ? new OpenAIResponsesPlanner(env)
      : {
          createPlan: (request: PlannerRequest) =>
            Promise.resolve(
              deterministicPlan(
                request.message,
                request.enabledSkills,
                "OPENAI_API_KEY is missing.",
              ),
            ),
        });

  const rawPlan = await planner.createPlan({
    message: input.message,
    config,
    enabledSkills,
  });
  const plan = normalizePlan(rawPlan, enabledSkills);

  if (plan.steps.length === 0) {
    const fallback = deterministicPlan(
      input.message,
      enabledSkills,
      "Planner returned no valid enabled module steps; used registry order fallback.",
    );
    plan.steps.push(...fallback.steps);
    plan.warnings.push(...fallback.warnings);
  }

  const effectivePlan: AgentRuntimePlan = {
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      requiresApproval:
        step.requiresApproval ||
        getBusinessSkillSetting(config.businessSkillSettings, step.moduleId)
          ?.approvalRequired === true,
    })),
  };

  const moduleRuns: ModuleRunRecord[] = [];
  for (const [index, step] of effectivePlan.steps.entries()) {
    const definition = getBusinessSkillDefinition(step.moduleId);
    const { run } = await createModuleRun(repository, {
      moduleId: step.moduleId,
      externalRunId: `${pipelineRun.id}:${index + 1}:${step.moduleId}`,
      pipelineRunId: pipelineRun.id,
      title: step.title,
      status: "pending",
      inputJson: step.input,
      metadata: {
        action: step.action,
        requiresApproval: step.requiresApproval,
        adapterMode: definition.adapterMode,
        adapterId: definition.adapter.adapterId,
        adapterKind: definition.adapter.adapterKind,
        adapterRequiredEnv: definition.adapter.requiredEnv,
        adapterOptionalEnv: definition.adapter.optionalEnv,
        adapterTimeoutMs: definition.adapter.timeoutMs,
        adapterMaxOutputBytes: definition.adapter.maxOutputBytes,
        adapterAllowedCommands: definition.adapter.allowedCommands,
        adapterSupportsResume: definition.adapter.supportsResume,
        adapterReadinessHint: definition.adapter.readinessHint,
        canonicalEntrypoints: definition.canonicalEntrypoints,
        outputContracts: definition.outputContracts,
        sourceRepo: definition.adapter.sourceRepo,
      },
    });
    await recordModuleRunEvent(repository, run.id, {
      eventType: "agent.plan.step.created",
      title: step.title,
      message: step.action,
      payload: {
        pipelineRunId: pipelineRun.id,
        moduleId: step.moduleId,
        requiresApproval: step.requiresApproval,
      },
    });
    moduleRuns.push(run);
  }

  let status: AgentRuntimeStatus =
    connection.status === "missing_key"
      ? "missing_key"
      : effectivePlan.steps.some((step) => step.requiresApproval)
        ? "needs_approval"
        : "planned";

  let skippedApprovalModuleRunCount = 0;
  let responseModuleRuns = moduleRuns;
  if (executionMode === "execute_ready") {
    const executor = new FakeToolAdapterExecutor();
    for (const [index, run] of moduleRuns.entries()) {
      const step = effectivePlan.steps[index];
      if (!step) continue;

      if (step.requiresApproval) {
        skippedApprovalModuleRunCount += 1;
        const definition = getBusinessSkillDefinition(step.moduleId);
        await repository.updateModuleRun(run.id, {
          status: "pending",
          metadata: executionMetadata(run.metadata, "approval_required"),
        });
        await recordModuleRunEvent(repository, run.id, {
          eventType: "tool.execution.approval_required",
          title: "Adapter execution requires approval",
          message: `Approval is required before executing ${step.moduleId}.`,
          severity: "info",
          payload: {
            adapterId: definition.adapter.adapterId,
            moduleId: step.moduleId,
            externalRunId: run.externalRunId,
          },
        });
        continue;
      }

      await executeModuleRunWithAdapter(repository, run.id, executor, { env });
    }

    responseModuleRuns = await repository.listModuleRunsByPipelineRunId(
      pipelineRun.id,
    );
  }

  const executedModuleRunCount =
    executionMode === "execute_ready"
      ? countExecutedModuleRuns(responseModuleRuns)
      : 0;
  const pipelineStatus =
    executionMode === "execute_ready"
      ? pipelineStatusForModuleRuns(responseModuleRuns)
      : "pending";
  if (pipelineStatus === "failed") {
    status = "failed";
  }

  pipelineRun = await repository.updatePipelineRun(pipelineRun.id, {
    status: pipelineStatus,
    activeModuleId: activeModuleIdForPipelineRun(responseModuleRuns),
    metadata: {
      source: "agent-runtime",
      runtimeStatus: status,
      connectionStatus: connection.status,
      plannedStepCount: moduleRuns.length,
      executionMode,
      executedModuleRunCount,
      skippedApprovalModuleRunCount,
    },
  });

  const agentMessage = await repository.createMessage({
    threadId: thread.id,
    role: "agent",
    content: plan.summary,
    metadata: {
      pipelineRunId: pipelineRun.id,
      runtimeStatus: status,
      plannedModuleRunIds: responseModuleRuns.map((run) => run.id),
    },
  });

  return {
    status,
    connection,
    thread,
    userMessage,
    agentMessage,
    pipelineRun,
    moduleRuns: responseModuleRuns,
    plan: effectivePlan,
  };
}

export async function getAgentRunDetail(
  repository: AgentRuntimeRepository,
  pipelineRunId: string,
): Promise<AgentRunDetail> {
  const pipelineRun = await repository.findPipelineRunById(pipelineRunId);
  if (!pipelineRun) {
    throw new Error(`Agent run not found: ${pipelineRunId}`);
  }
  if (!pipelineRun.threadId) {
    throw new Error(`Agent run has no thread: ${pipelineRunId}`);
  }

  const thread = await repository.findThreadById(pipelineRun.threadId);
  if (!thread) {
    throw new Error(`Agent thread not found: ${pipelineRun.threadId}`);
  }

  const [messages, moduleRuns] = await Promise.all([
    repository.listMessages(thread.id),
    repository.listModuleRunsByPipelineRunId(pipelineRun.id),
  ]);

  return {
    thread,
    messages,
    pipelineRun,
    moduleRuns,
  };
}
