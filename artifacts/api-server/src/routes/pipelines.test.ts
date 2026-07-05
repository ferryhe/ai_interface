import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import test from "node:test";
import express from "express";

import {
  __privatePipelinesRouteGuards,
  createPipelinesRouter,
} from "./pipelines";
import type {
  ActuarialPipelineRunnerService,
  PipelineRunRecord,
} from "../pipelines/runner";

async function withPipelinesApp<T>(
  service: ActuarialPipelineRunnerService,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(createPipelinesRouter(service));

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function rawPipelinePost(
  baseUrl: string,
  input: {
    host?: string;
    forwardedHost?: string;
    forwardedFor?: string;
    origin?: string;
    commandIntent?: string;
    secFetchSite?: string;
    surface?: string;
  } = {},
): Promise<{ statusCode: number; text: string }> {
  const url = new URL("/pipelines/runs", baseUrl);
  const body = JSON.stringify({ inputPath: "case_input.json" });

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          Host: input.host ?? url.host,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...(input.commandIntent
            ? { "X-AI-Interface-Command-Intent": input.commandIntent }
            : {}),
          ...(input.origin ? { Origin: input.origin } : {}),
          ...(input.forwardedHost
            ? { "X-Forwarded-Host": input.forwardedHost }
            : {}),
          ...(input.forwardedFor
            ? { "X-Forwarded-For": input.forwardedFor }
            : {}),
          ...(input.secFetchSite ? { "Sec-Fetch-Site": input.secFetchSite } : {}),
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

async function rawPipelineGet(
  baseUrl: string,
  path: string,
  input: {
    host?: string;
    forwardedHost?: string;
    forwardedFor?: string;
    origin?: string;
    secFetchSite?: string;
    surface?: string;
  } = {},
): Promise<{ statusCode: number; text: string }> {
  const url = new URL(path, baseUrl);

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
        headers: {
          Host: input.host ?? url.host,
          ...(input.origin ? { Origin: input.origin } : {}),
          ...(input.forwardedHost
            ? { "X-Forwarded-Host": input.forwardedHost }
            : {}),
          ...(input.forwardedFor
            ? { "X-Forwarded-For": input.forwardedFor }
            : {}),
          ...(input.secFetchSite ? { "Sec-Fetch-Site": input.secFetchSite } : {}),
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
    req.end();
  });
}

function fakePipelineRun(overrides: Partial<PipelineRunRecord> = {}): PipelineRunRecord {
  return {
    runId: "run-route-test",
    pipelineId: "actuarial-reserving-review",
    version: "1.0.0",
    manifestPath: "manifest.yaml",
    inputPath: "case_input.json",
    artifactRoot: "artifacts",
    status: "queued",
    governanceStatus: null,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    durationMs: null,
    steps: [],
    artifacts: [],
    error: null,
    ...overrides,
  };
}

function fakeService(startRun: ActuarialPipelineRunnerService["startRun"]): ActuarialPipelineRunnerService {
  return {
    startRun,
    listRuns: () => [],
    getRun: () => null,
    waitForRun: async () => null,
  } as unknown as ActuarialPipelineRunnerService;
}

test("pipeline run route rejects missing command intent before starting execution", async () => {
  let started = false;
  const service = fakeService(async () => {
    started = true;
    return fakePipelineRun();
  });

  const response = await withPipelinesApp(service, (baseUrl) =>
    rawPipelinePost(baseUrl),
  );

  assert.equal(response.statusCode, 403);
  assert.match(response.text, /explicit command intent/);
  assert.equal(started, false);
});

test("pipeline run route rejects cross-site command requests before starting execution", async () => {
  let started = false;
  const service = fakeService(async () => {
    started = true;
    return fakePipelineRun();
  });

  const response = await withPipelinesApp(service, (baseUrl) =>
    rawPipelinePost(baseUrl, {
      commandIntent: "actuarial-pipeline-run",
      secFetchSite: "cross-site",
    }),
  );

  assert.equal(response.statusCode, 403);
  assert.match(response.text, /Cross-site/);
  assert.equal(started, false);
});

test("pipeline run route accepts same-origin localhost command requests", async () => {
  const service = fakeService(async (input) =>
    fakePipelineRun({ inputPath: input.inputPath, runId: "run-from-route" }),
  );

  const response = await withPipelinesApp(service, (baseUrl) => {
    const host = new URL(baseUrl).host;
    return rawPipelinePost(baseUrl, {
      host,
      origin: `http://${host}`,
      commandIntent: "actuarial-pipeline-run",
    });
  });
  const json = JSON.parse(response.text) as { runId: string; inputPath: string };

  assert.equal(response.statusCode, 201);
  assert.equal(json.runId, "run-from-route");
  assert.equal(json.inputPath, "case_input.json");
});

test("pipeline run route accepts Vite-proxied localhost command requests with forwarded host", async () => {
  const service = fakeService(async (input) =>
    fakePipelineRun({ inputPath: input.inputPath, runId: "run-from-vite-proxy" }),
  );

  const response = await withPipelinesApp(service, (baseUrl) => {
    const apiHost = new URL(baseUrl).host;
    const uiHost = "127.0.0.1:5174";
    return rawPipelinePost(baseUrl, {
      host: apiHost,
      forwardedHost: uiHost,
      forwardedFor: "127.0.0.1",
      origin: `http://${uiHost}`,
      secFetchSite: "same-origin",
      commandIntent: "actuarial-pipeline-run",
    });
  });
  const json = JSON.parse(response.text) as { runId: string; inputPath: string };

  assert.equal(response.statusCode, 201);
  assert.equal(json.runId, "run-from-vite-proxy");
  assert.equal(json.inputPath, "case_input.json");
});

test("pipeline run route rejects non-loopback forwarded clients before starting execution", async () => {
  let started = false;
  const service = fakeService(async () => {
    started = true;
    return fakePipelineRun();
  });

  const response = await withPipelinesApp(service, (baseUrl) => {
    const apiHost = new URL(baseUrl).host;
    return rawPipelinePost(baseUrl, {
      host: apiHost,
      forwardedHost: "127.0.0.1:5174",
      forwardedFor: "192.168.0.20",
      origin: "http://127.0.0.1:5174",
      secFetchSite: "same-origin",
      commandIntent: "actuarial-pipeline-run",
    });
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.text, /localhost/);
  assert.equal(started, false);
});

test("pipeline route remote guard accepts IPv4-mapped loopback addresses", () => {
  assert.equal(
    __privatePipelinesRouteGuards.isLoopbackRemoteAddress("::ffff:127.0.0.1"),
    true,
  );
  assert.equal(
    __privatePipelinesRouteGuards.isLoopbackRemoteAddress("::ffff:10.0.0.1"),
    false,
  );
});

test("pipeline read routes reject cross-site requests before exposing run details", async () => {
  const service = {
    startRun: async () => fakePipelineRun(),
    listRuns: () => [fakePipelineRun({ artifactRoot: "/sensitive/artifacts" })],
    getRun: () => fakePipelineRun({ artifactRoot: "/sensitive/artifacts" }),
    waitForRun: async () => fakePipelineRun(),
  } as unknown as ActuarialPipelineRunnerService;

  const listResponse = await withPipelinesApp(service, (baseUrl) =>
    rawPipelineGet(baseUrl, "/pipelines/runs", { secFetchSite: "cross-site" }),
  );
  const detailResponse = await withPipelinesApp(service, (baseUrl) =>
    rawPipelineGet(baseUrl, "/pipelines/runs/run-route-test", {
      secFetchSite: "cross-site",
    }),
  );

  assert.equal(listResponse.statusCode, 403);
  assert.equal(detailResponse.statusCode, 403);
  assert.doesNotMatch(listResponse.text, /sensitive/);
  assert.doesNotMatch(detailResponse.text, /sensitive/);
});

test("pipeline read routes accept same-origin localhost requests", async () => {
  const service = {
    startRun: async () => fakePipelineRun(),
    listRuns: () => [fakePipelineRun({ runId: "listed-run" })],
    getRun: () => fakePipelineRun({ runId: "detail-run" }),
    waitForRun: async () => fakePipelineRun(),
  } as unknown as ActuarialPipelineRunnerService;

  const listResponse = await withPipelinesApp(service, (baseUrl) => {
    const host = new URL(baseUrl).host;
    return rawPipelineGet(baseUrl, "/pipelines/runs", {
      host,
      origin: `http://${host}`,
    });
  });
  const detailResponse = await withPipelinesApp(service, (baseUrl) => {
    const host = new URL(baseUrl).host;
    return rawPipelineGet(baseUrl, "/pipelines/runs/detail-run", {
      host,
      origin: `http://${host}`,
    });
  });

  assert.equal(listResponse.statusCode, 200);
  assert.match(listResponse.text, /listed-run/);
  assert.equal(detailResponse.statusCode, 200);
  assert.match(detailResponse.text, /detail-run/);
});
