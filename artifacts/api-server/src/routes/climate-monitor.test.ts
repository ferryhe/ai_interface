import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { request as httpRequest, type Server } from "node:http";

import {
  __privateClimateMonitorRouteGuards,
  createClimateMonitorRouter,
} from "./climate-monitor";
import type {
  ClimateMonitorRunResult,
  ClimateMonitorStatus,
} from "../climate-monitor/service";
import { ClimateMonitorProcessError } from "../climate-monitor/service";

async function withClimateMonitorApp<T>(
  dependencies: Parameters<typeof createClimateMonitorRouter>[0],
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(createClimateMonitorRouter(dependencies));

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function rawPost(
  baseUrl: string,
  input: {
    host: string;
    forwardedHost?: string;
    forwardedFor?: string;
    origin?: string;
    secFetchSite?: string;
    surface?: string;
  },
): Promise<{ statusCode: number; text: string }> {
  const url = new URL("/climate-monitor/runs", baseUrl);
  const body = JSON.stringify({ dryRun: true });

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          Host: input.host,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-AI-Interface-Command-Intent": "climate-monitor-run",
          ...(input.origin ? { Origin: input.origin } : {}),
          ...(input.forwardedHost
            ? { "X-Forwarded-Host": input.forwardedHost }
            : {}),
          ...(input.forwardedFor
            ? { "X-Forwarded-For": input.forwardedFor }
            : {}),
          ...(input.secFetchSite
            ? { "Sec-Fetch-Site": input.secFetchSite }
            : {}),
          ...(input.surface ? { "X-AI-Interface-Surface": input.surface } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

test("/climate-monitor/status returns redacted status", async () => {
  const configuredPath = "C:\\secret\\climate_monitor_wiki";
  const status: ClimateMonitorStatus = {
    project: {
      status: "ready",
      configuredBy: "CLIMATE_MONITOR_PROJECT_PATH",
      defaultSiblingPath: "../climate_monitor_wiki",
      script: "scripts/run_climate_monitor.py",
    },
    git: {
      branch: "codex/climate-monitor-ops-interface",
      dirty: false,
      status: "clean",
    },
    latestReport: {
      date: "2026-05-14",
      path: "sources/climate-monitor-2026-05-14.md",
      title: "Daily Climate & Actuarial Monitor - 2026-05-14",
      summary: "Latest climate monitor summary.",
    },
    coverage: {
      sourceCount: 34,
      scopeCount: 34,
      scopedSourceCount: 34,
      missingScopeCount: 0,
      status: "complete",
    },
  };

  const response = await withClimateMonitorApp(
    {
      getStatus: async () => status,
      startRun: async () => {
        throw new Error("not used");
      },
    },
    (baseUrl) => fetch(`${baseUrl}/climate-monitor/status`),
  );

  const text = await response.text();
  const json = JSON.parse(text) as { project: { configuredBy: string } };
  assert.equal(response.status, 200);
  assert.equal(json.project.configuredBy, "CLIMATE_MONITOR_PROJECT_PATH");
  assert.equal(text.includes(configuredPath), false);
});

test("/climate-monitor/runs normalizes dry_run requests and returns safe run metadata", async () => {
  const runResult: ClimateMonitorRunResult = {
    parsed: {
      report_date: "2026-05-14",
      report_path: "climate-monitor-2026-05-14.md",
      items: [],
    },
    command: {
      executable: "python",
      args: [
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
        "--state-dir",
        ".tmp/ai-interface-climate-monitor/state",
        "--source-dir",
        ".tmp/ai-interface-climate-monitor/sources",
        "--wiki-dir",
        ".tmp/ai-interface-climate-monitor/wiki",
        "--no-sync",
        "--no-update-seen-state",
      ],
      cwd: "ai_interface_workspace",
      shell: false,
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      dryRun: true,
    },
    exitCode: 0,
    stderr: "",
  };
  let receivedDryRun: boolean | undefined;

  const response = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async (input) => {
        receivedDryRun = input.dryRun;
        return runResult;
      },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/climate-monitor/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Interface-Command-Intent": "climate-monitor-run",
        },
        body: JSON.stringify({
          dry_run: true,
          manifestFixture:
            "monitoring/fixtures/web_listening_manifest_sample.json",
        }),
      }),
  );

  const text = await response.text();
  const json = JSON.parse(text) as ClimateMonitorRunResult;
  assert.equal(response.status, 200);
  assert.equal(receivedDryRun, true);
  assert.equal(json.command.shell, false);
  assert.equal(json.command.args[0], "scripts/run_climate_monitor.py");
  assert.equal(text.includes("C:\\secret"), false);
});

test("/climate-monitor/runs rejects missing command intent before starting a process", async () => {
  let startRunCalled = false;

  const response = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async () => {
        startRunCalled = true;
        throw new Error("not used");
      },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/climate-monitor/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }),
  );

  const text = await response.text();
  assert.equal(response.status, 403);
  assert.equal(startRunCalled, false);
  assert.match(text, /explicit command intent/);
});

