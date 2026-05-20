import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import type { ToolAdapterDefinition, ToolAdapterReadiness } from "./adapter-registry";
import { HttpToolAdapterExecutor } from "./http-executor";
import type { ToolExecutionRequest } from "./executor";
import type { ModuleRunRecord } from "../modules/ingest-service";

function httpAdapter(input: Partial<ToolAdapterDefinition> = {}): ToolAdapterDefinition {
  return {
    adapterId: "test.http.v1",
    moduleId: "doc_to_md",
    adapterKind: "http",
    displayName: "Test HTTP",
    description: "Test HTTP adapter.",
    sourceRepo: "https://example.com/test-http",
    requiredEnv: ["TEST_HTTP_BASE_URL"],
    optionalEnv: [],
    timeoutMs: 1000,
    maxOutputBytes: 4096,
    allowedCommands: [],
    supportsResume: true,
    readinessHint: "Set TEST_HTTP_BASE_URL.",
    ...input,
  };
}

function run(inputJson: ModuleRunRecord["inputJson"] = {}): ModuleRunRecord {
  const now = new Date();
  return {
    id: "run-1",
    pipelineRunId: null,
    moduleId: "doc_to_md",
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

function request(adapter: ToolAdapterDefinition): ToolExecutionRequest {
  return {
    run: run({ documentId: "doc-1" }),
    adapter,
    readiness: {
      ...adapter,
      configured: true,
      status: "ready",
      missingRequiredEnv: [],
      configuredOptionalEnv: [],
    } satisfies ToolAdapterReadiness,
  };
}

async function withJsonServer(
  handler: (body: unknown, request: { authorization?: string }) => {
    status: number;
    body: unknown;
  },
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      const result = handler(data ? JSON.parse(data) : null, {
        authorization: req.headers.authorization,
      });
      res.statusCode = result.status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(result.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

test("rejects missing base URL env", async () => {
  const result = await new HttpToolAdapterExecutor({}).execute(
    request(httpAdapter()),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.http_configuration_failed");
  assert.match(result.summary ?? "", /base URL/i);
});

test("maps 2xx JSON response to succeeded", async () => {
  const server = await withJsonServer((body) => ({
    status: 200,
    body: { ok: true, received: body },
  }));
  try {
    const result = await new HttpToolAdapterExecutor({
      TEST_HTTP_BASE_URL: server.url,
    }).execute(request(httpAdapter()));

    assert.equal(result.status, "succeeded");
    assert.deepEqual(result.outputJson, {
      ok: true,
      received: { documentId: "doc-1" },
    });
    assert.equal(result.eventType, "tool.execution.http_completed");
  } finally {
    await server.close();
  }
});

test("maps 4xx and 5xx responses to failed", async () => {
  const server = await withJsonServer(() => ({
    status: 503,
    body: { error: "unavailable" },
  }));
  try {
    const result = await new HttpToolAdapterExecutor({
      TEST_HTTP_BASE_URL: server.url,
    }).execute(request(httpAdapter()));

    assert.equal(result.status, "failed");
    assert.equal(result.outputJson?.["statusCode"], 503);
    assert.equal(result.eventSeverity, "error");
  } finally {
    await server.close();
  }
});

test("redacts token and base URL values from result and event JSON", async () => {
  const server = await withJsonServer((_body, req) => ({
    status: 200,
    body: {
      ok: true,
      authorization: req.authorization,
      callback: `${server.url}/callback`,
    },
  }));
  const token = "secret-test-token";
  try {
    const result = await new HttpToolAdapterExecutor({
      TEST_HTTP_BASE_URL: server.url,
      TEST_HTTP_API_TOKEN: token,
    }).execute(
      request(httpAdapter({ optionalEnv: ["TEST_HTTP_API_TOKEN"] })),
    );
    const serialized = JSON.stringify(result);

    assert.equal(result.status, "succeeded");
    assert.equal(serialized.includes(token), false);
    assert.equal(serialized.includes(server.url), false);
    assert.equal(serialized.includes("Authorization"), false);
  } finally {
    await server.close();
  }
});

test("rejects absolute path override before fetch and does not leak auth", async () => {
  let fetchCalled = false;
  let authorization: string | null = null;
  const token = "secret-test-token";
  const fetchFn: typeof fetch = async (_url, init) => {
    fetchCalled = true;
    authorization = new Headers(init?.headers).get("authorization");
    return new Response(JSON.stringify({ authorization }), { status: 200 });
  };

  const result = await new HttpToolAdapterExecutor(
    {
      TEST_HTTP_BASE_URL: "https://safe.example.test/api",
      TEST_HTTP_API_TOKEN: token,
    },
    fetchFn,
  ).execute({
    ...request(httpAdapter({ optionalEnv: ["TEST_HTTP_API_TOKEN"] })),
    run: run({ path: "http://169.254.169.254/latest/meta-data" }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.http_rejected");
  assert.equal(fetchCalled, false);
  assert.equal(authorization, null);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("rejects protocol-relative path override before fetch and does not leak auth", async () => {
  let fetchCalled = false;
  let authorization: string | null = null;
  const token = "secret-test-token";
  const fetchFn: typeof fetch = async (_url, init) => {
    fetchCalled = true;
    authorization = new Headers(init?.headers).get("authorization");
    return new Response(JSON.stringify({ authorization }), { status: 200 });
  };

  const result = await new HttpToolAdapterExecutor(
    {
      TEST_HTTP_BASE_URL: "https://safe.example.test/api",
      TEST_HTTP_API_TOKEN: token,
    },
    fetchFn,
  ).execute({
    ...request(httpAdapter({ optionalEnv: ["TEST_HTTP_API_TOKEN"] })),
    run: run({ path: "//attacker.example.test/collect" }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.http_rejected");
  assert.equal(fetchCalled, false);
  assert.equal(authorization, null);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("rejects cross-origin redirects without following or leaking auth", async () => {
  const token = "secret-test-token";
  let redirectMode: string | undefined;
  let requestAuthorization: string | null = null;
  const fetchFn: typeof fetch = async (_url, init) => {
    redirectMode = init?.redirect;
    requestAuthorization = new Headers(init?.headers).get("authorization");
    return new Response(null, {
      status: 302,
      headers: { location: "https://attacker.example.test/collect" },
    });
  };

  const result = await new HttpToolAdapterExecutor(
    {
      TEST_HTTP_BASE_URL: "https://safe.example.test/api",
      TEST_HTTP_API_TOKEN: token,
    },
    fetchFn,
  ).execute({
    ...request(httpAdapter({ optionalEnv: ["TEST_HTTP_API_TOKEN"] })),
    run: run({ path: "jobs" }),
  });
  const serialized = JSON.stringify(result);

  assert.equal(redirectMode, "manual");
  assert.equal(requestAuthorization, `Bearer ${token}`);
  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.http_rejected");
  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes("safe.example.test"), false);
});

test("rejects metadata redirects without following or leaking auth", async () => {
  const token = "secret-test-token";
  let redirectMode: string | undefined;
  let requestAuthorization: string | null = null;
  const fetchFn: typeof fetch = async (_url, init) => {
    redirectMode = init?.redirect;
    requestAuthorization = new Headers(init?.headers).get("authorization");
    return new Response(null, {
      status: 307,
      headers: { location: "http://169.254.169.254/latest/meta-data" },
    });
  };

  const result = await new HttpToolAdapterExecutor(
    {
      TEST_HTTP_BASE_URL: "https://safe.example.test/api",
      TEST_HTTP_API_TOKEN: token,
    },
    fetchFn,
  ).execute({
    ...request(httpAdapter({ optionalEnv: ["TEST_HTTP_API_TOKEN"] })),
    run: run({ path: "jobs" }),
  });
  const serialized = JSON.stringify(result);

  assert.equal(redirectMode, "manual");
  assert.equal(requestAuthorization, `Bearer ${token}`);
  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.http_rejected");
  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes("169.254.169.254"), false);
});

test("cancels redirect response body before rejecting", async () => {
  let cancelCalled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("redirect body"));
    },
    cancel() {
      cancelCalled = true;
    },
  });
  const fetchFn: typeof fetch = async () =>
    new Response(stream, {
      status: 302,
      headers: { location: "https://attacker.example.test/collect" },
    });

  const result = await new HttpToolAdapterExecutor(
    { TEST_HTTP_BASE_URL: "https://safe.example.test/api" },
    fetchFn,
  ).execute({
    ...request(httpAdapter()),
    run: run({ path: "jobs" }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.eventType, "tool.execution.http_rejected");
  assert.equal(cancelCalled, true);
});

test("truncates streamed HTTP response and cancels the reader at max bytes", async () => {
  let cancelCalled = false;
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode('{"value":"abcdefghijklmnop'),
    encoder.encode('qrstuvwxyz"}'),
  ];
  let chunkIndex = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[chunkIndex];
      chunkIndex += 1;
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelCalled = true;
    },
  });
  const fetchFn: typeof fetch = async () =>
    new Response(stream, {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const result = await new HttpToolAdapterExecutor(
    { TEST_HTTP_BASE_URL: "https://safe.example.test/api" },
    fetchFn,
  ).execute(
    request(
      httpAdapter({
        maxOutputBytes: 18,
      }),
    ),
  );

  assert.equal(result.status, "succeeded");
  assert.equal(result.outputJson?.["value"], '{"value":"abcdefgh');
  assert.equal(result.eventPayload?.["responseTruncated"], true);
  assert.equal(cancelCalled, true);
});
