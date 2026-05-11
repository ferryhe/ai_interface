import {
  recordModuleRunEvent,
  type JsonObject,
  type ModuleRunRecord,
  type ModuleRunRepository,
  type ModuleRunStatus,
  type RunEventRecord,
  type RunEventSeverity,
} from "../modules/ingest-service";
import {
  getAdapterDefinition,
  getAdapterReadiness,
  type ToolAdapterDefinition,
  type ToolAdapterReadiness,
} from "./adapter-registry";

export type ToolExecutionStatus = "succeeded" | "failed" | "skipped";

export interface ToolExecutionRequest {
  run: ModuleRunRecord;
  adapter: ToolAdapterDefinition;
  readiness: ToolAdapterReadiness;
}

export interface ToolExecutionResult {
  status: ToolExecutionStatus;
  summary: string | null;
  outputJson: JsonObject | null;
  eventType: string;
  eventTitle: string | null;
  eventMessage: string | null;
  eventSeverity: RunEventSeverity;
  eventPayload: JsonObject | null;
}

export interface ToolAdapterExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export interface ExecuteModuleRunWithAdapterOptions {
  env?: Record<string, string | undefined>;
}

export interface ExecuteModuleRunWithAdapterResponse {
  run: ModuleRunRecord;
  event: RunEventRecord;
  adapter: ToolAdapterDefinition;
  readiness: ToolAdapterReadiness;
  result: ToolExecutionResult | null;
}

export class FakeToolAdapterExecutor implements ToolAdapterExecutor {
  async execute({
    run,
    adapter,
  }: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return {
      status: "succeeded",
      summary: `Fake adapter execution completed for ${adapter.adapterId}.`,
      outputJson: {
        adapterId: adapter.adapterId,
        moduleId: adapter.moduleId,
        externalRunId: run.externalRunId,
        inputJson: run.inputJson,
        simulated: true,
      },
      eventType: "tool.execution.fake_completed",
      eventTitle: "Fake adapter execution completed",
      eventMessage: `Fake ${adapter.moduleId} adapter execution completed.`,
      eventSeverity: "info",
      eventPayload: {
        adapterId: adapter.adapterId,
        moduleId: adapter.moduleId,
        externalRunId: run.externalRunId,
        simulated: true,
      },
    };
  }
}

function executionMetadata(
  metadata: JsonObject | null,
  adapter: ToolAdapterDefinition,
  readiness: ToolAdapterReadiness,
  status: ToolExecutionStatus,
): JsonObject {
  return {
    ...(metadata ?? {}),
    adapterExecutionStatus: status,
    adapterId: adapter.adapterId,
    adapterKind: adapter.adapterKind,
    adapterReadinessStatus: readiness.status,
    adapterMissingRequiredEnv: [...readiness.missingRequiredEnv],
  };
}

function moduleRunStatusForExecution(
  status: ToolExecutionStatus,
): ModuleRunStatus {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  return "pending";
}

function failedExecutionResult(
  adapter: ToolAdapterDefinition,
): ToolExecutionResult {
  return {
    status: "failed",
    summary: `Adapter execution failed for ${adapter.adapterId}.`,
    outputJson: null,
    eventType: "tool.execution.failed",
    eventTitle: "Adapter execution failed",
    eventMessage: `Adapter execution failed for ${adapter.moduleId}.`,
    eventSeverity: "error",
    eventPayload: {
      adapterId: adapter.adapterId,
      moduleId: adapter.moduleId,
    },
  };
}

export async function executeModuleRunWithAdapter(
  repository: ModuleRunRepository,
  runId: string,
  executor: ToolAdapterExecutor,
  options: ExecuteModuleRunWithAdapterOptions = {},
): Promise<ExecuteModuleRunWithAdapterResponse> {
  const existing = await repository.findModuleRunById(runId);
  if (!existing) {
    throw new Error(`Module run not found: ${runId}`);
  }

  const adapter = getAdapterDefinition(existing.moduleId);
  const readiness = getAdapterReadiness(adapter, options.env ?? process.env);

  if (readiness.status === "missing_required_env") {
    const run = await repository.updateModuleRun(existing.id, {
      status: "pending",
      metadata: executionMetadata(
        existing.metadata,
        adapter,
        readiness,
        "skipped",
      ),
    });
    const event = await recordModuleRunEvent(repository, run.id, {
      eventType: "tool.execution.skipped",
      title: "Adapter configuration missing",
      message: `Missing required env: ${readiness.missingRequiredEnv.join(", ")}`,
      severity: "warning",
      payload: {
        adapterId: adapter.adapterId,
        moduleId: adapter.moduleId,
        missingRequiredEnv: [...readiness.missingRequiredEnv],
      },
    });

    return { run, event, adapter, readiness, result: null };
  }

  const runningRun = await repository.updateModuleRun(existing.id, {
    status: "running",
    startedAt: existing.startedAt ?? new Date(),
  });
  let result: ToolExecutionResult;
  try {
    result = await executor.execute({
      run: runningRun,
      adapter,
      readiness,
    });
  } catch {
    result = failedExecutionResult(adapter);
  }
  const run = await repository.updateModuleRun(runningRun.id, {
    status: moduleRunStatusForExecution(result.status),
    summary: result.summary,
    outputJson: result.outputJson,
    completedAt: new Date(),
    metadata: executionMetadata(
      runningRun.metadata,
      adapter,
      readiness,
      result.status,
    ),
  });
  const event = await recordModuleRunEvent(repository, run.id, {
    eventType: result.eventType,
    title: result.eventTitle ?? undefined,
    message: result.eventMessage ?? undefined,
    severity: result.eventSeverity,
    payload: result.eventPayload ?? undefined,
  });

  return { run, event, adapter, readiness, result };
}
