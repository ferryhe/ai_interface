import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import type { ToolAdapterDefinition, ToolAdapterReadiness } from "./adapter-registry";
import { CliToolAdapterExecutor } from "./cli-executor";
import type { ToolExecutionRequest } from "./executor";
import type { ModuleRunRecord } from "../modules/ingest-service";

const nodeExecutable = process.execPath;

function cliAdapter(input: Partial<ToolAdapterDefinition> = {}): ToolAdapterDefinition {
  return {
    adapterId: "test.cli.v1",
    moduleId: "md_to_rag",
    adapterKind: "cli",
    displayName: "Test CLI",
    description: "Test CLI adapter.",
    sourceRepo: "https://example.com/test-cli",
    requiredEnv: ["TEST_CLI_PATH"],
    optionalEnv: [],
    timeoutMs: 1000,
    maxOutputBytes: 4096,
    allowedCommands: [nodeExecutable],
    supportsResume: false,
    readinessHint: "Set TEST_CLI_PATH.",
    ...input,
  };
}

function run(inputJson: ModuleRunRecord["inputJson"]): ModuleRunRecord {
  const now = new Date();
  return {
    id: "run-1",
    pipelineRunId: null,
    moduleId: "md_to_rag",
    externalRunId: "external-run-1",
    title: null,
    status: "running",
    inputJson,
    outputJson: null,
    summary: null,
    metadata: null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function request(
  adapter: ToolAdapterDefinition,
  inputJson: ModuleRunRecord["inputJson"],
  env: Record<string, string | undefined> = { TEST_CLI_PATH: nodeExecutable },
): ToolExecutionRequest {
  return {
    run: run(inputJson),
    adapter,
    readiness: {
      ...adapter,
      configured: true,
      status: "ready",
      missingRequiredEnv: [],
      configuredOptionalEnv: adapter.optionalEnv.filter((name) => env[name]),
    } satisfies ToolAdapterReadiness,
  };
}

async function withCliScript<T>(
  source: string,
  fn: (scriptPath: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "ai-interface-cli-test-"));
  const scriptPath = join(dir, "script.cjs");
  await writeFile(scriptPath, source, "utf8");
  try {
    return await fn(scriptPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("rejects disallowed commands", async () => {
  const adapter = cliAdapter({ allowedCommands: ["allowed-command"] });

  const result = await new CliToolAdapterExecutor({
    TEST_CLI_PATH: nodeExecutable,
  }).execute(
    request(adapter, {
      args: ["-e", "console.log(JSON.stringify({ ok: true }))"],
    }),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.cli_rejected");
  assert.match(result.summary ?? "", /not allowed/);
});

test("succeeds for an allowed command with JSON stdout", async () => {
  const result = await withCliScript(
    "console.log(JSON.stringify({ ok: true, count: 2 }));\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({
        TEST_CLI_PATH: nodeExecutable,
      }).execute(
        request(cliAdapter({ allowedCommands: [scriptPath] }), {
          args: [scriptPath],
        }),
      ),
  );

  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.outputJson, { ok: true, count: 2 });
  assert.equal(result.eventType, "tool.execution.cli_completed");
});

test("uses manifest-owned commands from the project working directory", async () => {
  const result = await withCliScript(
    "const path = require('node:path');\nconsole.log(JSON.stringify({ argv: process.argv.slice(2), cwdBase: path.basename(process.cwd()) }));\n",
    async (scriptPath) => {
      const projectDir = dirname(scriptPath);
      return new CliToolAdapterExecutor({
        AI_ACTUARY_PROJECT_PATH: projectDir,
      }).execute(
        request(
          cliAdapter({
            requiredEnv: ["AI_ACTUARY_PROJECT_PATH"],
            command: [nodeExecutable, scriptPath, "--json"],
            workingDirectory: "project",
            allowedCommands: [`${nodeExecutable} ${scriptPath}`],
          }),
          {
            command: ["malicious", "--ignored"],
            args: ["--pipeline", "fixture.yaml"],
          },
        ),
      );
    },
  );

  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.outputJson?.["argv"], [
    "--json",
    "--pipeline",
    "fixture.yaml",
  ]);
  assert.match(String(result.outputJson?.["cwdBase"]), /ai-interface-cli-test-/);
});

test("maps structured ai_actuary input fields into manifest-owned CLI args", async () => {
  const result = await withCliScript(
    "console.log(JSON.stringify({ argv: process.argv.slice(2) }));\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({
        AI_ACTUARY_PROJECT_PATH: dirname(scriptPath),
      }).execute(
        request(
          cliAdapter({
            requiredEnv: ["AI_ACTUARY_PROJECT_PATH"],
            command: [nodeExecutable, scriptPath, "--json"],
            workingDirectory: "project",
            allowedCommands: [`${nodeExecutable} ${scriptPath}`],
          }),
          {
            pipeline: "tests/fixtures/tool_pipelines/actuarial_reserving_review.yaml",
            input: "tmp/case.json",
            artifactRoot: "tmp/artifacts/run-1",
            runId: "run-1",
          },
        ),
      ),
  );

  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.outputJson?.["argv"], [
    "--json",
    "--pipeline",
    "tests/fixtures/tool_pipelines/actuarial_reserving_review.yaml",
    "--input",
    "tmp/case.json",
    "--artifact-root",
    "tmp/artifacts/run-1",
    "--run-id",
    "run-1",
  ]);
});

