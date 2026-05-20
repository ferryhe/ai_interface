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
import { type ModuleId } from "../modules/registry";
import {
  getAgentConfig,
  getConnectionStatus,
  type AgentConfigRecord,
  type AgentConfigRepository,
} from "../agent-config/agent-config-service";
import {
  businessSkillDefinitionFromManifest,
  getBusinessSkillSetting,
  listEnabledBusinessSkillDefinitions,
  type BusinessSkillDefinition,
} from "./skill-registry";
import { executeModuleRunWithAdapter } from "../tool-adapters/executor";
import { createToolAdapterExecutor } from "../tool-adapters/executor-router";
import { builtinSkillManifests, type SkillManifest } from "../skill-runtime/skill-manifest";
import {
  createSkillRuntimeRegistry,
  defaultSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";
import {
  createDeterministicPlannerPlan,
  createPlannerForProvider,
  selectPlannerProvider,
} from "./planner-providers";
import {
  executeDagModuleRuns,
  validateDagPlan,
  type AgentRuntimePlanMode,
  type DagBlockedReason,
  type DagFailureStrategy,
} from "./dag-executor";

export { OpenAIResponsesPlanner } from "./planner-providers";
export type { AgentRuntimePlanMode, DagFailureStrategy } from "./dag-executor";

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
  skillId: string;
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
  stepId?: string;
  dependsOn?: string[];
}

export interface AgentRuntimePlannerStep {
  skillId?: string;
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
  stepId?: string;
  dependsOn?: string[];
}

export interface AgentRuntimePlan {
  summary: string;
  mode: AgentRuntimePlanMode;
  failureStrategy: DagFailureStrategy;
  steps: AgentRuntimePlanStep[];
  warnings: string[];
}

export interface AgentRuntimePlannerPlan {
  summary: string;
  mode?: AgentRuntimePlanMode;
  failureStrategy?: DagFailureStrategy;
  steps: AgentRuntimePlannerStep[];
  warnings: string[];
}

interface PlannerRequest {
  message: string;
  config: AgentConfigRecord;
  enabledSkills: BusinessSkillDefinition[];
}

export interface AgentPlanner {
  createPlan(request: PlannerRequest): Promise<AgentRuntimePlannerPlan>;
}

