import {
  execFile,
  spawn as nodeSpawn,
  type ChildProcess,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  getAdapterDefinition,
  type ToolAdapterDefinition,
} from "../tool-adapters/adapter-registry";

const climateMonitorModuleId = "climate_monitor";
const pythonExecutable = "python";
const dryRunWorkspace = ".tmp/ai-interface-climate-monitor";
const sourceConfigPath = "monitoring/supranational_sources.yaml";
const runConfigPath = "monitoring/run_config.yaml";
const siteScopesPath = "monitoring/site_scopes.yaml";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = Record<string, JsonValue>;

export type ClimateMonitorProjectReadinessStatus = "ready" | "not_configured";
export type ClimateMonitorGitStatus = "clean" | "dirty" | "unavailable";
export type ClimateMonitorCoverageStatus = "complete" | "partial" | "unknown";

export interface ClimateMonitorStatus {
  project: {
    status: ClimateMonitorProjectReadinessStatus;
    configuredBy: string | "defaultSiblingPath";
    defaultSiblingPath: string;
    script: string;
  };
  git: {
    branch: string | null;
    dirty: boolean;
    status: ClimateMonitorGitStatus;
  };
  latestReport: {
    date: string;
    path: string;
    title: string | null;
    summary: string | null;
  } | null;
  coverage: {
    sourceCount: number;
    scopeCount: number;
    scopedSourceCount: number;
    missingScopeCount: number;
    status: ClimateMonitorCoverageStatus;
  };
}

export interface ClimateMonitorRunInput {
  dryRun?: boolean;
  date?: string;
  manifestFixture?: string;
  researchFixture?: string;
}

export interface ClimateMonitorRunResult {
  parsed: JsonObject;
  command: {
    executable: string;
    args: string[];
    cwd:
      | string
      | "defaultSiblingPath"
      | "ai_interface_workspace";
    shell: false;
    timeoutMs: number;
    maxOutputBytes: number;
    dryRun: boolean;
  };
  exitCode: number | null;
  stderr: string;
}

export interface ClimateMonitorProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ClimateMonitorGitRunner = (
  args: string[],
  cwd: string,
) => Promise<ClimateMonitorProcessResult>;

export type ClimateMonitorChildProcess = ChildProcess & {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
};

export type ClimateMonitorSpawn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ClimateMonitorChildProcess;

export interface ClimateMonitorStatusOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  runGit?: ClimateMonitorGitRunner;
}

export interface ClimateMonitorRunOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  spawn?: ClimateMonitorSpawn;
}

export class ClimateMonitorNotConfiguredError extends Error {}

export class ClimateMonitorLiveRunDisabledError extends Error {}

export class ClimateMonitorRunError extends Error {}

export class ClimateMonitorProcessError extends Error {}

function resolveProject(
  env: Record<string, string | undefined>,
  cwd: string,
  adapter: ToolAdapterDefinition,
): {
  path: string;
  configuredBy: string | "defaultSiblingPath";
} {
  const fallback = requiredProjectFallback(adapter);
  if (fallback.envPath) {
    const configuredPath = env[fallback.envPath]?.trim();
    if (configuredPath) {
      return {
        path: configuredPath,
        configuredBy: fallback.envPath,
      };
    }
  }

  const defaultCandidates = defaultProjectCandidates(
    cwd,
    fallback.defaultSiblingPath,
  );
  const readyDefault = defaultCandidates.find((candidate) =>
    projectIsReady(candidate, fallback.requiredPaths),
  );
  return {
    path: readyDefault ?? defaultCandidates[0] ?? resolve(cwd, fallback.defaultSiblingPath),
    configuredBy: "defaultSiblingPath",
  };
}

function requiredProjectFallback(
  adapter: ToolAdapterDefinition,
): NonNullable<ToolAdapterDefinition["projectFallback"]> {
  const fallback = adapter.projectFallback;
  if (!fallback || fallback.requiredPaths.length === 0) {
    throw new ClimateMonitorNotConfiguredError(
      "Climate monitor project fallback metadata is not configured",
    );
  }
  return fallback;
}