test("uses optional python env override for manifest-owned commands", async () => {
  const result = await withCliScript(
    "console.log(JSON.stringify({ ok: true }));\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({
        AI_ACTUARY_PYTHON: nodeExecutable,
      }).execute(
        request(
          cliAdapter({
            requiredEnv: [],
            optionalEnv: ["AI_ACTUARY_PYTHON"],
            command: ["python", scriptPath],
            allowedCommands: [`python ${scriptPath}`],
          }),
          {},
          { AI_ACTUARY_PYTHON: nodeExecutable },
        ),
      ),
  );

  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.outputJson, { ok: true });
});

test("preserves JSON stdout payloads from nonzero manifest-owned commands", async () => {
  const result = await withCliScript(
    "console.log(JSON.stringify({ ok: false, status: 'error', error: { message: 'bad input' } }));\nprocess.exit(2);\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({}).execute(
        request(
          cliAdapter({
            requiredEnv: [],
            command: [nodeExecutable, scriptPath],
            allowedCommands: [`${nodeExecutable} ${scriptPath}`],
          }),
          {},
          {},
        ),
      ),
  );

  assert.equal(result.status, "failed");
  assert.deepEqual(result.outputJson, {
    ok: false,
    status: "error",
    error: { message: "bad input" },
  });
});

test("rejects manifest-owned commands when the executable is not allowlisted", async () => {
  const result = await withCliScript(
    "console.log(JSON.stringify({ ok: true }));\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({}).execute(
        request(
          cliAdapter({
            requiredEnv: [],
            command: [nodeExecutable, scriptPath],
            allowedCommands: [`not-node ${scriptPath}`],
          }),
          {},
          {},
        ),
      ),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.cli_rejected");
});

test("uses the discovered project fallback directory as manifest command cwd", async () => {
  const result = await withCliScript(
    "const path = require('node:path');\nconsole.log(JSON.stringify({ cwd: process.cwd(), cwdBase: path.basename(process.cwd()) }));\n",
    async (scriptPath) => {
      const projectDir = dirname(scriptPath);
      return new CliToolAdapterExecutor({}).execute(
        request(
          cliAdapter({
            requiredEnv: ["AI_ACTUARY_PROJECT_PATH"],
            command: [nodeExecutable, scriptPath],
            workingDirectory: "project",
            allowedCommands: [`${nodeExecutable} ${scriptPath}`],
            projectFallback: {
              defaultSiblingPath: projectDir,
              envPath: "AI_ACTUARY_PROJECT_PATH",
              requiredPaths: ["script.cjs"],
            },
          }),
          {},
          {},
        ),
      );
    },
  );

  assert.equal(result.status, "succeeded");
  assert.equal(result.outputJson?.["cwd"], "[redacted]");
  assert.match(String(result.outputJson?.["cwdBase"]), /ai-interface-cli-test-/);
  assert.equal(
    result.eventPayload?.["stdout"],
    `{\"cwd\":\"[redacted]\",\"cwdBase\":\"${result.outputJson?.["cwdBase"]}\"}\n`,
  );
});

test("timeout maps to failed and records a warning event", async () => {
  const result = await withCliScript(
    "setTimeout(() => {}, 1000);\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({
        TEST_CLI_PATH: nodeExecutable,
      }).execute(
        request(
          cliAdapter({ allowedCommands: [scriptPath], timeoutMs: 50 }),
          { args: [scriptPath] },
        ),
      ),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.cli_timeout");
  assert.equal(result.eventSeverity, "warning");
  assert.match(result.summary ?? "", /timed out/i);
});

test("output truncation respects maxOutputBytes", async () => {
  const result = await withCliScript(
    "process.stdout.write('abcdefghijklmnopqrstuvwxyz');\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({
        TEST_CLI_PATH: nodeExecutable,
      }).execute(
        request(
          cliAdapter({ allowedCommands: [scriptPath], maxOutputBytes: 16 }),
          { args: [scriptPath] },
        ),
      ),
  );

  assert.equal(result.status, "succeeded");
  assert.equal(result.outputJson?.["stdout"], "abcdefghijklmnop");
  assert.equal(result.eventPayload?.["stdoutTruncated"], true);
});

