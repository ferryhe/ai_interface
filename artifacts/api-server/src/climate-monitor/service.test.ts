import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  getClimateMonitorStatus,
  runClimateMonitor,
  type ClimateMonitorSpawn,
} from "./service";

function createProjectFixture(
  projectPath = mkdtempSync(join(tmpdir(), "climate-monitor-api-")),
): string {
  mkdirSync(join(projectPath, "sources"), { recursive: true });
  mkdirSync(join(projectPath, "monitoring"), { recursive: true });
  mkdirSync(join(projectPath, "scripts"), { recursive: true });
  writeFileSync(join(projectPath, "scripts", "run_climate_monitor.py"), "");
  writeFileSync(
    join(projectPath, "sources", "climate-monitor-2026-05-14.md"),
    [
      "# Daily Climate & Actuarial Monitor - 2026-05-14",
      "",
      "Capital supervisors highlighted climate transition risk in new filings.",
      "",
      "## IAIS",
      "",
      "- Insurance supervisors discussed climate-risk reporting.",
    ].join("\n"),
  );
  writeFileSync(
    join(projectPath, "monitoring", "supranational_sources.yaml"),
    [
      "sources:",
      "  - key: iais",
      "    url: https://www.iais.org",
      "  - key: fsb",
      "    url: https://www.fsb.org",
    ].join("\n"),
  );
  writeFileSync(
    join(projectPath, "monitoring", "site_scopes.yaml"),
    [
      "site_scopes:",
      "  - source_key: iais",
      "    seed_urls: [https://www.iais.org/news/]",
      "  - source_key: fsb",
      "    seed_urls: [https://www.fsb.org/work-of-the-fsb/]",
    ].join("\n"),
  );
  return projectPath;
}

test("status resolves the default sibling project from an api-server cwd", async () => {
  const rootPath = mkdtempSync(join(tmpdir(), "climate-monitor-sibling-"));
  const projectPath = createProjectFixture(join(rootPath, "climate_monitor_wiki"));
  const apiServerCwd = join(rootPath, "ai_interface", "artifacts", "api-server");
  mkdirSync(apiServerCwd, { recursive: true });

  const status = await getClimateMonitorStatus({
    env: {},
    cwd: apiServerCwd,
    runGit: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  });

  assert.equal(status.project.status, "ready");
  assert.equal(status.project.configuredBy, "defaultSiblingPath");
  assert.equal(status.latestReport?.path, "sources/climate-monitor-2026-05-14.md");
  assert.equal(JSON.stringify(status).includes(projectPath), false);
});

test("status summarizes repo state without exposing the configured project path", async () => {
  const projectPath = createProjectFixture();

  const status = await getClimateMonitorStatus({
    env: { CLIMATE_MONITOR_PROJECT_PATH: projectPath },
    runGit: async (args) => {
      if (args.join(" ") === "branch --show-current") {
        return { exitCode: 0, stdout: "codex/climate-monitor\n", stderr: "" };
      }
      if (args.join(" ") === "status --porcelain") {
        return { exitCode: 0, stdout: " M wiki/index.md\n", stderr: "" };
      }
      throw new Error(`Unexpected git args: ${args.join(" ")}`);
    },
  });

  const serialized = JSON.stringify(status);
  assert.equal(serialized.includes(projectPath), false);
  assert.deepEqual(status.git, {
    branch: "codex/climate-monitor",
    dirty: true,
    status: "dirty",
  });
  assert.equal(status.latestReport?.date, "2026-05-14");
  assert.equal(
    status.latestReport?.summary,
    "Capital supervisors highlighted climate transition risk in new filings.",
  );
  assert.equal(
    status.latestReport?.path,
    "sources/climate-monitor-2026-05-14.md",
  );
  assert.deepEqual(status.coverage, {
    sourceCount: 2,
    scopeCount: 2,
    scopedSourceCount: 2,
    missingScopeCount: 0,
    status: "complete",
  });
});

function createSpawnStub(stdout: string): {
  calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }>;
  spawn: ClimateMonitorSpawn;
} {
  const calls: Array<{
    command: string;
    args: string[];
    options: Record<string, unknown>;
  }> = [];
  const spawn: ClimateMonitorSpawn = (command, args, options) => {
    calls.push({ command, args: [...args], options: options as Record<string, unknown> });
    const child = new EventEmitter() as ReturnType<ClimateMonitorSpawn>;
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    child.stdout = stdoutStream;
    child.stderr = stderrStream;
    child.kill = () => true;
    process.nextTick(() => {
      stdoutStream.end(stdout);
      stderrStream.end("");
      child.emit("close", 0);
    });
    return child;
  };
  return { calls, spawn };
}

test("dry run spawns the fixed climate monitor script with JSON and fixture options", async () => {
  const projectPath = createProjectFixture();
  const workspacePath = mkdtempSync(join(tmpdir(), "climate-monitor-api-workspace-"));
  const { calls, spawn } = createSpawnStub(
    JSON.stringify({
      report_date: "2026-05-14",
      report_path: "climate-monitor-2026-05-14.md",
      items: [{ title: "Climate risk report" }],
    }),
  );

  const result = await runClimateMonitor(
    {
      dryRun: true,
      manifestFixture: "monitoring/fixtures/web_listening_manifest_sample.json",
      researchFixture: "monitoring/fixtures/research_results_sample.json",
    },
    {
      env: { CLIMATE_MONITOR_PROJECT_PATH: projectPath },
      cwd: workspacePath,
      spawn,
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "python");
  assert.match(calls[0]?.args[0] ?? "", /scripts\/run_climate_monitor\.py$/);
  assert.equal(JSON.stringify(calls[0]?.args).includes(projectPath), false);
  assert.deepEqual(result.command.args, [
    "scripts/run_climate_monitor.py",
    "--json",
    "--source-config",
    "monitoring/supranational_sources.yaml",
    "--run-config",
    "monitoring/run_config.yaml",
    "--site-scopes",
    "monitoring/site_scopes.yaml",
    "--manifest-fixture",
    "monitoring/fixtures/web_listening_manifest_sample.json",
    "--research-fixture",
    "monitoring/fixtures/research_results_sample.json",
    "--state-dir",
    ".tmp/ai-interface-climate-monitor/state",
    "--source-dir",
    ".tmp/ai-interface-climate-monitor/sources",
    "--wiki-dir",
    ".tmp/ai-interface-climate-monitor/wiki",
    "--no-sync",
    "--no-update-seen-state",
  ]);
  assert.equal(calls[0]?.options["cwd"], workspacePath);
  assert.equal(calls[0]?.options["shell"], false);
  assert.equal(JSON.stringify(result).includes(projectPath), false);
  assert.deepEqual(result.command, {
    executable: "python",
    args: result.command.args,
    cwd: "ai_interface_workspace",
    shell: false,
    timeoutMs: 120000,
    maxOutputBytes: 1048576,
    dryRun: true,
  });
  assert.equal(result.parsed.report_date, "2026-05-14");
});

test("live climate monitor runs are rejected unless explicitly enabled", async () => {
  const projectPath = createProjectFixture();
  const { calls, spawn } = createSpawnStub("{}");

  await assert.rejects(
    () =>
      runClimateMonitor(
        { dryRun: false },
        {
          env: { CLIMATE_MONITOR_PROJECT_PATH: projectPath },
          spawn,
        },
      ),
    /Live climate monitor runs are disabled/,
  );

  assert.equal(calls.length, 0);
});
