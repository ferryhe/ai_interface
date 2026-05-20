import type {
  ModuleRunRecord,
  ModuleRunStatus,
} from "../modules/ingest-service";
import type { ModuleId } from "../modules/registry";

export type AgentRuntimePlanMode = "linear" | "dag";

export type DagFailureStrategy = "fail_fast" | "continue_independent";

export const DEFAULT_DAG_MAX_CONCURRENCY = 8;

export type DagBlockedReason =
  | "approval_required"
  | "upstream_failed"
  | "upstream_blocked"
  | "fail_fast";

export interface DagPlanStep {
  stepId?: string;
  moduleId: ModuleId;
  requiresApproval: boolean;
  dependsOn?: string[];
}

export interface ValidatedDagStep<TStep extends DagPlanStep = DagPlanStep> {
  step: TStep;
  index: number;
  stepId: string;
  dependsOn: string[];
}

export interface DagExecutionContext<
  TStep extends DagPlanStep,
  TRun extends ModuleRunRecord,
> extends ValidatedDagStep<TStep> {
  run: TRun;
}

export interface DagBlockedContext<
  TStep extends DagPlanStep,
  TRun extends ModuleRunRecord,
> extends DagExecutionContext<TStep, TRun> {
  reason: DagBlockedReason;
  blockedByStepIds: string[];
}

export interface ExecuteDagModuleRunsInput<
  TStep extends DagPlanStep,
  TRun extends ModuleRunRecord,
> {
  steps: TStep[];
  moduleRuns: TRun[];
  failureStrategy?: DagFailureStrategy;
  maxConcurrency?: number;
  executeStep(
    context: DagExecutionContext<TStep, TRun>,
  ): Promise<TRun>;
  markApprovalRequired(
    context: DagExecutionContext<TStep, TRun>,
  ): Promise<TRun>;
  markBlocked(context: DagBlockedContext<TStep, TRun>): Promise<TRun>;
}

export interface ExecuteDagModuleRunsResult<TRun extends ModuleRunRecord> {
  moduleRuns: TRun[];
  skippedApprovalModuleRunCount: number;
  blockedModuleRunCount: number;
}

type DagStepState =
  | "pending"
  | "succeeded"
  | "failed"
  | "approval_required"
  | "blocked";

function normalizeStepId(value: string | undefined, index: number): string {
  const stepId = value?.trim();
  if (!stepId) {
    throw new Error(`DAG step at index ${index + 1} is missing stepId.`);
  }
  return stepId;
}

function normalizeDependsOn(value: string[] | undefined, stepId: string): string[] {
  if (!value) return [];
  const normalized: string[] = [];
  for (const [index, item] of value.entries()) {
    const dependency = item.trim();
    if (!dependency) {
      throw new Error(
        `DAG step ${stepId} has an invalid dependsOn value at index ${index + 1}.`,
      );
    }
    normalized.push(dependency);
  }
  return Array.from(new Set(normalized));
}

