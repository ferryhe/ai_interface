import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { stringify } from "yaml";

import { type JsonObject, type ModuleRunRecord } from "../modules/ingest-service";
import { getAdapterDefinition, getAdapterReadiness } from "../tool-adapters/adapter-registry";
import { CliToolAdapterExecutor } from "../tool-adapters/cli-executor";
import type { ToolExecutionResult } from "../tool-adapters/executor";
import {
  loadActuarialPipelineManifest,
  type ActuarialPipelineManifest,
  type ActuarialPipelineStepManifest,
} from "./manifest";

export type PipelineRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type PipelineStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface PipelineArtifactPayload {
  artifactKind: string;
  path: string;
  exists: boolean;
  contentJson: JsonObject | null;
  contentText: string | null;
}

export interface PipelineStepRecord {
  stepId: string;
  toolId: string;
  status: PipelineStepStatus;
  when?: string;
  skipReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  input: Record<string, string>;
  output: JsonObject | null;
  artifacts: PipelineArtifactPayload[];
  stdout: string | null;
  stderr: string | null;
  stdoutLogPath: string | null;
  stderrLogPath: string | null;
  exitCode: number | null;
  error: JsonObject | null;
}

export interface PipelineRunRecord {
  runId: string;
  pipelineId: string;
  version: string;
  manifestPath: string;
  inputPath: string;
  artifactRoot: string;
  status: PipelineRunStatus;
  governanceStatus: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  steps: PipelineStepRecord[];
  artifacts: PipelineArtifactPayload[];
  error: JsonObject | null;
}

export interface StartPipelineRunInput {
  pipelineId?: string;
  inputPath: string;
  artifactRoot?: string;
  runId?: string;
}

export interface PipelineRunListItem {
  runId: string;
  pipelineId: string;
  status: PipelineRunStatus;
  governanceStatus: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  inputPath: string;
  artifactRoot: string;
  stepCount: number;
  completedStepCount: number;
}

interface LoadedManifest {
  manifestPath: string;
  manifest: ActuarialPipelineManifest;
}

interface StepExecutionRequest {
  runId: string;
  artifactRoot: string;
  inputPath: string;
  manifestPath: string;
  manifest: ActuarialPipelineManifest;
  step: ActuarialPipelineStepManifest;
  resolvedInputs: Record<string, string>;
}

interface StepExecutionResult {
  status: PipelineStepStatus;
  output: JsonObject | null;
  stdout: string | null;
  stderr: string | null;
  stdoutLogPath: string | null;
  stderrLogPath: string | null;
  exitCode: number | null;
  error: JsonObject | null;
  artifacts: PipelineArtifactPayload[];
}

export interface StepExecutor {
  executeStep(request: StepExecutionRequest): Promise<StepExecutionResult>;
}

interface PipelineRunnerOptions {
  env?: Record<string, string | undefined>;
  loadManifest?: () => Promise<LoadedManifest>;
  stepExecutor?: StepExecutor;
  cwd?: string;
}

interface StepContext {
  step: PipelineStepRecord;
  manifest: ActuarialPipelineStepManifest;
}

const DEFAULT_PIPELINE_ID = "actuarial-reserving-review";
const INTERPOLATION_PATTERN = /^\{\{\s*(.+?)\s*\}\}$/;
const ARTIFACT_REFERENCE_PATTERN = /^steps\.([a-zA-Z0-9_-]+)\.artifacts\.([a-zA-Z0-9_-]+)$/;
const OUTPUT_REFERENCE_PATTERN = /^steps\.([a-zA-Z0-9_-]+)\.outputs\.([a-zA-Z0-9_-]+)$/;
const EQUALITY_PATTERN =
  /^steps\.([a-zA-Z0-9_-]+)\.outputs\.([a-zA-Z0-9_-]+)\s*==\s*'([^']+)'$/;
const MAX_ARTIFACT_TEXT_BYTES = 65536;

