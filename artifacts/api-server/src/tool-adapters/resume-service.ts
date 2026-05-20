import {
  getCurrentInteraction,
  recordModuleRunEvent,
  type ModuleRunRepository,
  type ToolInteraction,
  type ToolInteractionResponse,
} from "../modules/ingest-service";
import { getAdapterDefinition, getAdapterReadiness } from "./adapter-registry";
import { executeModuleRunWithAdapter } from "./executor";
import { createToolAdapterExecutor } from "./executor-router";
import type { SkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";

export interface ResumeModuleRunExecutionOptions {
  env?: Record<string, string | undefined>;
  registry?: SkillRuntimeRegistry;
}

export class ModuleRunResumeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModuleRunResumeConflictError";
  }
}

function assertResumableInteraction(
  interaction: ToolInteraction | null,
  runId: string,
): asserts interaction is ToolInteraction {
  if (!interaction) {
    throw new ModuleRunResumeConflictError(
      `Module run has no resumable interaction: ${runId}`,
    );
  }
  if (interaction.status === "resumed") {
    throw new ModuleRunResumeConflictError(
      `Module run interaction is already resumed: ${runId}`,
    );
  }
  if (interaction.status !== "resumable") {
    throw new ModuleRunResumeConflictError(
      `Module run has no resumable interaction: ${runId}`,
    );
  }
}

function markInteractionResumed(
  interaction: ToolInteraction,
): ToolInteraction {
  return {
    ...interaction,
    status: "resumed",
    metadata: {
      ...interaction.metadata,
      resumedAt: new Date().toISOString(),
    },
  };
}

export async function resumeModuleRunExecution(
  repository: ModuleRunRepository,
  runId: string,
  options: ResumeModuleRunExecutionOptions = {},
): Promise<ToolInteractionResponse> {
  const existing = await repository.findModuleRunById(runId);
  if (!existing) {
    throw new Error(`Module run not found: ${runId}`);
  }

  const currentInteraction = getCurrentInteraction(existing);
  assertResumableInteraction(currentInteraction, runId);

  const adapter = getAdapterDefinition(existing.moduleId, options.registry);
  if (!adapter.supportsResume) {
    throw new ModuleRunResumeConflictError(
      `Adapter does not support resume: ${adapter.adapterId}`,
    );
  }

  const env = options.env ?? process.env;
  const readiness = getAdapterReadiness(adapter, env);
  if (readiness.status === "missing_required_env") {
    const execution = await executeModuleRunWithAdapter(
      repository,
      existing.id,
      createToolAdapterExecutor(adapter, env),
      { env, registry: options.registry },
    );
    return {
      run: execution.run,
      event: execution.event,
      interaction: currentInteraction,
    };
  }

  const interaction = markInteractionResumed(currentInteraction);
  const consumedRun = await repository.consumeResumableInteraction(
    existing.id,
    currentInteraction.interactionId,
    interaction,
  );
  if (!consumedRun) {
    throw new ModuleRunResumeConflictError(
      `Module run interaction is no longer resumable: ${runId}`,
    );
  }
  const event = await recordModuleRunEvent(repository, consumedRun.id, {
    eventType: "tool.execution.resume_requested",
    title: "Module run resume requested",
    message: `Resume requested for ${existing.moduleId}.`,
    severity: "info",
    payload: {
      interactionId: interaction.interactionId,
      resumeHandle: interaction.resumeHandle,
      adapterId: adapter.adapterId,
      moduleId: adapter.moduleId,
      externalRunId: existing.externalRunId,
    },
  });

  const execution = await executeModuleRunWithAdapter(
    repository,
    consumedRun.id,
    createToolAdapterExecutor(adapter, env),
    { env, registry: options.registry },
  );

  return {
    run: execution.run,
    event,
    interaction,
  };
}