function assertAcyclic<TStep extends DagPlanStep>(
  nodes: ValidatedDagStep<TStep>[],
): void {
  const byId = new Map(nodes.map((node) => [node.stepId, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(stepId: string, path: string[]): void {
    if (visiting.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      const cyclePath = [
        ...(cycleStart === -1 ? path : path.slice(cycleStart)),
        stepId,
      ];
      throw new Error(
        `DAG plan has a dependency cycle: ${cyclePath.join(" -> ")}`,
      );
    }
    if (visited.has(stepId)) return;

    visiting.add(stepId);
    const node = byId.get(stepId);
    if (!node) return;
    for (const dependency of node.dependsOn) {
      visit(dependency, [...path, stepId]);
    }
    visiting.delete(stepId);
    visited.add(stepId);
  }

  for (const node of nodes) {
    visit(node.stepId, []);
  }
}

export function validateDagPlan<TStep extends DagPlanStep>(
  steps: TStep[],
): ValidatedDagStep<TStep>[] {
  const seen = new Set<string>();
  const nodes = steps.map((step, index) => {
    const stepId = normalizeStepId(step.stepId, index);
    if (seen.has(stepId)) {
      throw new Error(`DAG stepId is duplicated: ${stepId}`);
    }
    seen.add(stepId);

    return {
      step,
      index,
      stepId,
      dependsOn: normalizeDependsOn(step.dependsOn, stepId),
    };
  });

  for (const node of nodes) {
    for (const dependency of node.dependsOn) {
      if (!seen.has(dependency)) {
        throw new Error(
          `DAG step ${node.stepId} depends on unknown step ${dependency}`,
        );
      }
    }
  }

  assertAcyclic(nodes);
  return nodes;
}

function stateForRunStatus(status: ModuleRunStatus): DagStepState {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "cancelled") return "failed";
  return "blocked";
}

function blockedReasonForStates(states: DagStepState[]): DagBlockedReason {
  if (states.includes("failed")) return "upstream_failed";
  if (states.includes("approval_required")) return "approval_required";
  return "upstream_blocked";
}

function normalizeMaxConcurrency(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DAG_MAX_CONCURRENCY;
  }
  const normalized = Math.floor(value);
  return normalized >= 1 ? normalized : DEFAULT_DAG_MAX_CONCURRENCY;
}

function blockingDependencies(
  node: ValidatedDagStep,
  states: Map<string, DagStepState>,
): string[] {
  return node.dependsOn.filter((dependency) => {
    const state = states.get(dependency);
    return (
      state === "failed" ||
      state === "approval_required" ||
      state === "blocked"
    );
  });
}

async function markBlockedBatch<
  TStep extends DagPlanStep,
  TRun extends ModuleRunRecord,
>(
  contexts: Array<DagExecutionContext<TStep, TRun>>,
  latestRuns: TRun[],
  states: Map<string, DagStepState>,
  reason: DagBlockedReason,
  blockedByStepIds: string[],
  markBlocked: ExecuteDagModuleRunsInput<TStep, TRun>["markBlocked"],
): Promise<number> {
  let blockedCount = 0;
  for (const context of contexts) {
    if (states.get(context.stepId) !== "pending") continue;
    const updatedRun = await markBlocked({
      ...context,
      run: latestRuns[context.index]!,
      reason,
      blockedByStepIds,
    });
    latestRuns[context.index] = updatedRun;
    states.set(context.stepId, "blocked");
    blockedCount += 1;
  }
  return blockedCount;
}

export async function executeDagModuleRuns<
  TStep extends DagPlanStep,
  TRun extends ModuleRunRecord,
>(
  input: ExecuteDagModuleRunsInput<TStep, TRun>,
): Promise<ExecuteDagModuleRunsResult<TRun>> {
  const failureStrategy = input.failureStrategy ?? "fail_fast";
  const maxConcurrency = normalizeMaxConcurrency(input.maxConcurrency);
  const nodes = validateDagPlan(input.steps);
  if (nodes.length !== input.moduleRuns.length) {
    throw new Error(
      `DAG plan step count ${nodes.length} does not match module run count ${input.moduleRuns.length}.`,
    );
  }

  const contexts = nodes.map((node) => ({
    ...node,
    run: input.moduleRuns[node.index]!,
  }));
  const latestRuns = [...input.moduleRuns];
  const states = new Map<string, DagStepState>(
    nodes.map((node) => [node.stepId, "pending"]),
  );
  let skippedApprovalModuleRunCount = 0;
  let blockedModuleRunCount = 0;

  while (contexts.some((context) => states.get(context.stepId) === "pending")) {
    const pending = contexts.filter(
      (context) => states.get(context.stepId) === "pending",
    );

    for (const context of pending) {
      const blockers = blockingDependencies(context, states);
      if (blockers.length === 0) continue;
      const blockerStates = blockers.map((stepId) => states.get(stepId)!);
      const reason = blockedReasonForStates(blockerStates);
      blockedModuleRunCount += await markBlockedBatch(
        [context],
        latestRuns,
        states,
        reason,
        blockers,
        input.markBlocked,
      );
    }

    const failedStepIds = contexts
      .filter((context) => states.get(context.stepId) === "failed")
      .map((context) => context.stepId);
    if (failureStrategy === "fail_fast" && failedStepIds.length > 0) {
      const stillPending = contexts.filter(
        (context) => states.get(context.stepId) === "pending",
      );
      blockedModuleRunCount += await markBlockedBatch(
        stillPending,
        latestRuns,
        states,
        "fail_fast",
        failedStepIds,
        input.markBlocked,
      );
      break;
    }

    const ready = contexts.filter(
      (context) =>
        states.get(context.stepId) === "pending" &&
        context.dependsOn.every(
          (dependency) => states.get(dependency) === "succeeded",
        ),
    );

    if (ready.length === 0) {
      const stillPending = contexts.filter(
        (context) => states.get(context.stepId) === "pending",
      );
      for (const context of stillPending) {
        const blockers = context.dependsOn.filter(
          (dependency) => states.get(dependency) !== "succeeded",
        );
        blockedModuleRunCount += await markBlockedBatch(
          [context],
          latestRuns,
          states,
          "upstream_blocked",
          blockers,
          input.markBlocked,
        );
      }
      break;
    }

    for (const context of ready.filter((item) => item.step.requiresApproval)) {
      const updatedRun = await input.markApprovalRequired({
        ...context,
        run: latestRuns[context.index]!,
      });
      latestRuns[context.index] = updatedRun;
      states.set(context.stepId, "approval_required");
      skippedApprovalModuleRunCount += 1;
    }

    const executable = ready.filter((item) => !item.step.requiresApproval);
    const executedRuns: Array<{
      context: DagExecutionContext<TStep, TRun>;
      run: TRun;
    }> = [];
    for (let index = 0; index < executable.length; index += maxConcurrency) {
      const batch = executable.slice(index, index + maxConcurrency);
      executedRuns.push(
        ...(await Promise.all(
          batch.map(async (context) => ({
            context,
            run: await input.executeStep({
              ...context,
              run: latestRuns[context.index]!,
            }),
          })),
        )),
      );
    }

    for (const { context, run } of executedRuns) {
      latestRuns[context.index] = run;
      states.set(context.stepId, stateForRunStatus(run.status));
    }
  }

  return {
    moduleRuns: latestRuns,
    skippedApprovalModuleRunCount,
    blockedModuleRunCount,
  };
}
