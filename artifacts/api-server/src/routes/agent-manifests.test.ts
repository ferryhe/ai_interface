import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import { mkdir, readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";

import { formatAgentManifestYaml } from "../agent-registry/agent-manifest-writer";
import { createAgentManifestsRouter } from "./agent-manifests";

async function createRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "agent-manifests-route-"));
}

async function createWorkspaceLikeRoot(): Promise<{
  root: string;
  apiServerCwd: string;
}> {
  const root = await createRoot();
  const apiServerCwd = join(root, "artifacts", "api-server");
  await mkdir(join(root, "agents", "builtin"), { recursive: true });
  await mkdir(apiServerCwd, { recursive: true });
  return { root, apiServerCwd };
}

async function withProcessCwd<T>(
  cwd: string,
  callback: () => Promise<T>,
): Promise<T> {
  const originalCwd = process.cwd();
  process.chdir(cwd);
  try {
    return await callback();
  } finally {
    process.chdir(originalCwd);
  }
}

async function withAgentManifestsApp<T>(
  options: Parameters<typeof createAgentManifestsRouter>[0],
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use("/api", createAgentManifestsRouter(options));

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

function requestBody(): {
  agentId: string;
  manifest: Record<string, any> & {
    planner: Record<string, any>;
  };
} {
  return {
    agentId: "my_agent",
    manifest: {
      name: "My Agent",
      description: "Created through the API.",
      instructions: "Use selected skills.",
      skills: [{ skillId: "md_to_rag", required: false }],
      planner: { mode: "linear", failureStrategy: "fail_fast" },
      permissions: {
        approvalRequired: false,
        canUseNetwork: false,
        canWriteDatabase: true,
      },
      memory: { promotionMode: "run_summary" },
      handoffs: [],
      tests: [],
    },
  };
}

async function rawAgentManifestPost(
  baseUrl: string,
  body: unknown,
  input: {
    host?: string;
    forwardedHost?: string;
    forwardedFor?: string;
    origin?: string;
    secFetchSite?: string;
    surface?: string;
  } = {},
): Promise<{ statusCode: number; text: string }> {
  const url = new URL("/api/agent-manifests", baseUrl);
  const payload = JSON.stringify(body);

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
          "Content-Length": Buffer.byteLength(payload),
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
    req.end(payload);
  });
}

test("POST /api/agent-manifests returns 403 unless custom write mode is enabled", async () => {
  const response = await withAgentManifestsApp(
    { cwd: await createRoot(), env: {} },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody()),
      }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Agent manifest writes require AI_INTERFACE_MANIFEST_WRITE_MODE=custom",
  });
});

test("POST /api/agent-manifests creates and validates a custom agent when enabled", async () => {
  const cwd = await createRoot();
  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody()),
      }),
  );
  const json = (await response.json()) as {
    manifest: { agentId: string; source: string; skills: unknown[] };
    path: string;
  };

  assert.equal(response.status, 201);
  assert.equal(json.manifest.agentId, "my_agent");
  assert.equal(json.manifest.source, "custom");
  assert.deepEqual(json.manifest.skills, [
    { skillId: "md_to_rag", required: false },
  ]);
  assert.equal(json.path, "[redacted]");
});

