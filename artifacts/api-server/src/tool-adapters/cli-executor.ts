import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { basename } from "node:path";

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
    env: Record<string, string | undefined>;
    shell: false;
    windowsHide: true;
  },
) => ChildProcessWithoutNullStreams;

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
): string[] {
  return [...adapter.requiredEnv, ...adapter.optionalEnv]
    .map((name) => env[name]?.trim())
    .filter((value): value is string => Boolean(value));
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

function normalizedExecutableValues(executable: string): string[] {
  return [executable, basename(executable)].map((value) => value.toLowerCase());
}

function hasAllowedCommandPrefix(args: string[], allowedCommand: string): boolean {
  const allowedParts = allowedCommand.split(/\s+/).filter(Boolean);
  if (allowedParts.length === 0 || args.length < allowedParts.length) {
    return false;
  }
  return allowedParts.every((part, index) => args[index] === part);
}

function isAllowedCommand(
  adapter: ToolAdapterDefinition,
  executable: string,
  args: string[],
): boolean {
  const executableValues = normalizedExecutableValues(executable);
  return adapter.allowedCommands.some((command) => {
    const allowed = command.trim();
    if (!allowed) return false;
    if (args.length === 0 && executableValues.includes(allowed.toLowerCase())) {
      return true;
    }
    return hasAllowedCommandPrefix(args, allowed);
  });
}

function captureOutput(
  chunks: Buffer[],
  totalBytes: number,
  maxOutputBytes: number,
): CapturedOutput {
  const output = Buffer.concat(chunks, Math.min(totalBytes, maxOutputBytes));
  return {
    text: output.toString("utf8"),
    truncated: totalBytes > maxOutputBytes,
  };
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
    const executable = envValue(this.env, adapter.requiredEnv);
    const secrets = secretValues(adapter, this.env);
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

    const args = commandArgs(run.inputJson);
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
          adapter.maxOutputBytes,
        );
        const stderr = captureOutput(
          stderrChunks,
          stderrBytes,
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
        if (Buffer.concat(stdoutChunks).length < adapter.maxOutputBytes) {
          stdoutChunks.push(chunk);
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (Buffer.concat(stderrChunks).length < adapter.maxOutputBytes) {
          stderrChunks.push(chunk);
        }
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
          adapter.maxOutputBytes,
        );
        const stderr = captureOutput(
          stderrChunks,
          stderrBytes,
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
              outputJson: redactJson(
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