test("captures only maxOutputBytes from a single oversized stdout chunk", async () => {
  const maxOutputBytes = 16;
  const stdout = new PassThrough();
  const fakeChild = {
    stdout,
    stderr: new PassThrough(),
    on: (event: string, handler: (code: number | null) => void) => {
      if (event === "close") {
        setImmediate(() => {
          stdout.write(Buffer.alloc(1024, "x"));
          handler(0);
        });
      }
      return fakeChild;
    },
    kill: () => true,
  } as unknown as ChildProcessWithoutNullStreams;
  const originalConcat = Buffer.concat;
  let retainedOversizedChunk = false;
  Buffer.concat = ((chunks: readonly Uint8Array[], totalLength?: number) => {
    for (const chunk of chunks) {
      retainedOversizedChunk ||= chunk.byteLength > maxOutputBytes;
    }
    return originalConcat(chunks, totalLength);
  }) as typeof Buffer.concat;

  try {
    const result = await new CliToolAdapterExecutor(
      { TEST_CLI_PATH: nodeExecutable },
      () => fakeChild,
    ).execute(
      request(
        cliAdapter({ allowedCommands: [nodeExecutable], maxOutputBytes }),
        { args: [] },
      ),
    );

    assert.equal(result.status, "succeeded");
    assert.equal(result.outputJson?.["stdout"], "xxxxxxxxxxxxxxxx");
    assert.equal(result.eventPayload?.["stdoutTruncated"], true);
    assert.equal(retainedOversizedChunk, false);
  } finally {
    Buffer.concat = originalConcat;
  }
});

test("rejects executable-only allowlist when args are present", async () => {
  const result = await new CliToolAdapterExecutor({
    TEST_CLI_PATH: nodeExecutable,
  }).execute(
    request(cliAdapter({ allowedCommands: [nodeExecutable] }), {
      args: ["-e", "console.log(JSON.stringify({ ok: true }))"],
    }),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.cli_rejected");
  assert.match(result.summary ?? "", /not allowed/);
});

test("redacts JSON-escaped secret variants from CLI stdout", async () => {
  const secretPath = "C:\\secret\\ai_actuary";
  const result = await withCliScript(
    "console.log(JSON.stringify({ secret: process.env.TEST_SECRET }));\n",
    async (scriptPath) =>
      new CliToolAdapterExecutor({
        TEST_CLI_PATH: nodeExecutable,
        TEST_SECRET: secretPath,
      }).execute(
        request(
          cliAdapter({
            optionalEnv: ["TEST_SECRET"],
            allowedCommands: [scriptPath],
          }),
          { args: [scriptPath] },
          { TEST_CLI_PATH: nodeExecutable, TEST_SECRET: secretPath },
        ),
      ),
  );

  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.outputJson, { secret: "[redacted]" });
  assert.equal(result.eventPayload?.["stdout"], '{"secret":"[redacted]"}\n');
});

test("timeout resolves even when the child ignores SIGTERM", async () => {
  const startedAt = Date.now();
  const result = await withCliScript(
    [
      "process.on('SIGTERM', () => {});",
      "setTimeout(() => process.exit(0), 2000);",
      "setInterval(() => {}, 1000);",
      "",
    ].join("\n"),
    async (scriptPath) =>
      new CliToolAdapterExecutor({
        TEST_CLI_PATH: nodeExecutable,
      }).execute(
        request(
          cliAdapter({ allowedCommands: [scriptPath], timeoutMs: 50 }),
          { args: [scriptPath] },
        ),
      ),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.cli_timeout");
  assert.equal(result.eventSeverity, "warning");
  assert.ok(Date.now() - startedAt < 1000);
});

test("timeout force-kills and resolves if child close is delayed", async () => {
  const killSignals: string[] = [];
  const fakeChild = {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    on: () => fakeChild,
    kill: (signal?: NodeJS.Signals | number) => {
      killSignals.push(String(signal));
      return true;
    },
  } as unknown as ChildProcessWithoutNullStreams;
  const spawnFn = () => fakeChild;
  const startedAt = Date.now();

  const result = await new CliToolAdapterExecutor(
    { TEST_CLI_PATH: nodeExecutable },
    spawnFn,
    10,
  ).execute(
    request(
      cliAdapter({ allowedCommands: [nodeExecutable], timeoutMs: 10 }),
      { args: [] },
    ),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.cli_timeout");
  assert.deepEqual(killSignals, ["SIGTERM", "SIGKILL"]);
  assert.ok(Date.now() - startedAt < 500);
});
