import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import test from "node:test";
import express from "express";

import {
  __privateAgentConfigRouteGuards,
  createAgentConfigRouter,
} from "./agent-config";
import {
  InMemoryAgentConfigRepository,
  type AgentConfigRepository,
  type AgentConfigRecord,
} from "../agent-config/agent-config-service";

async function withAgentConfigApp<T>(
  repository: AgentConfigRepository,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(createAgentConfigRouter(repository));

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

async function rawAgentConfigRequest(
  baseUrl: string,
  input: {
    path?: string;
    method?: string;
    host?: string;
    forwardedHost?: string;
    forwardedFor?: string;
    origin?: string;
    secFetchSite?: string;
    surface?: string;
    body?: unknown;
  } = {},
): Promise<{ statusCode: number; text: string }> {
  const url = new URL(input.path ?? "/agent-config", baseUrl);
  const body = input.body === undefined ? undefined : JSON.stringify(input.body);

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: input.method ?? "GET",
        headers: {
          Host: input.host ?? url.host,
          ...(body === undefined
            ? {}
            : {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }),
          ...(input.origin ? { Origin: input.origin } : {}),
          ...(input.forwardedHost ? { "X-Forwarded-Host": input.forwardedHost } : {}),
          ...(input.forwardedFor ? { "X-Forwarded-For": input.forwardedFor } : {}),
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

test("agent config routes reject cross-site, Portal-origin, and non-local requests before touching config", async () => {
  let touchedConfig = false;
  const repository: AgentConfigRepository = {
    async findConfig(): Promise<AgentConfigRecord | null> {
      touchedConfig = true;
      return null;
    },
    async upsertConfig(): Promise<AgentConfigRecord> {
      touchedConfig = true;
      throw new Error("agent config repository should not be touched");
    },
  };

  await withAgentConfigApp(repository, async (baseUrl) => {
    const responses = await Promise.all([
      rawAgentConfigRequest(baseUrl, {
        secFetchSite: "cross-site",
      }),
      rawAgentConfigRequest(baseUrl, {
        surface: "agent-portal",
      }),
      rawAgentConfigRequest(baseUrl, {
        method: "PUT",
        host: "app.example.com",
        body: { provider: "deterministic" },
      }),
      rawAgentConfigRequest(baseUrl, {
        host: new URL(baseUrl).host,
        forwardedHost: "192.168.0.20:5174",
        forwardedFor: "192.168.0.20",
        origin: "http://192.168.0.20:5174",
      }),
      rawAgentConfigRequest(baseUrl, {
        host: new URL(baseUrl).host,
        forwardedHost: "app.example.com",
        forwardedFor: "127.0.0.1",
        origin: "http://app.example.com",
      }),
      rawAgentConfigRequest(baseUrl, {
        host: new URL(baseUrl).host,
        forwardedHost: "localhost:5174",
        forwardedFor: "127.0.0.1",
        origin: "http://localhost:5174",
        secFetchSite: "same-site",
      }),
      rawAgentConfigRequest(baseUrl, {
        host: new URL(baseUrl).host,
        forwardedHost: "localhost:5174",
        forwardedFor: "127.0.0.1, 192.168.0.20",
        origin: "http://localhost:5174",
        secFetchSite: "same-origin",
      }),
      rawAgentConfigRequest(baseUrl, {
        path: "/agent-config/test-connection",
        method: "POST",
        origin: "http://app.example.com",
      }),
    ]);

    assert.deepEqual(
      responses.map((response) => response.statusCode),
      [403, 403, 403, 403, 403, 403, 403, 403],
    );
    assert.match(responses[0]!.text, /Cross-site agent config read/);
    assert.match(responses[1]!.text, /not available to Portal runtime/);
    assert.match(responses[2]!.text, /only allowed from localhost/);
    assert.match(responses[3]!.text, /only allowed from localhost/);
    assert.match(responses[4]!.text, /Origin does not match/);
    assert.match(responses[5]!.text, /Origin does not match/);
    assert.match(responses[6]!.text, /only allowed from localhost/);
    assert.match(responses[7]!.text, /Origin does not match/);
    assert.equal(touchedConfig, false);
  });
});

test("agent config routes accept Vite-proxied localhost admin writes with forwarded host", async () => {
  const repository = new InMemoryAgentConfigRepository();

  await withAgentConfigApp(repository, async (baseUrl) => {
    const apiHost = new URL(baseUrl).host;
    const uiHost = "127.0.0.1:5174";
    const update = await rawAgentConfigRequest(baseUrl, {
      method: "PUT",
      host: apiHost,
      forwardedHost: uiHost,
      forwardedFor: "127.0.0.1",
      secFetchSite: "same-origin",
      origin: `http://${uiHost}`,
      body: {
        provider: "deterministic",
        endpoint: "responses",
        modelId: "deterministic-v1",
        reasoningEffort: "none",
      },
    });

    assert.equal(update.statusCode, 200);
    assert.match(update.text, /"provider":"deterministic"/);
  });
});

test("agent config routes accept same-origin localhost admin requests", async () => {
  const repository = new InMemoryAgentConfigRepository();

  await withAgentConfigApp(repository, async (baseUrl) => {
    const host = new URL(baseUrl).host;
    const config = await rawAgentConfigRequest(baseUrl, {
      host,
      origin: `http://${host}`,
    });
    assert.equal(config.statusCode, 200);
    assert.match(config.text, /"provider":"openai"/);
    assert.doesNotMatch(config.text, /portalTokenHash/);

    const update = await rawAgentConfigRequest(baseUrl, {
      method: "PUT",
      host,
      origin: `http://${host}`,
      body: {
        provider: "deterministic",
        endpoint: "responses",
        modelId: "deterministic-v1",
        reasoningEffort: "none",
      },
    });
    assert.equal(update.statusCode, 200);
    assert.match(update.text, /"provider":"deterministic"/);

    const testConnection = await rawAgentConfigRequest(baseUrl, {
      path: "/agent-config/test-connection",
      method: "POST",
      host,
      origin: `http://${host}`,
    });
    assert.equal(testConnection.statusCode, 200);
    assert.match(testConnection.text, /"status":"configured"/);
  });
});

test("agent config loopback guard accepts IPv4-mapped localhost sockets", () => {
  assert.equal(
    __privateAgentConfigRouteGuards.isLoopbackRemoteAddress("::ffff:127.0.0.1"),
    true,
  );
  assert.equal(
    __privateAgentConfigRouteGuards.isLoopbackRemoteAddress("192.168.0.10"),
    false,
  );
});
