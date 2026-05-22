import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import type { ToolAdapterDefinition } from "./adapter-registry";
import type {
  ToolAdapterExecutor,
  ToolExecutionRequest,
  ToolExecutionResult,
} from "./executor";
import type { JsonObject } from "../modules/ingest-service";

interface CapturedOutput {
  text: string;
  truncated: boolean;
}

type SpawnFn = (
  executable: string,
  args: string[],
  options: {
    cwd?: string;
    env: Record<string, string | undefined>;
    shell: false;
    windowsHide: true;
  },
) => ChildProcessWithoutNullStreams;

interface CommandInvocation {
  executable: string | null;
  args: string[];
  cwd?: string;
}

function envValue(
  env: Record<string, string | undefined>,
  names: string[],
): string | null {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function redactText(value: string, secrets: string[]): string {
  let redacted = value;
  for (const secret of secrets) {
    if (secret) {
      redacted = redacted.split(secret).join("[redacted]");
    }
  }
  return redacted;
}

function redactJson<T>(value: T, secrets: string[]): T {
  if (typeof value === "string") {
    return redactText(value, secrets) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, secrets)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactJson(item, secrets)]),
    ) as T;
  }
  return value;
}

function secretValues(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
  extraValues: string[] = [],
): string[] {
  const envSecrets = [...adapter.requiredEnv, ...adapter.optionalEnv]
    .map((name) => env[name]?.trim())
    .filter((value): value is string => Boolean(value));
  return [...envSecrets, ...extraValues]
    .flatMap((value) => {
      const slashNormalized = value.split("\\").join("/");
      const jsonEscaped = JSON.stringify(value).slice(1, -1);
      const jsonEscapedSlashNormalized = JSON.stringify(slashNormalized).slice(1, -1);
      return [value, slashNormalized, jsonEscaped, jsonEscapedSlashNormalized];
    })
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value.filter((item): item is string => typeof item === "string");
  return values.length === value.length ? values : null;
}

function commandArgs(inputJson: JsonObject | null): string[] {
  const args = stringArray(inputJson?.["args"]);
  if (args) return args;

  const command = inputJson?.["command"];
  if (Array.isArray(command)) {
    return stringArray(command) ?? [];
  }
  if (typeof command === "string") {
    return command.split(/\s+/).filter(Boolean);
  }
  return [];
}

function inputArgs(inputJson: JsonObject | null): string[] {
  const args = stringArray(inputJson?.["args"]);
  if (args) return args;

  const mappedArgs: string[] = [];
  const pipeline = inputJson?.["pipeline"];
  if (typeof pipeline === "string" && pipeline.trim()) {
    mappedArgs.push("--pipeline", pipeline);
  }
  const input = inputJson?.["input"];
  if (typeof input === "string" && input.trim()) {
    mappedArgs.push("--input", input);
  }
  const artifactRoot = inputJson?.["artifactRoot"];
  if (typeof artifactRoot === "string" && artifactRoot.trim()) {
    mappedArgs.push("--artifact-root", artifactRoot);
  }
  const runId = inputJson?.["runId"];
  if (typeof runId === "string" && runId.trim()) {
    mappedArgs.push("--run-id", runId);
  }
  return mappedArgs;
}