function climateMonitorScript(adapter: ToolAdapterDefinition): string {
  const script = requiredProjectFallback(adapter).requiredPaths[0];
  if (!script) {
    throw new ClimateMonitorNotConfiguredError(
      "Climate monitor script metadata is not configured",
    );
  }
  return script;
}

function climateMonitorAdapter(): ToolAdapterDefinition {
  return getAdapterDefinition(climateMonitorModuleId);
}

function defaultProjectCandidates(
  cwd: string,
  defaultSiblingPath: string,
): string[] {
  return [
    resolve(cwd, defaultSiblingPath),
    resolve(cwd, "..", defaultSiblingPath),
    resolve(cwd, "..", "..", defaultSiblingPath),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}

function projectIsReady(projectPath: string, requiredPaths: string[]): boolean {
  return (
    existsSync(projectPath) &&
    requiredPaths.every((requiredPath) =>
      existsSync(join(projectPath, requiredPath)),
    )
  );
}

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

function relativeProjectPath(projectPath: string, absolutePath: string): string {
  return toPosixPath(relative(projectPath, absolutePath));
}

function readOptionalText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function extractYamlKeys(text: string | null, keyName: string): Set<string> {
  const values = new Set<string>();
  if (!text) return values;

  const pattern = new RegExp(
    `^\\s*-\\s+${keyName}:\\s*["']?([^"'#\\s]+)`,
    "gm",
  );
  for (const match of text.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (value) values.add(value);
  }
  return values;
}

function summarizeCoverage(projectPath: string): ClimateMonitorStatus["coverage"] {
  const sourceKeys = extractYamlKeys(
    readOptionalText(join(projectPath, "monitoring", "supranational_sources.yaml")),
    "key",
  );
  const scopeKeys = extractYamlKeys(
    readOptionalText(join(projectPath, "monitoring", "site_scopes.yaml")),
    "source_key",
  );
  const scopedSourceCount = [...sourceKeys].filter((key) =>
    scopeKeys.has(key),
  ).length;
  const missingScopeCount = Math.max(sourceKeys.size - scopedSourceCount, 0);
  const status =
    sourceKeys.size === 0 || scopeKeys.size === 0
      ? "unknown"
      : missingScopeCount === 0
        ? "complete"
        : "partial";

  return {
    sourceCount: sourceKeys.size,
    scopeCount: scopeKeys.size,
    scopedSourceCount,
    missingScopeCount,
    status,
  };
}

interface ReportCandidate {
  date: string;
  absolutePath: string;
  directoryPriority: number;
}

function listReportCandidates(projectPath: string): ReportCandidate[] {
  const candidates: ReportCandidate[] = [];

  for (const [directory, directoryPriority] of [
    ["wiki", 0],
    ["sources", 1],
  ] as const) {
    const absoluteDirectory = join(projectPath, directory);
    if (!existsSync(absoluteDirectory)) continue;

    for (const entry of readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const match = /^climate-monitor-(\d{4}-\d{2}-\d{2})\.md$/.exec(
        entry.name,
      );
      if (!match?.[1]) continue;
      candidates.push({
        date: match[1],
        absolutePath: join(absoluteDirectory, entry.name),
        directoryPriority,
      });
    }
  }

  return candidates.sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    if (dateCompare !== 0) return dateCompare;
    return left.directoryPriority - right.directoryPriority;
  });
}

function extractTitleAndSummary(markdown: string): {
  title: string | null;
  summary: string | null;
} {
  const lines = markdown.split(/\r?\n/);
  const title =
    lines
      .map((line) => /^#\s+(.+?)\s*$/.exec(line)?.[1]?.trim())
      .find((value): value is string => Boolean(value)) ?? null;

  const paragraph: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (paragraph.length > 0) break;
      continue;
    }
    if (trimmed.startsWith("#") || trimmed.startsWith("_")) continue;
    paragraph.push(trimmed);
  }

  return {
    title,
    summary: paragraph.length > 0 ? paragraph.join(" ") : null,
  };
}

function latestReport(projectPath: string): ClimateMonitorStatus["latestReport"] {
  const latest = listReportCandidates(projectPath).at(-1);
  if (!latest) return null;

  const markdown = readOptionalText(latest.absolutePath) ?? "";
  const { title, summary } = extractTitleAndSummary(markdown);
  return {
    date: latest.date,
    path: relativeProjectPath(projectPath, latest.absolutePath),
    title,
    summary,
  };
}