test("POST /api/agent-manifests defaults writes to workspace root from api-server cwd", async () => {
  const { root, apiServerCwd } = await createWorkspaceLikeRoot();
  const response = await withProcessCwd(apiServerCwd, () =>
    withAgentManifestsApp(
      {
        env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
      },
      (baseUrl) =>
        fetch(`${baseUrl}/api/agent-manifests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody()),
        }),
    ),
  );
  const json = (await response.json()) as { path: string };

  assert.equal(response.status, 201);
  assert.equal(json.path, "[redacted]");
  assert.equal(
    await fileExists(
      join(apiServerCwd, "agents", "custom", "my_agent", "agent.yaml"),
    ),
    false,
  );
});

test("POST /api/agent-manifests returns 400 for invalid manifests and leaves no file", async () => {
  const cwd = await createRoot();
  const body = requestBody();
  body.manifest.planner.mode = "not_a_mode";

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  );

  assert.equal(response.status, 400);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests rejects cross-site writes before file write", async () => {
  const cwd = await createRoot();

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify(requestBody()),
      }),
  );

  assert.equal(response.status, 403);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests rejects non-local write hosts before file write", async () => {
  const cwd = await createRoot();

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      rawAgentManifestPost(baseUrl, requestBody(), { host: "example.com" }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests accepts Vite-proxied localhost writes with forwarded host", async () => {
  const cwd = await createRoot();

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) => {
      const apiHost = new URL(baseUrl).host;
      const uiHost = "127.0.0.1:5174";
      return rawAgentManifestPost(baseUrl, requestBody(), {
        host: apiHost,
        forwardedHost: uiHost,
        forwardedFor: "127.0.0.1",
        origin: `http://${uiHost}`,
        secFetchSite: "same-origin",
      });
    },
  );

  assert.equal(response.statusCode, 201);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    true,
  );
});

test("POST /api/agent-manifests rejects Portal-surface writes before file write", async () => {
  const cwd = await createRoot();

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      rawAgentManifestPost(baseUrl, requestBody(), {
        surface: "agent-portal",
      }),
  );

  assert.equal(response.statusCode, 403);
  assert.match(response.text, /Portal runtime is not allowed/);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests rejects conflicting manifest agentId", async () => {
  const cwd = await createRoot();
  const body = requestBody();
  body.manifest.agentId = "other_agent";

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  );

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /manifest.agentId/);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests rejects writes that target built-in agent IDs", async () => {
  const cwd = await createRoot();
  const builtinDir = join(cwd, "agents", "builtin", "my_agent");
  await mkdir(builtinDir, { recursive: true });
  await writeFile(
    join(builtinDir, "agent.yaml"),
    formatAgentManifestYaml({
      ...requestBody().manifest,
      agentId: "my_agent",
      source: "builtin",
    } as never),
    "utf8",
  );

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody()),
      }),
  );

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /built-in agent manifest/);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests rejects writes that target community agent IDs", async () => {
  const cwd = await createRoot();
  const communityDir = join(cwd, "agents", "community", "my_agent");
  await mkdir(communityDir, { recursive: true });
  await writeFile(
    join(communityDir, "agent.yaml"),
    formatAgentManifestYaml({
      ...requestBody().manifest,
      agentId: "my_agent",
      source: "community",
    } as never),
    "utf8",
  );

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody()),
      }),
  );

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /community agent manifest/);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests rejects traversal-like agent IDs", async () => {
  const cwd = await createRoot();
  const body = requestBody();
  body.agentId = "../escape";

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  );

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /Invalid agentId/);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "escape", "agent.yaml")),
    false,
  );
});

test("POST /api/agent-manifests redacts sensitive paths from error and success responses", async () => {
  const cwd = await createRoot();
  const successResponse = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...requestBody(),
          manifest: {
            ...requestBody().manifest,
            instructions: "Read /home/ec2-user/work/secret/.env before acting.",
          },
        }),
      }),
  );
  const successText = JSON.stringify(await successResponse.json());
  assert.equal(successText.includes("/home/ec2-user/work/secret/.env"), false);
  assert.match(successText, /\[redacted\]/);

  const duplicateResponse = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      fetch(`${baseUrl}/api/agent-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody()),
      }),
  );
  const duplicateText = JSON.stringify(await duplicateResponse.json());
  assert.equal(duplicateText.includes(join(cwd, "agents", "custom")), false);
  assert.match(duplicateText, /\[redacted\]/);
});

test("POST /api/agent-manifests rejects portal-style cross-origin writes", async () => {
  const cwd = await createRoot();

  const response = await withAgentManifestsApp(
    {
      cwd,
      env: { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    },
    (baseUrl) =>
      rawAgentManifestPost(baseUrl, requestBody(), {
        origin: "https://portal.example.com",
      }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