export class DuplicatePipelineRunError extends Error {
  constructor(runId: string) {
    super(`Pipeline run already exists: ${runId}`);
    this.name = "DuplicatePipelineRunError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneArtifact(artifact: PipelineArtifactPayload): PipelineArtifactPayload {
  return {
    ...artifact,
    contentJson: artifact.contentJson ? { ...artifact.contentJson } : null,
  };
}

function cloneStep(step: PipelineStepRecord): PipelineStepRecord {
  return {
    ...step,
    input: { ...step.input },
    output: step.output ? { ...step.output } : null,
    artifacts: step.artifacts.map(cloneArtifact),
    error: step.error ? { ...step.error } : null,
  };
}

function cloneRun(run: PipelineRunRecord): PipelineRunRecord {
  return {
    ...run,
    steps: run.steps.map(cloneStep),
    artifacts: run.artifacts.map(cloneArtifact),
    error: run.error ? { ...run.error } : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function jsonObjectOrNull(value: unknown): JsonObject | null {
  return isRecord(value) ? (value as JsonObject) : null;
}

function resolveInputPath(inputPath: string, cwd: string): string {
  return isAbsolute(inputPath) ? resolve(inputPath) : resolve(cwd, inputPath);
}

function isPathInside(path: string, root: string): boolean {
  const candidate = resolve(path);
  const base = resolve(root);
  return candidate === base || candidate.startsWith(`${base}${sep}`);
}

async function resolveContainedFile(path: string, root: string, label: string): Promise<string> {
  const resolvedRoot = await realpath(root);
  const resolvedPath = await realpath(path);
  if (!isPathInside(resolvedPath, resolvedRoot)) {
    throw new Error(`${label} must resolve inside the configured workspace.`);
  }
  const pathStat = await stat(resolvedPath);
  if (!pathStat.isFile()) {
    throw new Error(`${label} must resolve to a file.`);
  }
  return resolvedPath;
}

async function resolveContainedDirectory(path: string, root: string, label: string): Promise<string> {
  const resolvedRoot = await realpath(root);
  const requestedPath = resolve(path);
  if (!isPathInside(requestedPath, resolvedRoot)) {
    throw new Error(`${label} must resolve inside the configured workspace.`);
  }

  let existingAncestor = requestedPath;
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  const resolvedAncestor = await realpath(existingAncestor);
  if (!isPathInside(resolvedAncestor, resolvedRoot)) {
    throw new Error(`${label} must resolve inside the configured workspace.`);
  }

  await mkdir(requestedPath, { recursive: true });
  const resolvedPath = await realpath(requestedPath);
  if (!isPathInside(resolvedPath, resolvedRoot)) {
    throw new Error(`${label} must resolve inside the configured workspace.`);
  }
  const pathStat = await stat(resolvedPath);
  if (!pathStat.isDirectory()) {
    throw new Error(`${label} must resolve to a directory.`);
  }
  return resolvedPath;
}

function stripSensitiveOutputPaths(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveOutputPaths);
  }
  if (!isRecord(value)) return value;
  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/path|dir|root/i.test(key)) continue;
    sanitized[key] = stripSensitiveOutputPaths(child);
  }
  return sanitized;
}

function renderArtifactRoot(template: string, runId: string): string {
  return template.split("{{run_id}}").join(runId);
}