function runGitWithExecFile(
  args: string[],
  cwd: string,
): Promise<ClimateMonitorProcessResult> {
  return new Promise((resolveProcess) => {
    execFile(
      "git",
      args,
      {
        cwd,
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 65536,
      },
      (error, stdout, stderr) => {
        resolveProcess({
          exitCode: error ? 1 : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      },
    );
  });
}

async function gitStatus(
  projectPath: string,
  runGit: ClimateMonitorGitRunner,
): Promise<ClimateMonitorStatus["git"]> {
  const [branch, status] = await Promise.all([
    runGit(["branch", "--show-current"], projectPath),
    runGit(["status", "--porcelain"], projectPath),
  ]);

  if (branch.exitCode !== 0 || status.exitCode !== 0) {
    return { branch: null, dirty: false, status: "unavailable" };
  }

  const dirty = status.stdout.trim().length > 0;
  return {
    branch: branch.stdout.trim() || null,
    dirty,
    status: dirty ? "dirty" : "clean",
  };
}

export async function getClimateMonitorStatus(
  options: ClimateMonitorStatusOptions = {},
): Promise<ClimateMonitorStatus> {
  const env = options.env ?? process.env;
  const adapter = climateMonitorAdapter();
  const fallback = requiredProjectFallback(adapter);
  const script = climateMonitorScript(adapter);
  const project = resolveProject(env, options.cwd ?? process.cwd(), adapter);
  const ready = projectIsReady(project.path, fallback.requiredPaths);
  const runGit = options.runGit ?? runGitWithExecFile;

  return {
    project: {
      status: ready ? "ready" : "not_configured",
      configuredBy: project.configuredBy,
      defaultSiblingPath: fallback.defaultSiblingPath,
      script,
    },
    git: ready
      ? await gitStatus(project.path, runGit)
      : { branch: null, dirty: false, status: "unavailable" },
    latestReport: ready ? latestReport(project.path) : null,
    coverage: ready
      ? summarizeCoverage(project.path)
      : {
          sourceCount: 0,
          scopeCount: 0,
          scopedSourceCount: 0,
          missingScopeCount: 0,
          status: "unknown",
        },
  };
}

function safeRelativeArgument(value: string, name: string): string {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed) {
    throw new ClimateMonitorRunError(`${name} cannot be blank`);
  }
  if (isAbsolute(trimmed) || trimmed.split("/").includes("..")) {
    throw new ClimateMonitorRunError(`${name} must be relative to the project`);
  }
  return trimmed;
}

function relativeCliPath(fromDirectory: string, targetPath: string): string {
  return toPosixPath(relative(fromDirectory, targetPath)) || ".";
}

function projectRelativeToWorkspace(
  projectPath: string,
  workspacePath: string,
  relativePath: string,
): string {
  return relativeCliPath(workspacePath, resolve(projectPath, relativePath));
}

interface ClimateMonitorRunPlan {
  displayArgs: string[];
  spawnArgs: string[];
  spawnCwd: string;
  commandCwd:
    | string
    | "defaultSiblingPath"
    | "ai_interface_workspace";
}

function buildRunPlan(
  input: ClimateMonitorRunInput,
  dryRun: boolean,
  projectPath: string,
  projectConfiguredBy: string | "defaultSiblingPath",
  workspacePath: string,
  runScript: string,
): ClimateMonitorRunPlan {
  const displayArgs = [runScript, "--json"];
  const spawnArgs = [
    dryRun ? projectRelativeToWorkspace(projectPath, workspacePath, runScript) : runScript,
    "--json",
  ];

  function pushOption(name: string, displayValue: string, spawnValue = displayValue): void {
    displayArgs.push(name, displayValue);
    spawnArgs.push(name, spawnValue);
  }

  if (dryRun) {
    pushOption(
      "--source-config",
      sourceConfigPath,
      projectRelativeToWorkspace(projectPath, workspacePath, sourceConfigPath),
    );
    pushOption(
      "--run-config",
      runConfigPath,
      projectRelativeToWorkspace(projectPath, workspacePath, runConfigPath),
    );
    pushOption(
      "--site-scopes",
      siteScopesPath,
      projectRelativeToWorkspace(projectPath, workspacePath, siteScopesPath),
    );
  }

  if (input.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new ClimateMonitorRunError("date must use YYYY-MM-DD format");
    }
    pushOption("--date", input.date);
  }
  if (input.manifestFixture) {
    const fixture = safeRelativeArgument(input.manifestFixture, "manifestFixture");
    pushOption(
      "--manifest-fixture",
      fixture,
      dryRun ? projectRelativeToWorkspace(projectPath, workspacePath, fixture) : fixture,
    );
  }
  if (input.researchFixture) {
    const fixture = safeRelativeArgument(input.researchFixture, "researchFixture");
    pushOption(
      "--research-fixture",
      fixture,
      dryRun ? projectRelativeToWorkspace(projectPath, workspacePath, fixture) : fixture,
    );
  }
  if (dryRun) {
    pushOption("--state-dir", `${dryRunWorkspace}/state`);
    pushOption("--source-dir", `${dryRunWorkspace}/sources`);
    pushOption("--wiki-dir", `${dryRunWorkspace}/wiki`);
    displayArgs.push("--no-sync", "--no-update-seen-state");
    spawnArgs.push("--no-sync", "--no-update-seen-state");
  }

  return {
    displayArgs,
    spawnArgs,
    spawnCwd: dryRun ? workspacePath : projectPath,
    commandCwd: dryRun ? "ai_interface_workspace" : projectConfiguredBy,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathRedactionVariants(projectPath: string): string[] {
  const baseCandidates = [projectPath, resolve(projectPath)];
  const variants = new Set<string>();
  for (const candidate of baseCandidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    variants.add(trimmed);
    variants.add(trimmed.replace(/\//g, "\\"));
    variants.add(trimmed.replace(/\\/g, "/"));
  }
  return [...variants].sort((left, right) => right.length - left.length);
}

function sanitizeString(projectPath: string, value: string): string {
  let sanitized = value;
  for (const variant of pathRedactionVariants(projectPath)) {
    sanitized = sanitized.replace(
      new RegExp(escapeRegExp(variant), "gi"),
      "[climate-monitor-project]",
    );
  }
  return sanitized;
}

function sanitizeJsonValue(projectPath: string, value: JsonValue): JsonValue {
  if (typeof value === "string") return sanitizeString(projectPath, value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(projectPath, item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeJsonValue(projectPath, item),
      ]),
    );
  }
  return value;
}

function parseJsonObject(projectPath: string, stdout: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new ClimateMonitorProcessError("Climate monitor returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ClimateMonitorProcessError(
      "Climate monitor returned a non-object JSON payload",
    );
  }

  return sanitizeJsonValue(projectPath, parsed as JsonObject) as JsonObject;
}

function executeClimateMonitorProcess(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
  spawn: ClimateMonitorSpawn,
  timeoutMs: number,
  maxOutputBytes: number,
  projectPath: string,
): Promise<{
  exitCode: number | null;
  parsed: JsonObject;
  stderr: string;
}> {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let timedOut = false;
    let outputTooLarge = false;
    let settled = false;

    function settle(
      error: Error | null,
      result?: { exitCode: number | null; parsed: JsonObject; stderr: string },
    ): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        rejectProcess(error);
        return;
      }
      if (result) {
        resolveProcess(result);
        return;
      }
      rejectProcess(new ClimateMonitorProcessError("Climate monitor run failed"));
    }

    function appendOutput(kind: "stdout" | "stderr", chunk: unknown): void {
      if (outputTooLarge) return;
      const text = Buffer.isBuffer(chunk)
        ? chunk.toString("utf8")
        : String(chunk);
      outputBytes += Buffer.byteLength(text, "utf8");
      if (outputBytes > maxOutputBytes) {
        outputTooLarge = true;
        child.kill();
        return;
      }
      if (kind === "stdout") {
        stdout += text;
      } else {
        stderr += text;
      }
    }

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => appendOutput("stdout", chunk));
    child.stderr?.on("data", (chunk) => appendOutput("stderr", chunk));
    child.on("error", (error) => {
      settle(
        new ClimateMonitorProcessError(
          `Failed to start climate monitor: ${error.message}`,
        ),
      );
    });
    child.on("close", (exitCode) => {
      if (timedOut) {
        settle(new ClimateMonitorProcessError("Climate monitor run timed out"));
        return;
      }
      if (outputTooLarge) {
        settle(
          new ClimateMonitorProcessError(
            "Climate monitor output exceeded the maximum size",
          ),
        );
        return;
      }
      if (exitCode !== 0) {
        settle(
          new ClimateMonitorProcessError(
            `Climate monitor exited with code ${String(exitCode)}`,
          ),
        );
        return;
      }
      let parsed: JsonObject;
      try {
        parsed = parseJsonObject(projectPath, stdout);
      } catch (error) {
        settle(
          error instanceof Error
            ? error
            : new ClimateMonitorProcessError(
                "Climate monitor returned invalid JSON",
              ),
        );
        return;
      }
      settle(null, {
        exitCode,
        parsed,
        stderr: sanitizeString(projectPath, stderr),
      });
    });
  });
}