test("/climate-monitor/runs rejects cross-site command requests", async () => {
  let startRunCalled = false;

  const response = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async () => {
        startRunCalled = true;
        throw new Error("not used");
      },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/climate-monitor/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Interface-Command-Intent": "climate-monitor-run",
          "Sec-Fetch-Site": "cross-site",
        },
        body: JSON.stringify({ dryRun: true }),
      }),
  );

  assert.equal(response.status, 403);
  assert.equal(startRunCalled, false);
});

test("/climate-monitor/runs rejects loopback origins on a different host", async () => {
  let startRunCalled = false;

  const response = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async () => {
        startRunCalled = true;
        throw new Error("not used");
      },
    },
    async (baseUrl) => {
      const port = new URL(baseUrl).port;
      return rawPost(baseUrl, {
        host: `127.0.0.1:${port}`,
        origin: `http://localhost:${port}`,
      });
    },
  );

  assert.equal(response.statusCode, 403);
  assert.equal(startRunCalled, false);
  assert.match(response.text, /Origin does not match/);
});

test("/climate-monitor/runs accepts same-origin requests with mixed-case Host headers", async () => {
  const runResult: ClimateMonitorRunResult = {
    parsed: {
      report_date: "2026-05-14",
      report_path: "climate-monitor-2026-05-14.md",
      items: [],
    },
    command: {
      executable: "python",
      args: ["scripts/run_climate_monitor.py", "--json"],
      cwd: "ai_interface_workspace",
      shell: false,
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      dryRun: true,
    },
    exitCode: 0,
    stderr: "",
  };
  let startRunCalled = false;

  const response = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async () => {
        startRunCalled = true;
        return runResult;
      },
    },
    async (baseUrl) => {
      const port = new URL(baseUrl).port;
      return rawPost(baseUrl, {
        host: `LOCALHOST:${port}`,
        origin: `http://localhost:${port}`,
      });
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(startRunCalled, true);
});

test("/climate-monitor/runs accepts Vite-proxied localhost command requests with forwarded host", async () => {
  const runResult: ClimateMonitorRunResult = {
    parsed: {
      report_date: "2026-05-14",
      report_path: "climate-monitor-2026-05-14.md",
      items: [],
    },
    command: {
      executable: "python",
      args: ["scripts/run_climate_monitor.py", "--json"],
      cwd: "ai_interface_workspace",
      shell: false,
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      dryRun: true,
    },
    exitCode: 0,
    stderr: "",
  };
  let startRunCalled = false;

  const response = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async () => {
        startRunCalled = true;
        return runResult;
      },
    },
    async (baseUrl) => {
      const apiHost = new URL(baseUrl).host;
      const uiHost = "127.0.0.1:5174";
      return rawPost(baseUrl, {
        host: apiHost,
        forwardedHost: uiHost,
        forwardedFor: "127.0.0.1",
        origin: `http://${uiHost}`,
        secFetchSite: "same-origin",
      });
    },
  );

  assert.equal(response.statusCode, 200);
  assert.equal(startRunCalled, true);
});

test("/climate-monitor/runs rejects non-local command hosts before starting a process", async () => {
  let startRunCalled = false;

  const responses = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async () => {
        startRunCalled = true;
        throw new Error("not used");
      },
    },
    async (baseUrl) =>
      Promise.all([
        rawPost(baseUrl, {
          host: "api.example.com",
          origin: "http://api.example.com",
        }),
        rawPost(baseUrl, {
          host: "127.evil.com",
          origin: "http://127.evil.com",
        }),
      ]),
  );

  assert.equal(responses[0]?.statusCode, 403);
  assert.equal(responses[1]?.statusCode, 403);
  assert.equal(startRunCalled, false);
  assert.match(responses[0]?.text ?? "", /localhost/);
  assert.match(responses[1]?.text ?? "", /localhost/);
});

test("/climate-monitor/runs maps process failures to server errors", async () => {
  const response = await withClimateMonitorApp(
    {
      getStatus: async () => {
        throw new Error("not used");
      },
      startRun: async () => {
        throw new ClimateMonitorProcessError("Climate monitor returned invalid JSON");
      },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/climate-monitor/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Interface-Command-Intent": "climate-monitor-run",
        },
        body: JSON.stringify({ dryRun: true }),
      }),
  );

  const text = await response.text();
  assert.equal(response.status, 500);
  assert.match(text, /invalid JSON/);
});

test("climate monitor route remote guard accepts only loopback addresses", () => {
  assert.equal(
    __privateClimateMonitorRouteGuards.isLoopbackRemoteAddress("127.0.0.1"),
    true,
  );
  assert.equal(
    __privateClimateMonitorRouteGuards.isLoopbackRemoteAddress("::ffff:127.0.0.1"),
    true,
  );
  assert.equal(
    __privateClimateMonitorRouteGuards.isLoopbackRemoteAddress("203.0.113.10"),
    false,
  );
});