export interface CreateAgentRunInput {
  message: string;
  threadId?: string;
  title?: string;
  metadata?: JsonObject;
  executionMode?: AgentRunExecutionMode;
  enabledSkillIds?: string[];
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

function normalizePlanMode(
  value: AgentRuntimePlannerPlan["mode"],
): AgentRuntimePlanMode {
  return value === "dag" ? "dag" : "linear";
}

function normalizeFailureStrategy(
  value: AgentRuntimePlannerPlan["failureStrategy"],
): DagFailureStrategy {
  return value === "continue_independent" ? value : "fail_fast";
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim());
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

function dagBlockedMetadata(
  metadata: JsonObject | null,
  input: {
    reason: DagBlockedReason;
    blockedByStepIds: string[];
  },
): JsonObject {
  return {
    ...(metadata ?? {}),
    dagExecutionStatus: "blocked",
    dagBlockedReason: input.reason,
    dagBlockedByStepIds: [...input.blockedByStepIds],
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
  rawPlan: AgentRuntimePlannerPlan,
  enabledSkills: BusinessSkillDefinition[],
  registeredSkills: BusinessSkillDefinition[],
): AgentRuntimePlan {
  const enabledSkillById = new Map(
    enabledSkills.map((skill) => [skill.skillId, skill]),
  );
  const enabledSkillByModuleId = new Map(
    enabledSkills.map((skill) => [skill.moduleId, skill]),
  );
  const registeredSkillById = new Map(
    registeredSkills.map((skill) => [skill.skillId, skill]),
  );
  const registeredSkillByModuleId = new Map(
    registeredSkills.map((skill) => [skill.moduleId, skill]),
  );
  const warnings = [...rawPlan.warnings];
  const steps: AgentRuntimePlanStep[] = [];
  const mode = normalizePlanMode(rawPlan.mode);
  const failureStrategy = normalizeFailureStrategy(rawPlan.failureStrategy);

  for (const rawStep of rawPlan.steps) {
    const rawSkillId = rawStep.skillId?.trim();
    const lookupKey = rawSkillId || rawStep.moduleId;
    const registeredDefinition =
      (rawSkillId ? registeredSkillById.get(rawSkillId) : undefined) ??
      registeredSkillByModuleId.get(rawStep.moduleId);
    if (!registeredDefinition) {
      warnings.push(`Planner returned unknown skill: ${String(lookupKey)}`);
      continue;
    }
    const definition =
      (rawSkillId ? enabledSkillById.get(rawSkillId) : undefined) ??
      enabledSkillByModuleId.get(rawStep.moduleId);
    if (!definition) {
      warnings.push(`Planner returned disabled skill: ${lookupKey}`);
      continue;
    }
    const stepId = rawStep.stepId?.trim();
    const dependsOn = normalizeStringArray(rawStep.dependsOn);
    steps.push({
      skillId: definition.skillId,
      moduleId: definition.moduleId,
      title: rawStep.title || definition.displayName,
      action: rawStep.action || definition.description,
      input: normalizeJsonObject(rawStep.input),
      requiresApproval: rawStep.requiresApproval,
      ...(stepId ? { stepId } : {}),
      ...(dependsOn ? { dependsOn } : {}),
    });
  }

  return {
    summary: rawPlan.summary || "Agent prepared a module execution plan.",
    mode,
    failureStrategy,
    steps,
    warnings,
  };
}

function deterministicPlan(
  message: string,
  enabledSkills: BusinessSkillDefinition[],
  reason: string,
): AgentRuntimePlan {
  return normalizePlan(
    createDeterministicPlannerPlan(message, enabledSkills, reason),
    enabledSkills,
    enabledSkills,
  );
}

function plannerConfigForActiveProvider(
  config: AgentConfigRecord,
  selection: ReturnType<typeof selectPlannerProvider>,
): AgentConfigRecord {
  const activeProvider = selection.definition.provider;
  if (activeProvider === config.provider) return config;

  return {
    ...config,
    provider: activeProvider,
    modelId: selection.definition.defaultModelId,
    reasoningEffort: selection.definition.supportsReasoningEffort
      ? config.reasoningEffort
      : "none",
  };
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

function dagPlanStepMetadata(
  plan: AgentRuntimePlan,
  step: AgentRuntimePlanStep,
): JsonObject {
  if (plan.mode !== "dag") return {};
  return {
    dagPlanMode: plan.mode,
    dagFailureStrategy: plan.failureStrategy,
    dagStepId: step.stepId,
    dagDependsOn: step.dependsOn ?? [],
  };
}

async function markApprovalRequiredModuleRun(
  repository: AgentRuntimeRepository,
  run: ModuleRunRecord,
  step: AgentRuntimePlanStep,
  definition: BusinessSkillDefinition,
): Promise<ModuleRunRecord> {
  const updatedRun = await repository.updateModuleRun(run.id, {
    status: "pending",
    metadata: executionMetadata(run.metadata, "approval_required"),
  });
  await recordModuleRunEvent(repository, updatedRun.id, {
    eventType: "tool.execution.approval_required",
    title: "Adapter execution requires approval",
    message: `Approval is required before executing ${step.moduleId}.`,
    severity: "info",
    payload: {
      adapterId: definition.adapter.adapterId,
      moduleId: step.moduleId,
      externalRunId: run.externalRunId,
      ...(step.stepId ? { stepId: step.stepId } : {}),
    },
  });
  return updatedRun;
}

async function markDagBlockedModuleRun(
  repository: AgentRuntimeRepository,
  run: ModuleRunRecord,
  step: AgentRuntimePlanStep,
  input: {
    reason: DagBlockedReason;
    blockedByStepIds: string[];
  },
): Promise<ModuleRunRecord> {
  const updatedRun = await repository.updateModuleRun(run.id, {
    status: "pending",
    metadata: dagBlockedMetadata(run.metadata, input),
  });
  await recordModuleRunEvent(repository, updatedRun.id, {
    eventType: "agent.plan.step.blocked",
    title: "DAG step blocked by dependency",
    message: `Step ${step.stepId ?? step.moduleId} is blocked by dependencies: ${input.blockedByStepIds.join(", ")}.`,
    severity: "info",
    payload: {
      moduleId: step.moduleId,
      externalRunId: run.externalRunId,
      stepId: step.stepId,
      reason: input.reason,
      blockedByStepIds: [...input.blockedByStepIds],
    },
  });
  return updatedRun;
}

export async function createAgentRun(
  repository: AgentRuntimeRepository,
  configRepository: AgentConfigRepository,
  input: CreateAgentRunInput,
  options: {
    env?: Record<string, string | undefined>;
    fetchFn?: typeof fetch;
    planner?: AgentPlanner;
    skillManifests?: SkillManifest[];
    registry?: SkillRuntimeRegistry;
  } = {},
): Promise<AgentRunResponse> {
  const env = options.env ?? process.env;
  const executionMode = input.executionMode ?? "plan_only";
  const skillRegistry =
    options.registry ??
    (options.skillManifests
      ? createSkillRuntimeRegistry([
          ...builtinSkillManifests,
          ...options.skillManifests,
        ])
      : defaultSkillRuntimeRegistry);
  const config = await getAgentConfig(configRepository, skillRegistry);
  const plannerSelection = selectPlannerProvider(config, env);
  const connection = getConnectionStatus(env, config.provider);
  const requestedSkillIds =
    input.enabledSkillIds ??
    (skillRegistry === defaultSkillRuntimeRegistry
      ? listEnabledBusinessSkillDefinitions(config.businessSkillSettings)
      : skillRegistry.listBusinessSkillDefinitions().filter((definition) => {
          const setting = getBusinessSkillSetting(
            config.businessSkillSettings,
            definition.moduleId,
          );
          return setting?.enabled === true;
        })
    ).map((skill) => skill.skillId);
  const enabledSkills = requestedSkillIds
    .map((skillId) => skillRegistry.getSkill(skillId))
    .filter((manifest): manifest is SkillManifest => Boolean(manifest))
    .map((manifest) => businessSkillDefinitionFromManifest(manifest));
  const enabledSkillById = new Map(
    enabledSkills.map((skill) => [skill.skillId, skill]),
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
    createPlannerForProvider(
      plannerSelection.definition.provider,
      env,
      options.fetchFn,
      plannerSelection.connection.status === "missing_key"
        ? plannerSelection.warnings.join(" ")
        : "",
    );

  const rawPlan = await planner.createPlan({
    message: input.message,
    config: plannerConfigForActiveProvider(config, plannerSelection),
    enabledSkills,
  });
  if (plannerSelection.definition.provider !== "deterministic") {
    rawPlan.warnings.unshift(...plannerSelection.warnings);
  }
  const plan = normalizePlan(
    rawPlan,
    enabledSkills,
    skillRegistry.listBusinessSkillDefinitions(),
  );

  if (plan.steps.length === 0) {
    const fallback = deterministicPlan(
      input.message,
      enabledSkills,
      "Planner returned no valid enabled module steps; used registry order fallback.",
    );
    plan.mode = fallback.mode;
    plan.failureStrategy = fallback.failureStrategy;
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

  if (effectivePlan.mode === "dag") {
    validateDagPlan(effectivePlan.steps);
  }

  const definitionForStep = (
    step: AgentRuntimePlanStep,
  ): BusinessSkillDefinition => {
    const stepSkillId = step.skillId ?? step.moduleId;
    return (
      enabledSkillById.get(stepSkillId) ??
      skillRegistry.getBusinessSkillDefinition(step.moduleId)
    );
  };

  const moduleRuns: ModuleRunRecord[] = [];
  for (const [index, step] of effectivePlan.steps.entries()) {
    const stepSkillId = step.skillId ?? step.moduleId;
    const definition = definitionForStep(step);
    const { run } = await createModuleRun(repository, {
      moduleId: step.moduleId,
      externalRunId: `${pipelineRun.id}:${index + 1}:${stepSkillId}`,
      pipelineRunId: pipelineRun.id,
      title: step.title,
      status: "pending",
      inputJson: step.input,
      registeredSkillIds: Array.from(new Set([step.moduleId, stepSkillId])),
      metadata: {
        skillId: stepSkillId,
        skillName: definition.displayName,
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
        project: definition.manifest?.project,
        skillUi: definition.manifest?.ui,
        artifactKinds: definition.manifest?.artifactKinds,
        ...dagPlanStepMetadata(effectivePlan, step),
      },
    }, { registry: skillRegistry });
    await recordModuleRunEvent(repository, run.id, {
      eventType: "agent.plan.step.created",
      title: step.title,
      message: step.action,
      payload: {
        pipelineRunId: pipelineRun.id,
        moduleId: step.moduleId,
        skillId: stepSkillId,
        requiresApproval: step.requiresApproval,
        ...(effectivePlan.mode === "dag"
          ? {
              planMode: effectivePlan.mode,
              failureStrategy: effectivePlan.failureStrategy,
              stepId: step.stepId,
              dependsOn: step.dependsOn ?? [],
            }
          : {}),
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
  let blockedModuleRunCount = 0;
  let responseModuleRuns = moduleRuns;
  if (executionMode === "execute_ready") {
    if (effectivePlan.mode === "dag") {
      const dagResult = await executeDagModuleRuns({
        steps: effectivePlan.steps,
        moduleRuns,
        failureStrategy: effectivePlan.failureStrategy,
        executeStep: async ({ step, run }) => {
          const definition = definitionForStep(step);
          const executor = createToolAdapterExecutor(definition.adapter, env);
          const result = await executeModuleRunWithAdapter(
            repository,
            run.id,
            executor,
            {
              env,
              registry: skillRegistry,
            },
          );
          return result.run;
        },
        markApprovalRequired: async ({ step, run }) =>
          markApprovalRequiredModuleRun(
            repository,
            run,
            step,
            definitionForStep(step),
          ),
        markBlocked: async ({ step, run, reason, blockedByStepIds }) =>
          markDagBlockedModuleRun(repository, run, step, {
            reason,
            blockedByStepIds,
          }),
      });
      skippedApprovalModuleRunCount =
        dagResult.skippedApprovalModuleRunCount;
      blockedModuleRunCount = dagResult.blockedModuleRunCount;
    } else {
      for (const [index, run] of moduleRuns.entries()) {
        const step = effectivePlan.steps[index];
        if (!step) continue;

        const definition = definitionForStep(step);
        if (step.requiresApproval) {
          skippedApprovalModuleRunCount += 1;
          await markApprovalRequiredModuleRun(
            repository,
            run,
            step,
            definition,
          );
          continue;
        }

        const executor = createToolAdapterExecutor(definition.adapter, env);
        await executeModuleRunWithAdapter(repository, run.id, executor, {
          env,
          registry: skillRegistry,
        });
      }
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
      planMode: effectivePlan.mode,
      executedModuleRunCount,
      skippedApprovalModuleRunCount,
      ...(effectivePlan.mode === "dag"
        ? {
            dagFailureStrategy: effectivePlan.failureStrategy,
            blockedModuleRunCount,
          }
        : {}),
    },
  });

  const agentMessage = await repository.createMessage({
    threadId: thread.id,
    role: "agent",
    content: plan.summary,
    metadata: {
      pipelineRunId: pipelineRun.id,
      runtimeStatus: status,
      planMode: effectivePlan.mode,
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