function climateMonitorProcessEnv(
  env: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  const allowedEnvNames = [
    "APPDATA",
    "COMSPEC",
    "HOME",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "LANG",
    "LC_ALL",
    "NO_PROXY",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_ORG_ID",
    "PATH",
    "PATHEXT",
    "Path",
    "PYTHONIOENCODING",
    "PYTHONUTF8",
    "PYTHONUNBUFFERED",
    "REQUESTS_CA_BUNDLE",
    "SSL_CERT_FILE",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WEB_LISTENING_PROJECT_PATH",
    "WINDIR",
    "http_proxy",
    "https_proxy",
    "no_proxy",
    "CLIMATE_MONITOR_ENABLE_LIVE_RESEARCH",
    "CLIMATE_MONITOR_ENABLE_LIVE_WEB_LISTENING",
    "CLIMATE_MONITOR_SEARCH_MODEL",
  ];
  return Object.fromEntries(
    allowedEnvNames.flatMap((name) => {
      const value = env[name];
      return value === undefined ? [] : [[name, value]];
    }),
  );
}

export async function runClimateMonitor(
  input: ClimateMonitorRunInput,
  options: ClimateMonitorRunOptions = {},
): Promise<ClimateMonitorRunResult> {
  const env = options.env ?? process.env;
  const adapter = climateMonitorAdapter();
  const fallback = requiredProjectFallback(adapter);
  const runScript = climateMonitorScript(adapter);
  const project = resolveProject(env, options.cwd ?? process.cwd(), adapter);
  if (!projectIsReady(project.path, fallback.requiredPaths)) {
    throw new ClimateMonitorNotConfiguredError(
      "Climate monitor project is not configured",
    );
  }

  const dryRun = input.dryRun ?? true;
  if (!dryRun && env["CLIMATE_MONITOR_ALLOW_LIVE_RUNS"] !== "1") {
    throw new ClimateMonitorLiveRunDisabledError(
      "Live climate monitor runs are disabled unless CLIMATE_MONITOR_ALLOW_LIVE_RUNS=1",
    );
  }

  const workspacePath = resolve(options.cwd ?? process.cwd());
  const plan = buildRunPlan(
    input,
    dryRun,
    project.path,
    project.configuredBy,
    workspacePath,
    runScript,
  );
  const timeoutMs = adapter.timeoutMs;
  const maxOutputBytes = adapter.maxOutputBytes;
  const command = {
    executable: pythonExecutable,
    args: [...plan.displayArgs],
    cwd: plan.commandCwd,
    shell: false as const,
    timeoutMs,
    maxOutputBytes,
    dryRun,
  };

  const result = await executeClimateMonitorProcess(
    pythonExecutable,
    plan.spawnArgs,
    {
      cwd: plan.spawnCwd,
      env: climateMonitorProcessEnv(env),
      shell: false,
      windowsHide: true,
    },
    options.spawn ?? nodeSpawn,
    timeoutMs,
    maxOutputBytes,
    project.path,
  );

  return {
    parsed: result.parsed,
    command,
    exitCode: result.exitCode,
    stderr: result.stderr,
  };
}
