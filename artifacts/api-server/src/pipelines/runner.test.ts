import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type {
  PipelineArtifactPayload,
  StepExecutor,
} from "./runner";
import {
  ActuarialPipelineRunnerService,
} from "./runner";
import type { ActuarialPipelineManifest } from "./manifest";

function artifact(kind: string, path: string, contentJson: Record<string, unknown>): PipelineArtifactPayload {
  return {
    artifactKind: kind,
    path,
    exists: true,
    contentJson,
    contentText: JSON.stringify(contentJson),
  };
}

class FakeStepExecutor implements StepExecutor {
  readonly executed: Array<{ stepId: string; input: Record<string, string> }> = [];

  constructor(private readonly governanceStatus: "pass" | "review_required") {}

  async executeStep(request: Parameters<StepExecutor["executeStep"]>[0]) {
    this.executed.push({ stepId: request.step.id, input: { ...request.resolvedInputs } });
    const artifactPath = (name: string) => join(request.artifactRoot, name);

    if (request.step.id === "calc") {
      const deterministicPath = artifactPath("deterministic_result.json");
      return {
        status: "completed" as const,
        output: { step: "calc" },
        stdout: "calc ok",
        stderr: "",
        stdoutLogPath: null,
        stderrLogPath: null,
        exitCode: 0,
        error: null,
        artifacts: [artifact("deterministic_result", deterministicPath, { ibnr: 123 })],
      };
    }

    if (request.step.id === "narrative") {
      assert.match(request.resolvedInputs.case_input ?? "", /case_input\.json$/);
      assert.match(request.resolvedInputs.deterministic_result ?? "", /deterministic_result\.json$/);
      const narrativePath = artifactPath("narrative_draft.json");
      return {
        status: "completed" as const,
        output: { step: "narrative" },
        stdout: "narrative ok",
        stderr: "",
        stdoutLogPath: null,
        stderrLogPath: null,
        exitCode: 0,
        error: null,
        artifacts: [artifact("narrative_draft", narrativePath, { text: "draft" })],
      };
    }

    if (request.step.id === "governance") {
      assert.match(request.resolvedInputs.case_input ?? "", /case_input\.json$/);
      assert.match(request.resolvedInputs.deterministic_result ?? "", /deterministic_result\.json$/);
      assert.match(request.resolvedInputs.narrative_draft ?? "", /narrative_draft\.json$/);
      const checkPath = artifactPath("constitution_check.json");
      return {
        status: "completed" as const,
        output: { status: this.governanceStatus },
        stdout: "governance ok",
        stderr: "",
        stdoutLogPath: null,
        stderrLogPath: null,
        exitCode: 0,
        error: null,
        artifacts: [artifact("constitution_check", checkPath, { status: this.governanceStatus })],
      };
    }

    if (request.step.id === "review") {
      assert.equal(this.governanceStatus, "review_required");
      const packetPath = artifactPath("review_packet.json");
      return {
        status: "completed" as const,
        output: { step: "review" },
        stdout: "review ok",
        stderr: "",
        stdoutLogPath: null,
        stderrLogPath: null,
        exitCode: 0,
        error: null,
        artifacts: [artifact("review_packet", packetPath, { required: true })],
      };
    }

    const handoffPath = artifactPath("operator_handoff.md");
    return {
      status: "completed" as const,
      output: { step: "export" },
      stdout: "export ok",
      stderr: "",
      stdoutLogPath: null,
      stderrLogPath: null,
      exitCode: 0,
      error: null,
      artifacts: [artifact("operator_handoff", handoffPath, { path: handoffPath })],
    };
  }
}

function manifest(): ActuarialPipelineManifest {
  return {
    pipelineId: "actuarial-reserving-review",
    version: "actuarial-reserving.v1",
    artifactRoot: ".tmp/actuarial-pipeline-runs/{{run_id}}",
    steps: [
      {
        id: "calc",
        toolId: "chainladder-calc",
        inputs: { case_input: "case_input.json" },
        outputs: { deterministic_result: "deterministic_result.json" },
      },
      {
        id: "narrative",
        toolId: "narrative-draft",
        inputs: {
          case_input: "case_input.json",
          deterministic_result: "deterministic_result.json",
        },
        outputs: { narrative_draft: "narrative_draft.json" },
      },
      {
        id: "governance",
        toolId: "constitution-check",
        inputs: {
          case_input: "case_input.json",
          deterministic_result: "deterministic_result.json",
          narrative_draft: "narrative_draft.json",
        },
        outputs: { constitution_check: "constitution_check.json" },
      },
      {
        id: "review",
        toolId: "review-generator",
        when: "steps.governance.outputs.status == 'review_required'",
        inputs: {
          deterministic_result: "deterministic_result.json",
          narrative_draft: "narrative_draft.json",
          constitution_check: "constitution_check.json",
        },
        outputs: { review_packet: "review_packet.json" },
      },
      {
        id: "export",
        toolId: "report-export",
        inputs: {},
        outputs: { operator_handoff: "operator_handoff.md" },
      },
    ],
  };
}

