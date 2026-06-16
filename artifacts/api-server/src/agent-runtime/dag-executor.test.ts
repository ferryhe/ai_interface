import assert from "node:assert/strict";
import test from "node:test";

import type {
  JsonObject,
  ModuleRunRecord,
  ModuleRunStatus,
} from "../modules/ingest-service";
import type { ModuleId } from "../modules/registry";
import {
  executeDagModuleRuns,
  validateDagPlan,
  evaluateQaSteps,
  type DagBlockedReason,
} from "./dag-executor";

interface TestDagStep {
  stepId?: string;
  moduleId: ModuleId;
  requiresApproval: boolean;
  dependsOn?: string[];
}

function moduleRun(id: string, moduleId: ModuleId): ModuleRunRecord {
  const now = new Date("2026-05-20T00:00:00.000Z");
  return {
    id,
    pipelineRunId: "pipeline-1",
    moduleId,
    externalRunId: `pipeline-1:${id}`,
    title: id,
    status: "pending",
    inputJson: {},
    outputJson: null,
    summary: null,
    metadata: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function updateRun(
  runs: Map<string, ModuleRunRecord>,
  run: ModuleRunRecord,
  status: ModuleRunStatus,
  metadata: JsonObject = run.metadata ?? {},
): ModuleRunRecord {
  const updated = {
    ...run,
    status,
    metadata,
    updatedAt: new Date("2026-05-20T00:01:00.000Z"),
  };
  runs.set(run.id, updated);
  return updated;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("validateDagPlan rejects unknown dependencies", () => {
  assert.throws(
    () =>
      validateDagPlan([
        {
          stepId: "index",
          moduleId: "md_to_rag",
          requiresApproval: false,
          dependsOn: ["convert"],
        },
      ]),
    /DAG step index depends on unknown step convert/,
  );
});

test("validateDagPlan rejects missing step ids", () => {
  assert.throws(
    () =>
      validateDagPlan([
        {
          moduleId: "doc_to_md",
          requiresApproval: false,
        },
      ]),
    /DAG step at index 1 is missing stepId/,
  );
});

test("validateDagPlan rejects duplicate step ids", () => {
  assert.throws(
    () =>
      validateDagPlan([
        {
          stepId: "convert",
          moduleId: "doc_to_md",
          requiresApproval: false,
        },
        {
          stepId: "convert",
          moduleId: "md_to_rag",
          requiresApproval: false,
        },
      ]),
    /DAG stepId is duplicated: convert/,
  );
});

test("validateDagPlan rejects dependency cycles", () => {
  assert.throws(
    () =>
      validateDagPlan([
        {
          stepId: "convert",
          moduleId: "doc_to_md",
          requiresApproval: false,
          dependsOn: ["index"],
        },
        {
          stepId: "index",
          moduleId: "md_to_rag",
          requiresApproval: false,
          dependsOn: ["convert"],
        },
      ]),
    /DAG plan has a dependency cycle: convert -> index -> convert/,
  );
});

test("executeDagModuleRuns executes independent ready steps in the same batch", async () => {
  const steps: TestDagStep[] = [
    { stepId: "listen", moduleId: "web_listening", requiresApproval: false },
    { stepId: "convert", moduleId: "doc_to_md", requiresApproval: false },
    {
      stepId: "index",
      moduleId: "md_to_rag",
      requiresApproval: false,
      dependsOn: ["listen", "convert"],
    },
  ];
  const initialRuns = [
    moduleRun("run-listen", "web_listening"),
    moduleRun("run-convert", "doc_to_md"),
    moduleRun("run-index", "md_to_rag"),
  ];
  const runs = new Map(initialRuns.map((run) => [run.id, run]));
  let active = 0;
  let maxActive = 0;

  await executeDagModuleRuns({
    steps,
    moduleRuns: initialRuns,
    executeStep: async ({ run }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(15);
      active -= 1;
      return updateRun(runs, run, "succeeded");
    },
    markApprovalRequired: async ({ run }) =>
      updateRun(runs, run, "pending", {
        adapterExecutionStatus: "approval_required",
      }),
    markBlocked: async ({ run, reason, blockedByStepIds }) =>
      updateRun(runs, run, "pending", {
        dagExecutionStatus: "blocked",
        dagBlockedReason: reason,
        dagBlockedByStepIds: blockedByStepIds,
      }),
  });

  assert.equal(maxActive, 2);
  assert.equal(runs.get("run-index")?.status, "succeeded");
});

test("executeDagModuleRuns caps ready-step concurrency", async () => {
  const steps: TestDagStep[] = Array.from({ length: 5 }, (_, index) => ({
    stepId: `step-${index + 1}`,
    moduleId: "doc_to_md",
    requiresApproval: false,
  }));
  const initialRuns = steps.map((step) =>
    moduleRun(`run-${step.stepId}`, step.moduleId),
  );
  const runs = new Map(initialRuns.map((run) => [run.id, run]));
  let active = 0;
  let maxActive = 0;
  const executed: string[] = [];

  await executeDagModuleRuns({
    steps,
    moduleRuns: initialRuns,
    maxConcurrency: 2,
    executeStep: async ({ run, stepId }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(15);
      executed.push(stepId);
      active -= 1;
      return updateRun(runs, run, "succeeded");
    },
    markApprovalRequired: async ({ run }) =>
      updateRun(runs, run, "pending", {
        adapterExecutionStatus: "approval_required",
      }),
    markBlocked: async ({ run, reason, blockedByStepIds }) =>
      updateRun(runs, run, "pending", {
        dagExecutionStatus: "blocked",
        dagBlockedReason: reason,
        dagBlockedByStepIds: blockedByStepIds,
      }),
  });

  assert.equal(maxActive, 2);
  assert.deepEqual(executed.sort(), [
    "step-1",
    "step-2",
    "step-3",
    "step-4",
    "step-5",
  ]);
  assert.equal(
    Array.from(runs.values()).every((run) => run.status === "succeeded"),
    true,
  );
});

test("executeDagModuleRuns waits for upstream completion before downstream execution", async () => {
  const steps: TestDagStep[] = [
    { stepId: "convert", moduleId: "doc_to_md", requiresApproval: false },
    {
      stepId: "index",
      moduleId: "md_to_rag",
      requiresApproval: false,
      dependsOn: ["convert"],
    },
  ];
  const initialRuns = [
    moduleRun("run-convert", "doc_to_md"),
    moduleRun("run-index", "md_to_rag"),
  ];
  const runs = new Map(initialRuns.map((run) => [run.id, run]));
  const completed: string[] = [];

  await executeDagModuleRuns({
    steps,
    moduleRuns: initialRuns,
    executeStep: async ({ run, stepId }) => {
      if (stepId === "index") {
        assert.deepEqual(completed, ["convert"]);
      }
      completed.push(stepId);
      return updateRun(runs, run, "succeeded");
    },
    markApprovalRequired: async ({ run }) =>
      updateRun(runs, run, "pending", {
        adapterExecutionStatus: "approval_required",
      }),
    markBlocked: async ({ run, reason, blockedByStepIds }) =>
      updateRun(runs, run, "pending", {
        dagExecutionStatus: "blocked",
        dagBlockedReason: reason,
        dagBlockedByStepIds: blockedByStepIds,
      }),
  });

  assert.deepEqual(completed, ["convert", "index"]);
});

test("executeDagModuleRuns blocks downstream steps behind approval-required upstreams", async () => {
  const steps: TestDagStep[] = [
    { stepId: "review", moduleId: "doc_to_md", requiresApproval: true },
    {
      stepId: "index",
      moduleId: "md_to_rag",
      requiresApproval: false,
      dependsOn: ["review"],
    },
  ];
  const initialRuns = [
    moduleRun("run-review", "doc_to_md"),
    moduleRun("run-index", "md_to_rag"),
  ];
  const runs = new Map(initialRuns.map((run) => [run.id, run]));
  const blockedReasons: DagBlockedReason[] = [];

  await executeDagModuleRuns({
    steps,
    moduleRuns: initialRuns,
    executeStep: async ({ run }) => updateRun(runs, run, "succeeded"),
    markApprovalRequired: async ({ run }) =>
      updateRun(runs, run, "pending", {
        adapterExecutionStatus: "approval_required",
      }),
    markBlocked: async ({ run, reason, blockedByStepIds }) => {
      blockedReasons.push(reason);
      return updateRun(runs, run, "pending", {
        dagExecutionStatus: "blocked",
        dagBlockedReason: reason,
        dagBlockedByStepIds: blockedByStepIds,
      });
    },
  });

  assert.equal(runs.get("run-review")?.status, "pending");
  assert.deepEqual(runs.get("run-index")?.metadata, {
    dagExecutionStatus: "blocked",
    dagBlockedReason: "approval_required",
    dagBlockedByStepIds: ["review"],
  });
  assert.deepEqual(blockedReasons, ["approval_required"]);
});

test("executeDagModuleRuns blocks downstream steps after failed upstreams with fail_fast", async () => {
  const steps: TestDagStep[] = [
    { stepId: "convert", moduleId: "doc_to_md", requiresApproval: false },
    {
      stepId: "index",
      moduleId: "md_to_rag",
      requiresApproval: false,
      dependsOn: ["convert"],
    },
  ];
  const initialRuns = [
    moduleRun("run-convert", "doc_to_md"),
    moduleRun("run-index", "md_to_rag"),
  ];
  const runs = new Map(initialRuns.map((run) => [run.id, run]));
  const executed: string[] = [];

  await executeDagModuleRuns({
    steps,
    moduleRuns: initialRuns,
    executeStep: async ({ run, stepId }) => {
      executed.push(stepId);
      return updateRun(runs, run, stepId === "convert" ? "failed" : "succeeded");
    },
    markApprovalRequired: async ({ run }) =>
      updateRun(runs, run, "pending", {
        adapterExecutionStatus: "approval_required",
      }),
    markBlocked: async ({ run, reason, blockedByStepIds }) =>
      updateRun(runs, run, "pending", {
        dagExecutionStatus: "blocked",
        dagBlockedReason: reason,
        dagBlockedByStepIds: blockedByStepIds,
      }),
  });

  assert.deepEqual(executed, ["convert"]);
  assert.deepEqual(runs.get("run-index")?.metadata, {
    dagExecutionStatus: "blocked",
    dagBlockedReason: "upstream_failed",
    dagBlockedByStepIds: ["convert"],
  });
});

test("executeDagModuleRuns continues independent branches when configured", async () => {
  const steps: TestDagStep[] = [
    { stepId: "convert", moduleId: "doc_to_md", requiresApproval: false },
    {
      stepId: "index",
      moduleId: "md_to_rag",
      requiresApproval: false,
      dependsOn: ["convert"],
    },
    {
      stepId: "listen",
      moduleId: "web_listening",
      requiresApproval: false,
    },
  ];
  const initialRuns = [
    moduleRun("run-convert", "doc_to_md"),
    moduleRun("run-index", "md_to_rag"),
    moduleRun("run-listen", "web_listening"),
  ];
  const runs = new Map(initialRuns.map((run) => [run.id, run]));
  const executed: string[] = [];

  await executeDagModuleRuns({
    steps,
    moduleRuns: initialRuns,
    failureStrategy: "continue_independent",
    executeStep: async ({ run, stepId }) => {
      executed.push(stepId);
      return updateRun(runs, run, stepId === "convert" ? "failed" : "succeeded");
    },
    markApprovalRequired: async ({ run }) =>
      updateRun(runs, run, "pending", {
        adapterExecutionStatus: "approval_required",
      }),
    markBlocked: async ({ run, reason, blockedByStepIds }) =>
      updateRun(runs, run, "pending", {
        dagExecutionStatus: "blocked",
        dagBlockedReason: reason,
        dagBlockedByStepIds: blockedByStepIds,
      }),
  });

  assert.deepEqual(executed, ["convert", "listen"]);
  assert.equal(runs.get("run-convert")?.status, "failed");
  assert.equal(runs.get("run-listen")?.status, "succeeded");
  assert.deepEqual(runs.get("run-index")?.metadata, {
    dagExecutionStatus: "blocked",
    dagBlockedReason: "upstream_failed",
    dagBlockedByStepIds: ["convert"],
  });
});


// ── QA Gate tests ──

test("QA gate: passes when all artifacts exist", () => {
  const evaluations = evaluateQaSteps(
    [{ stepId: "qa-1", dependsOn: ["step-a"], evidenceContract: { requiredArtifacts: ["a1"], assertionType: "presence", assertionConfig: {} } }],
    new Set(["step-a"]),
    ["a1"],
  );
  assert.equal(evaluations[0]!.passed, true);
});

test("QA gate: fails when artifact missing", () => {
  const evaluations = evaluateQaSteps(
    [{ stepId: "qa-1", dependsOn: ["step-a"], evidenceContract: { requiredArtifacts: ["a1","a2"], assertionType: "presence", assertionConfig: {} } }],
    new Set(["step-a"]),
    ["a1"],
  );
  assert.equal(evaluations[0]!.passed, false);
  assert.deepEqual(evaluations[0]!.missingArtifacts, ["a2"]);
});

test("QA gate: fails when upstream not complete", () => {
  const evaluations = evaluateQaSteps(
    [{ stepId: "qa-1", dependsOn: ["step-a"], evidenceContract: { requiredArtifacts: ["x"], assertionType: "presence", assertionConfig: {} } }],
    new Set([]),
    ["x"],
  );
  assert.equal(evaluations[0]!.passed, false);
  assert.equal(evaluations[0]!.reason, "upstream steps not complete");
});

test("QA gate: fails closed for unsupported assertion types", () => {
  const evaluations = evaluateQaSteps(
    [
      {
        stepId: "qa-json",
        dependsOn: ["step-a"],
        evidenceContract: {
          requiredArtifacts: ["artifact-1"],
          assertionType: "json_schema",
          assertionConfig: { schema: { type: "object" } },
        },
      },
      {
        stepId: "qa-content",
        dependsOn: ["step-a"],
        evidenceContract: {
          requiredArtifacts: ["artifact-1"],
          assertionType: "content_contains",
          assertionConfig: { text: "approved" },
        },
      },
    ],
    new Set(["step-a"]),
    ["artifact-1"],
  );

  assert.deepEqual(
    evaluations.map((evaluation) => ({
      stepId: evaluation.stepId,
      passed: evaluation.passed,
      missingArtifacts: evaluation.missingArtifacts,
      reason: evaluation.reason,
    })),
    [
      {
        stepId: "qa-json",
        passed: false,
        missingArtifacts: [],
        reason: "unsupported QA assertion type: json_schema",
      },
      {
        stepId: "qa-content",
        passed: false,
        missingArtifacts: [],
        reason: "unsupported QA assertion type: content_contains",
      },
    ],
  );
});

test("QA gate: checks required artifacts before assertion support", () => {
  const evaluations = evaluateQaSteps(
    [
      {
        stepId: "qa-json",
        dependsOn: ["step-a"],
        evidenceContract: {
          requiredArtifacts: ["artifact-1"],
          assertionType: "json_schema",
          assertionConfig: { schema: { type: "object" } },
        },
      },
    ],
    new Set(["step-a"]),
    [],
  );

  assert.deepEqual(evaluations[0], {
    stepId: "qa-json",
    passed: false,
    missingArtifacts: ["artifact-1"],
    reason: "missing artifacts: artifact-1",
  });
});