function defaultProjectCandidates(defaultSiblingPath: string): string[] {
  return [
    resolve(process.cwd(), defaultSiblingPath),
    resolve(process.cwd(), "..", defaultSiblingPath),
    resolve(process.cwd(), "..", "..", defaultSiblingPath),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}

function configuredProjectPath(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
): string | null {
  const fallback = adapter.projectFallback;
  if (fallback?.envPath) {
    const configuredPath = env[fallback.envPath]?.trim();
    if (configuredPath) return configuredPath;
  } else {
    for (const name of adapter.requiredEnv) {
      if (!/_PROJECT_(PATH|DIR|ROOT)$/.test(name)) continue;
      const value = env[name]?.trim();
      if (value) return value;
    }
  }

  if (!fallback) return null;
  const candidates = defaultProjectCandidates(fallback.defaultSiblingPath);
  return (
    candidates.find((candidate) =>
      existsSync(candidate) &&
      fallback.requiredPaths.every((requiredPath) =>
        existsSync(join(candidate, requiredPath)),
      ),
    ) ??
    candidates[0] ??
    null
  );
}

function configuredCommandExecutable(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
  defaultExecutable: string,
): string {
  const executableEnv = adapter.optionalEnv.find((name) => name.endsWith("_PYTHON"));
  const configuredExecutable = executableEnv ? env[executableEnv]?.trim() : undefined;
  return configuredExecutable || defaultExecutable;
}

function commandInvocation(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
  inputJson: JsonObject | null,
): CommandInvocation {
  if (adapter.command && adapter.command.length > 0) {
    const cwd =
      adapter.workingDirectory === "project"
        ? (configuredProjectPath(adapter, env) ?? undefined)
        : undefined;
    const [defaultExecutable, ...baseArgs] = adapter.command;
    return {
      executable: configuredCommandExecutable(adapter, env, defaultExecutable),
      args: [...baseArgs, ...inputArgs(inputJson)],
      cwd,
    };
  }

  return {
    executable: envValue(env, adapter.requiredEnv),
    args: commandArgs(inputJson),
  };
}

function normalizedExecutableValues(executable: string): string[] {
  return [executable, basename(executable)].map((value) => value.toLowerCase());
}

function allowedExecutableValues(
  adapter: ToolAdapterDefinition,
  executable: string,
): string[] {
  const values = normalizedExecutableValues(executable);
  const manifestExecutable = adapter.command?.[0];
  if (manifestExecutable) {
    values.push(...normalizedExecutableValues(manifestExecutable));
  }
  return values.filter((value, index, allValues) => allValues.indexOf(value) === index);
}

function hasAllowedCommandPrefix(args: string[], allowedCommand: string): boolean {
  const allowedParts = allowedCommand.split(/\s+/).filter(Boolean);
  if (allowedParts.length === 0 || args.length < allowedParts.length) {
    return false;
  }
  return allowedParts.every((part, index) => args[index] === part);
}

function allowedArgsForExecutable(
  allowedCommand: string,
  executableValues: string[],
): string[] | null {
  const allowedLower = allowedCommand.toLowerCase();
  const executableMatches = [...executableValues].sort(
    (left, right) => right.length - left.length,
  );

  for (const executable of executableMatches) {
    if (allowedLower === executable) return [];
    if (allowedLower.startsWith(`${executable} `)) {
      return allowedCommand.slice(executable.length).trim().split(/\s+/).filter(Boolean);
    }
  }

  return null;
}

function isAllowedCommand(
  adapter: ToolAdapterDefinition,
  executable: string,
  args: string[],
): boolean {
  const executableValues = allowedExecutableValues(adapter, executable);
  return adapter.allowedCommands.some((command) => {
    const allowed = command.trim();
    if (!allowed) return false;
    if (args.length === 0 && executableValues.includes(allowed.toLowerCase())) {
      return true;
    }
    const allowedExecutableArgs = allowedArgsForExecutable(allowed, executableValues);
    if (allowedExecutableArgs) {
      if (allowedExecutableArgs.length === 0) return args.length === 0;
      return allowedExecutableArgs.every((part, index) => args[index] === part);
    }
    const allowedParts = allowed.split(/\s+/).filter(Boolean);
    if (allowedParts.length > 1) {
      const [allowedExecutable, ...allowedArgs] = allowedParts;
      if (!executableValues.includes(allowedExecutable.toLowerCase())) {
        return false;
      }
      return allowedArgs.every((part, index) => args[index] === part);
    }
    return hasAllowedCommandPrefix(args, allowed);
  });
}

function captureOutput(
  chunks: Buffer[],
  totalBytes: number,
  capturedBytes: number,
  maxOutputBytes: number,
): CapturedOutput {
  const output = Buffer.concat(chunks, capturedBytes);
  return {
    text: output.toString("utf8"),
    truncated: totalBytes > maxOutputBytes,
  };
}

function appendCapturedOutput(
  chunks: Buffer[],
  capturedBytes: number,
  chunk: Buffer,
  maxOutputBytes: number,
): number {
  const remaining = maxOutputBytes - capturedBytes;
  if (remaining <= 0) return capturedBytes;

  const capturedLength = Math.min(chunk.length, remaining);
  chunks.push(Buffer.from(chunk.subarray(0, capturedLength)));
  return capturedBytes + capturedLength;
}

function parseJsonObject(text: string): JsonObject | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
    return { value: parsed };
  } catch {
    return null;
  }
}

function result(input: {
  status: ToolExecutionResult["status"];
  summary: string;
  eventType: string;
  eventSeverity: ToolExecutionResult["eventSeverity"];
  eventMessage: string;
  outputJson: JsonObject | null;
  eventPayload: JsonObject;
}): ToolExecutionResult {
  return {
    status: input.status,
    summary: input.summary,
    outputJson: input.outputJson,
    eventType: input.eventType,
    eventTitle: input.summary,
    eventMessage: input.eventMessage,
    eventSeverity: input.eventSeverity,
    eventPayload: input.eventPayload,
  };
}