async function serviceWithFake(status: "pass" | "review_required") {
  const root = await mkdtemp(join(tmpdir(), "actuarial-pipeline-test-"));
  const inputPath = join(root, "case_input.json");
  await writeFile(inputPath, JSON.stringify({ case_id: "golden-raa" }), "utf8");
  const fake = new FakeStepExecutor(status);
  const service = new ActuarialPipelineRunnerService({
    cwd: root,
    loadManifest: async () => ({ manifestPath: join(root, "pipeline.yaml"), manifest: manifest() }),
    stepExecutor: fake,
  });
  return { root, inputPath, fake, service };
}

async function serviceWithFailingExecutor() {
  const root = await mkdtemp(join(tmpdir(), "actuarial-pipeline-test-"));
  const inputPath = join(root, "case_input.json");
  await writeFile(inputPath, JSON.stringify({ case_id: "golden-raa" }), "utf8");
  const executor: StepExecutor = {
    async executeStep() {
      return {
        status: "failed",
        output: { step: "calc" },
        stdout: "",
        stderr: "calc failed",
        stdoutLogPath: null,
        stderrLogPath: null,
        exitCode: 2,
        error: { message: "calc failed" },
        artifacts: [],
      };
    },
  };
  const service = new ActuarialPipelineRunnerService({
    cwd: root,
    loadManifest: async () => ({ manifestPath: join(root, "pipeline.yaml"), manifest: manifest() }),
    stepExecutor: executor,
  });
  return { inputPath, service };
}

test("actuarial pipeline records failed step details and skips later pending steps", async () => {
  const { service, inputPath } = await serviceWithFailingExecutor();

  await service.startRun({ inputPath, runId: "run-failed-step" });
  const completed = await service.waitForRun("run-failed-step");

  assert.equal(completed.status, "failed");
  assert.equal(completed.error?.message, "calc failed");
  const calc = completed.steps.find((step) => step.stepId === "calc");
  assert.equal(calc?.status, "failed");
  assert.equal(calc?.error?.message, "calc failed");
  assert.equal(typeof calc?.durationMs, "number");
  assert.equal(completed.steps.find((step) => step.stepId === "narrative")?.status, "skipped");
});
test("actuarial pipeline skips review step when governance passes", async () => {
  const { service, inputPath, fake } = await serviceWithFake("pass");

  const started = await service.startRun({ inputPath, runId: "run-pass" });
  assert.equal(started.runId, "run-pass");

  const completed = await service.waitForRun("run-pass");
  assert.equal(completed.status, "completed");
  assert.equal(completed.governanceStatus, "pass");
  assert.deepEqual(fake.executed.map((step) => step.stepId), [
    "calc",
    "narrative",
    "governance",
    "export",
  ]);
  assert.equal(completed.steps.find((step) => step.stepId === "review")?.status, "skipped");
  assert.ok(completed.artifacts.some((item) => item.artifactKind === "operator_handoff"));
});

test("actuarial pipeline executes review step when governance requires review", async () => {
  const { service, inputPath, fake } = await serviceWithFake("review_required");

  await service.startRun({ inputPath, runId: "run-review" });
  const completed = await service.waitForRun("run-review");

  assert.equal(completed.status, "completed");
  assert.equal(completed.governanceStatus, "review_required");
  assert.deepEqual(fake.executed.map((step) => step.stepId), [
    "calc",
    "narrative",
    "governance",
    "review",
    "export",
  ]);
  assert.equal(completed.steps.find((step) => step.stepId === "review")?.status, "completed");
  assert.ok(completed.artifacts.some((item) => item.artifactKind === "review_packet"));
});

test("actuarial pipeline rejects concurrent duplicate run ids during startup", async () => {
  const { service, inputPath } = await serviceWithFake("pass");

  const results = await Promise.allSettled([
    service.startRun({ inputPath, runId: "run-race" }),
    service.startRun({ inputPath, runId: "run-race" }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.match(String(rejected.reason), /already exists/);

  const completed = await service.waitForRun("run-race");
  assert.equal(completed.status, "completed");
});

test("actuarial pipeline rejects outside artifact roots without creating them", async () => {
  const { service, inputPath } = await serviceWithFake("pass");
  const outsideRoot = join(tmpdir(), `actuarial-pipeline-outside-${Date.now()}`);

  await assert.rejects(
    service.startRun({ inputPath, runId: "run-outside", artifactRoot: outsideRoot }),
    /artifactRoot must resolve inside the configured workspace/,
  );
  await assert.rejects(stat(outsideRoot), /ENOENT/);
  assert.equal(service.getRun("run-outside"), null);
});

test("actuarial pipeline rejects symlinked artifact roots before creating outside directories", async () => {
  const { service, inputPath, root } = await serviceWithFake("pass");
  const outsideRoot = await mkdtemp(join(tmpdir(), "actuarial-pipeline-symlink-outside-"));
  const linkedRoot = join(root, "linked-outside-root");
  const outsideChild = join(outsideRoot, "created-by-start");
  await mkdir(outsideRoot, { recursive: true });
  await symlink(outsideRoot, linkedRoot, "dir");

  await assert.rejects(
    service.startRun({ inputPath, runId: "run-symlink-outside", artifactRoot: join(linkedRoot, "created-by-start") }),
    /artifactRoot must resolve inside the configured workspace/,
  );
  await assert.rejects(stat(outsideChild), /ENOENT/);
  assert.equal(service.getRun("run-symlink-outside"), null);
});