function defaultManifestPathCandidates(cwd: string): string[] {
  return [
    resolve(cwd, "artifacts/api-server/src/pipelines/actuarial-reserving-review.yaml"),
    resolve(cwd, "src/pipelines/actuarial-reserving-review.yaml"),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}

export async function loadDefaultActuarialPipelineManifest(
  cwd = process.cwd(),
): Promise<LoadedManifest> {
  const manifestPath = defaultManifestPathCandidates(cwd).find((path) => existsSync(path));
  if (!manifestPath) {
    throw new Error("Built-in actuarial pipeline manifest is not available.");
  }
  return {
    manifestPath,
    manifest: await loadActuarialPipelineManifest(manifestPath),
  };
}

async function readArtifactPayload(
  artifactKind: string,
  path: string,
): Promise<PipelineArtifactPayload> {
  if (!existsSync(path)) {
    return {
      artifactKind,
      path,
      exists: false,
      contentJson: null,
      contentText: null,
    };
  }

  const source = await readFile(path, "utf8");
  if (extname(path).toLowerCase() === ".json") {
    try {
      const parsed = JSON.parse(source) as unknown;
      return {
        artifactKind,
        path,
        exists: true,
        contentJson: jsonObjectOrNull(parsed),
        contentText: source.length <= MAX_ARTIFACT_TEXT_BYTES ? source : null,
      };
    } catch {
      // fall through to text payload
    }
  }

  return {
    artifactKind,
    path,
    exists: true,
    contentJson: null,
    contentText: source.length <= MAX_ARTIFACT_TEXT_BYTES ? source : null,
  };
}

function createPendingStep(step: ActuarialPipelineStepManifest): PipelineStepRecord {
  return {
    stepId: step.id,
    toolId: step.toolId,
    status: "pending",
    when: step.when,
    skipReason: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    input: {},
    output: null,
    artifacts: [],
    stdout: null,
    stderr: null,
    stdoutLogPath: null,
    stderrLogPath: null,
    exitCode: null,
    error: null,
  };
}

function pipelineRunListItem(run: PipelineRunRecord): PipelineRunListItem {
  return {
    runId: run.runId,
    pipelineId: run.pipelineId,
    status: run.status,
    governanceStatus: run.governanceStatus,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs: run.durationMs,
    inputPath: run.inputPath,
    artifactRoot: run.artifactRoot,
    stepCount: run.steps.length,
    completedStepCount: run.steps.filter((step) => step.status === "completed").length,
  };
}

function valueAtOutputField(step: PipelineStepRecord, field: string): unknown {
  return step.output?.[field];
}

function resolveTemplateExpression(expression: string, steps: StepContext[]): string {
  const artifactMatch = ARTIFACT_REFERENCE_PATTERN.exec(expression);
  if (artifactMatch) {
    const [, stepId, artifactKind] = artifactMatch;
    const step = steps.find((item) => item.step.stepId === stepId);
    const artifact = step?.step.artifacts.find(
      (item) => item.artifactKind === artifactKind && item.exists,
    );
    if (!artifact) {
      throw new Error(`Artifact reference could not be resolved: ${expression}`);
    }
    return artifact.path;
  }

  const outputMatch = OUTPUT_REFERENCE_PATTERN.exec(expression);
  if (outputMatch) {
    const [, stepId, field] = outputMatch;
    const step = steps.find((item) => item.step.stepId === stepId);
    const value = step ? valueAtOutputField(step.step, field) : undefined;
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Output reference could not be resolved: ${expression}`);
    }
    return value;
  }

  throw new Error(`Unsupported interpolation expression: ${expression}`);
}

function resolveInputValue(value: string, steps: StepContext[]): string {
  const template = INTERPOLATION_PATTERN.exec(value);
  if (!template) return value;
  return resolveTemplateExpression(template[1] ?? "", steps);
}

function evaluateWhenExpression(value: string | undefined, steps: StepContext[]): boolean {
  if (!value) return true;
  const expression = INTERPOLATION_PATTERN.exec(value)?.[1] ?? value;
  const equalityMatch = EQUALITY_PATTERN.exec(expression);
  if (!equalityMatch) {
    throw new Error(`Unsupported when expression: ${value}`);
  }

  const [, stepId, field, expected] = equalityMatch;
  const step = steps.find((item) => item.step.stepId === stepId);
  return valueAtOutputField(step?.step ?? createPendingStep({ id: stepId, toolId: "", inputs: {}, outputs: {} }), field) === expected;
}

function stepErrorPayload(message: string): JsonObject {
  return { message };
}

function supportedPipelineId(pipelineId: string | undefined): string {
  if (!pipelineId) return DEFAULT_PIPELINE_ID;
  if (pipelineId !== DEFAULT_PIPELINE_ID) {
    throw new Error(`Unsupported pipelineId: ${pipelineId}`);
  }
  return pipelineId;
}

export class AiActuaryCliStepExecutor implements StepExecutor {
  private readonly executor: CliToolAdapterExecutor;
  private readonly env: Record<string, string | undefined>;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = {
      ...env,
      AI_ACTUARY_PROJECT_PATH:
        env.AI_ACTUARY_PROJECT_PATH ?? env.AI_ACTUARY_PROJECT_ROOT,
    };
    this.executor = new CliToolAdapterExecutor(this.env);
  }

  async executeStep(request: StepExecutionRequest): Promise<StepExecutionResult> {
    const tempRoot = await mkdtemp(join(tmpdir(), "ai-interface-actuarial-step-"));
    const pipelinePath = join(tempRoot, `${request.step.id}.yaml`);
    const stepManifest = {
      pipelineId: `${request.manifest.pipelineId}-${request.step.id}`,
      version: request.manifest.version,
      artifactRoot: request.artifactRoot,
      steps: [
        {
          id: request.step.id,
          toolId: request.step.toolId,
          inputs: request.resolvedInputs,
          outputs: request.step.outputs,
        },
      ],
    };
    await writeFile(pipelinePath, stringify(stepManifest), "utf8");

    const adapter = getAdapterDefinition("ai_actuary");
    const readiness = getAdapterReadiness(adapter, this.env);
    if (readiness.status !== "ready") {
      await rm(tempRoot, { force: true, recursive: true });
      return {
        status: "failed",
        output: null,
        stdout: null,
        stderr: null,
        stdoutLogPath: null,
        stderrLogPath: null,
        exitCode: null,
        error: {
          message: "ai_actuary CLI is not configured.",
          missingRequiredEnv: [...readiness.missingRequiredEnv],
        },
        artifacts: [],
      };
    }

    const run: ModuleRunRecord = {
      id: request.runId,
      pipelineRunId: null,
      moduleId: "ai_actuary",
      externalRunId: request.runId,
      title: request.step.id,
      status: "running",
      inputJson: {
        pipeline: pipelinePath,
        input: request.inputPath,
        artifactRoot: request.artifactRoot,
        runId: `${request.runId}-${request.step.id}`,
      },
      outputJson: null,
      summary: null,
      metadata: null,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const result = await this.executor.execute({ run, adapter, readiness });
      return this.resultFromExecution(request, result);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  }

  private async resultFromExecution(
    request: StepExecutionRequest,
    result: ToolExecutionResult,
  ): Promise<StepExecutionResult> {
    const payload = jsonObjectOrNull(result.outputJson);
    const stepPayload = Array.isArray(payload?.["steps"])
      ? jsonObjectOrNull(payload?.["steps"]?.[0])
      : null;
    const stdoutLogPath = stringValue(stepPayload?.["stdout_log_path"]);
    const stderrLogPath = stringValue(stepPayload?.["stderr_log_path"]);
    const stdout = stdoutLogPath && existsSync(stdoutLogPath)
      ? await readFile(stdoutLogPath, "utf8")
      : stringValue(jsonObjectOrNull(result.eventPayload)?.["stdout"]);
    const stderr = stderrLogPath && existsSync(stderrLogPath)
      ? await readFile(stderrLogPath, "utf8")
      : stringValue(jsonObjectOrNull(result.eventPayload)?.["stderr"]);
    const exitCode = typeof stepPayload?.["exit_code"] === "number"
      ? (stepPayload["exit_code"] as number)
      : null;

    const artifacts = await Promise.all(
      Object.entries(request.step.outputs).map(async ([artifactKind, artifactPath]) => {
        const resolvedPath = isAbsolute(artifactPath)
          ? resolve(artifactPath)
          : resolve(request.artifactRoot, artifactPath);
        return readArtifactPayload(artifactKind, resolvedPath);
      }),
    );

    return {
      status: result.status === "succeeded" ? "completed" : "failed",
      output: jsonObjectOrNull(stripSensitiveOutputPaths(payload)),
      stdout: stdout ?? null,
      stderr: stderr ?? null,
      stdoutLogPath: null,
      stderrLogPath: null,
      exitCode,
      error:
        result.status === "succeeded"
          ? null
          : {
              message: result.summary ?? "Step execution failed.",
            },
      artifacts,
    };
  }
}

export class ActuarialPipelineRunnerService {
  private readonly runs = new Map<string, PipelineRunRecord>();
  private readonly completions = new Map<string, Promise<PipelineRunRecord>>();
  private readonly startingRunIds = new Set<string>();
  private readonly env: Record<string, string | undefined>;
  private readonly cwd: string;
  private readonly loadManifest: () => Promise<LoadedManifest>;
  private readonly stepExecutor: StepExecutor;

  constructor(options: PipelineRunnerOptions = {}) {
    this.env = options.env ?? process.env;
    this.cwd = options.cwd ?? process.cwd();
    this.loadManifest =
      options.loadManifest ?? (() => loadDefaultActuarialPipelineManifest(this.cwd));
    this.stepExecutor =
      options.stepExecutor ?? new AiActuaryCliStepExecutor(this.env);
  }

  listRuns(): PipelineRunListItem[] {
    return Array.from(this.runs.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(pipelineRunListItem);
  }

  getRun(runId: string): PipelineRunRecord | null {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : null;
  }

  async waitForRun(runId: string): Promise<PipelineRunRecord> {
    const completion = this.completions.get(runId);
    if (completion) return cloneRun(await completion);
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Pipeline run not found: ${runId}`);
    }
    return cloneRun(run);
  }

  async startRun(input: StartPipelineRunInput): Promise<PipelineRunRecord> {
    const pipelineId = supportedPipelineId(input.pipelineId);
    const runId = input.runId ?? randomUUID();
    if (this.runs.has(runId) || this.startingRunIds.has(runId)) {
      throw new DuplicatePipelineRunError(runId);
    }

    this.startingRunIds.add(runId);
    try {
      const { manifest, manifestPath } = await this.loadManifest();
      if (manifest.pipelineId !== pipelineId) {
        throw new Error(
          `Loaded pipeline ${manifest.pipelineId} does not match requested ${pipelineId}.`,
        );
      }

      const workspaceRoot = await realpath(this.cwd);
      const resolvedInputPath = await resolveContainedFile(
        resolveInputPath(input.inputPath, workspaceRoot),
        workspaceRoot,
        "inputPath",
      );
      const artifactRoot = await resolveContainedDirectory(
        resolveInputPath(
          input.artifactRoot ?? renderArtifactRoot(manifest.artifactRoot, runId),
          workspaceRoot,
        ),
        workspaceRoot,
        "artifactRoot",
      );

      const copiedInputPath = join(artifactRoot, "case_input.json");
      await copyFile(resolvedInputPath, copiedInputPath);

      const createdAt = nowIso();
      const run: PipelineRunRecord = {
        runId,
        pipelineId,
        version: manifest.version,
        manifestPath,
        inputPath: copiedInputPath,
        artifactRoot,
        status: "queued",
        governanceStatus: null,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        completedAt: null,
        durationMs: null,
        steps: manifest.steps.map(createPendingStep),
        artifacts: [await readArtifactPayload("case_input", copiedInputPath)],
        error: null,
      };

      this.runs.set(runId, run);
      const completion = this.executeRun(runId, manifest).then(() => {
        const completed = this.runs.get(runId);
        if (!completed) throw new Error(`Pipeline run not found: ${runId}`);
        return cloneRun(completed);
      });
      this.completions.set(runId, completion);
      return cloneRun(run);
    } finally {
      this.startingRunIds.delete(runId);
    }
  }

  private updateRun(
    runId: string,
    updater: (run: PipelineRunRecord) => void,
  ): PipelineRunRecord {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Pipeline run not found: ${runId}`);
    }
    updater(run);
    run.updatedAt = nowIso();
    this.runs.set(runId, run);
    return run;
  }

  private async executeRun(
    runId: string,
    manifest: ActuarialPipelineManifest,
  ): Promise<void> {
    const startedAt = Date.now();
    this.updateRun(runId, (run) => {
      run.status = "running";
      run.startedAt = nowIso();
    });

    const priorSteps: StepContext[] = [];
    for (const manifestStep of manifest.steps) {
      const stepStartedAt = Date.now();
      let resolvedInputs: Record<string, string>;
      let record: PipelineStepRecord | undefined;

      try {
        resolvedInputs = this.resolveStepInputs(manifestStep, priorSteps);
        const runBeforeStep = this.updateRun(runId, (run) => {
          const step = run.steps.find((item) => item.stepId === manifestStep.id);
          if (!step) return;
          step.input = resolvedInputs;
        });
        record = runBeforeStep.steps.find((item) => item.stepId === manifestStep.id);
        if (!record) continue;
        const shouldRun = evaluateWhenExpression(manifestStep.when, priorSteps);
        if (!shouldRun) {
          this.updateRun(runId, (run) => {
            const step = run.steps.find((item) => item.stepId === manifestStep.id);
            if (!step) return;
            step.status = "skipped";
            step.skipReason = "condition not met";
            step.completedAt = nowIso();
            step.durationMs = Date.now() - stepStartedAt;
          });
          priorSteps.push({ step: cloneStep(record), manifest: manifestStep });
          continue;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.failRun(runId, manifestStep.id, startedAt, stepStartedAt, stepErrorPayload(message));
        return;
      }

      this.updateRun(runId, (run) => {
        const step = run.steps.find((item) => item.stepId === manifestStep.id);
        if (!step) return;
        step.status = "running";
        step.startedAt = nowIso();
      });

      const currentRun = this.runs.get(runId);
      if (!currentRun) return;
      let result: StepExecutionResult;
      try {
        result = await this.stepExecutor.executeStep({
          runId,
          artifactRoot: currentRun.artifactRoot,
          inputPath: currentRun.inputPath,
          manifestPath: currentRun.manifestPath,
          manifest,
          step: manifestStep,
          resolvedInputs,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.failRun(runId, manifestStep.id, startedAt, stepStartedAt, stepErrorPayload(message));
        return;
      }

      this.updateRun(runId, (run) => {
        const step = run.steps.find((item) => item.stepId === manifestStep.id);
        if (!step) return;
        step.status = result.status;
        step.completedAt = nowIso();
        step.durationMs = Date.now() - stepStartedAt;
        step.output = result.output;
        step.artifacts = result.artifacts.map(cloneArtifact);
        step.stdout = result.stdout;
        step.stderr = result.stderr;
        step.stdoutLogPath = result.stdoutLogPath;
        step.stderrLogPath = result.stderrLogPath;
        step.exitCode = result.exitCode;
        step.error = result.error ? { ...result.error } : null;
        if (step.stepId === "governance") {
          const governanceStatus = stringValue(result.output?.["status"]);
          if (governanceStatus) run.governanceStatus = governanceStatus;
        }
      });

      const updatedRun = this.runs.get(runId);
      const updatedStep = updatedRun?.steps.find((item) => item.stepId === manifestStep.id);
      if (updatedStep) {
        priorSteps.push({ step: cloneStep(updatedStep), manifest: manifestStep });
      }

      if (result.status === "failed") {
        await this.failRun(
          runId,
          manifestStep.id,
          startedAt,
          stepStartedAt,
          result.error ?? stepErrorPayload("Step execution failed."),
        );
        return;
      }
    }

    const finalArtifacts = await this.collectRunArtifacts(runId);
    this.updateRun(runId, (run) => {
      run.status = "completed";
      run.completedAt = nowIso();
      run.durationMs = Date.now() - startedAt;
      run.artifacts = finalArtifacts;
    });
  }

  private async failRun(
    runId: string,
    failedStepId: string,
    runStartedAt: number,
    stepStartedAt: number,
    error: JsonObject,
  ): Promise<void> {
    const finalArtifacts = await this.collectRunArtifacts(runId);
    this.updateRun(runId, (run) => {
      let failed = false;
      for (const step of run.steps) {
        if (step.stepId === failedStepId) {
          step.status = "failed";
          step.completedAt = step.completedAt ?? nowIso();
          step.durationMs = step.durationMs ?? Date.now() - stepStartedAt;
          step.error = step.error ?? { ...error };
          failed = true;
          continue;
        }
        if (!failed) continue;
        if (step.status === "pending") {
          step.status = "skipped";
          step.skipReason = `not run after ${failedStepId} failed`;
          step.completedAt = nowIso();
          step.durationMs = 0;
        }
      }
      run.status = "failed";
      run.completedAt = nowIso();
      run.durationMs = Date.now() - runStartedAt;
      run.error = { ...error, failedStepId };
      run.artifacts = finalArtifacts;
    });
  }

  private resolveStepInputs(
    step: ActuarialPipelineStepManifest,
    priorSteps: StepContext[],
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(step.inputs)) {
      resolved[key] = resolveInputValue(value, priorSteps);
    }
    return resolved;
  }

  private async collectRunArtifacts(runId: string): Promise<PipelineArtifactPayload[]> {
    const run = this.runs.get(runId);
    if (!run) return [];
    const byKind = new Map<string, PipelineArtifactPayload>();
    for (const artifact of run.artifacts) {
      byKind.set(artifact.artifactKind, cloneArtifact(artifact));
    }
    for (const step of run.steps) {
      for (const artifact of step.artifacts) {
        byKind.set(artifact.artifactKind, cloneArtifact(artifact));
      }
    }
    return Array.from(byKind.values());
  }
}