export class CliToolAdapterExecutor implements ToolAdapterExecutor {
  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
    private readonly spawnFn: SpawnFn = spawn,
    private readonly timeoutKillGraceMs = 250,
  ) {}

  async execute({
    run,
    adapter,
  }: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const invocation = commandInvocation(adapter, this.env, run.inputJson);
    const executable = invocation.executable;
    const secrets = secretValues(
      adapter,
      this.env,
      invocation.cwd ? [invocation.cwd] : [],
    );
    if (!executable) {
      return result({
        status: "failed",
        summary: `CLI executable is not configured for ${adapter.adapterId}.`,
        eventType: "tool.execution.cli_configuration_failed",
        eventSeverity: "error",
        eventMessage: "CLI executable env is missing.",
        outputJson: null,
        eventPayload: {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
          missingRequiredEnv: [...adapter.requiredEnv],
        },
      });
    }

    const args = invocation.args;
    if (!isAllowedCommand(adapter, executable, args)) {
      return result({
        status: "failed",
        summary: `CLI command is not allowed for ${adapter.adapterId}.`,
        eventType: "tool.execution.cli_rejected",
        eventSeverity: "error",
        eventMessage: "CLI command was rejected by the adapter allowlist.",
        outputJson: null,
        eventPayload: {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
          externalRunId: run.externalRunId,
          commandPrefix: args.slice(0, 2).join(" "),
        },
      });
    }

    return new Promise<ToolExecutionResult>((resolve) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let stdoutCapturedBytes = 0;
      let stderrCapturedBytes = 0;
      let timedOut = false;
      let timeout: NodeJS.Timeout | null = null;
      let forceKillTimeout: NodeJS.Timeout | null = null;
      let settled = false;

      const finish = (executionResult: ToolExecutionResult) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (forceKillTimeout) clearTimeout(forceKillTimeout);
        resolve(executionResult);
      };

      const timeoutResult = (code: number | null): ToolExecutionResult => {
        const stdout = captureOutput(
          stdoutChunks,
          stdoutBytes,
          stdoutCapturedBytes,
          adapter.maxOutputBytes,
        );
        const stderr = captureOutput(
          stderrChunks,
          stderrBytes,
          stderrCapturedBytes,
          adapter.maxOutputBytes,
        );
        const redactedStdout = redactText(stdout.text, secrets);
        const redactedStderr = redactText(stderr.text, secrets);

        return result({
          status: "failed",
          summary: `CLI execution timed out for ${adapter.adapterId}.`,
          eventType: "tool.execution.cli_timeout",
          eventSeverity: "warning",
          eventMessage: `CLI execution exceeded ${adapter.timeoutMs}ms.`,
          outputJson: null,
          eventPayload: {
            adapterId: adapter.adapterId,
            moduleId: adapter.moduleId,
            externalRunId: run.externalRunId,
            exitCode: code,
            stdout: redactedStdout,
            stderr: redactedStderr,
            stdoutTruncated: stdout.truncated,
            stderrTruncated: stderr.truncated,
          },
        });
      };

      const child = this.spawnFn(executable, args, {
        cwd: invocation.cwd,
        env: this.env,
        shell: false,
        windowsHide: true,
      });

      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        forceKillTimeout = setTimeout(() => {
          child.kill("SIGKILL");
          finish(timeoutResult(null));
        }, this.timeoutKillGraceMs);
      }, adapter.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        stdoutCapturedBytes = appendCapturedOutput(
          stdoutChunks,
          stdoutCapturedBytes,
          chunk,
          adapter.maxOutputBytes,
        );
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        stderrCapturedBytes = appendCapturedOutput(
          stderrChunks,
          stderrCapturedBytes,
          chunk,
          adapter.maxOutputBytes,
        );
      });
      child.on("error", (error) => {
        finish(
          result({
            status: "failed",
            summary: `CLI execution failed for ${adapter.adapterId}.`,
            eventType: "tool.execution.cli_failed",
            eventSeverity: "error",
            eventMessage: redactText(error.message, secrets),
            outputJson: null,
            eventPayload: {
              adapterId: adapter.adapterId,
              moduleId: adapter.moduleId,
              externalRunId: run.externalRunId,
              error: redactText(error.message, secrets),
            },
          }),
        );
      });
      child.on("close", (code) => {
        const stdout = captureOutput(
          stdoutChunks,
          stdoutBytes,
          stdoutCapturedBytes,
          adapter.maxOutputBytes,
        );
        const stderr = captureOutput(
          stderrChunks,
          stderrBytes,
          stderrCapturedBytes,
          adapter.maxOutputBytes,
        );
        const redactedStdout = redactText(stdout.text, secrets);
        const redactedStderr = redactText(stderr.text, secrets);
        const parsedStdout = parseJsonObject(redactedStdout);
        const basePayload = {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
          externalRunId: run.externalRunId,
          exitCode: code,
          stdout: redactedStdout,
          stderr: redactedStderr,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
        };

        if (timedOut) {
          finish(timeoutResult(code));
          return;
        }

        if (code !== 0) {
          finish(
            result({
              status: "failed",
              summary: `CLI execution failed for ${adapter.adapterId}.`,
              eventType: "tool.execution.cli_failed",
              eventSeverity: "error",
              eventMessage: redactedStderr || `CLI exited with code ${code}.`,
              outputJson:
                parsedStdout ??
                redactJson(
                  {
                    exitCode: code,
                    stdout: redactedStdout,
                    stderr: redactedStderr,
                  },
                  secrets,
                ),
              eventPayload: basePayload,
            }),
          );
          return;
        }

        finish(
          result({
            status: "succeeded",
            summary: `CLI execution completed for ${adapter.adapterId}.`,
            eventType: "tool.execution.cli_completed",
            eventSeverity: "info",
            eventMessage: `CLI ${adapter.moduleId} adapter execution completed.`,
            outputJson:
              parsedStdout ??
              redactJson(
                {
                  stdout: redactedStdout,
                  stderr: redactedStderr,
                },
                secrets,
              ),
            eventPayload: basePayload,
          }),
        );
      });
    });
  }
}
