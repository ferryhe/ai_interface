import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";

import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { formatSkillManifestYaml } from "../skill-runtime/skill-manifest-writer";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import { createSkillsRouter } from "./skills";

async function createRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "skills-route-"));
}

async function withSkillsApp<T>(
  callback: (baseUrl: string) => Promise<T>,
  manifests?: SkillManifest[],
  env: Record<string, string | undefined> = {},
  cwd?: string,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createSkillsRouter(
      manifests ? createSkillRuntimeRegistry(manifests) : createSkillRuntimeRegistry(),
      env,
      () => false,
      { cwd },
    ),
  );

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

function customReporterManifest(): SkillManifest {
  return {
    skillId: "custom_reporter",
    moduleId: "custom_reporter",
    name: "Custom Reporter",
    description: "Create custom reports from artifacts.",
    category: "agent",
    project: {
      source: "external",
      defaultSiblingPath: "../custom_reporter",
    },
    execution: {
      kind: "http",
      adapterId: "custom_reporter.http.v1",
      requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      optionalEnv: [],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: [],
      supportsResume: false,
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    artifactKinds: ["custom_report"],
    interactionKinds: [],
    ui: {
      mode: "auto",
      preferredRenderer: "markdown",
      openOnTrigger: false,
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  };
}

function customMcpManifest(): SkillManifest {
  return {
    skillId: "custom_mcp",
    moduleId: "custom_mcp",
    name: "Custom MCP",
    description: "Call a custom MCP tool.",
    category: "agent",
    project: {
      source: "external",
      defaultSiblingPath: "../custom_mcp",
    },
    execution: {
      kind: "mcp",
      adapterId: "custom_mcp.mcp.v1",
      requiredEnv: ["CUSTOM_MCP_SERVER_URL"],
      optionalEnv: ["CUSTOM_MCP_AUTH_TOKEN"],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: [],
      supportsResume: false,
      mcpServerEnv: "CUSTOM_MCP_SERVER_URL",
      mcpToolName: "custom.tool",
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    artifactKinds: ["custom_result"],
    interactionKinds: [],
    ui: {
      mode: "auto",
      preferredRenderer: "json",
      openOnTrigger: false,
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  };
}

function skillManifestBody(): {
  skillId: string;
  manifest: Record<string, unknown>;
} {
  return {
    skillId: "my_skill",
    manifest: {
      moduleId: "my_skill_module",
      name: "My Skill",
      description: "Created through the API.",
      category: "agent",
      project: {
        defaultSiblingPath: "../my_skill_project",
      },
      execution: {
        kind: "cli",
        adapterId: "my_skill.cli.v1",
        requiredEnv: [],
        optionalEnv: [],
        timeoutMs: 120000,
        maxOutputBytes: 1048576,
        command: ["python", "run.py"],
        allowedCommands: ["python", "run.py"],
        supportsResume: false,
      },
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      interactionKinds: [],
      artifactKinds: ["report"],
      ui: {
        mode: "auto",
        preferredRenderer: "markdown",
        openOnTrigger: false,
      },
      permissions: {
        approvalRequired: false,
        canUseNetwork: false,
        canWriteDatabase: false,
      },
    },
  };
}

async function rawSkillManifestPost(
  baseUrl: string,
  body: unknown,
  input: {
    host?: string;
    origin?: string;
    secFetchSite?: string;
  } = {},
): Promise<{ statusCode: number; text: string }> {
  const url = new URL("/api/skill-manifests", baseUrl);
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
          ...(input.secFetchSite
            ? { "Sec-Fetch-Site": input.secFetchSite }
            : {}),
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

test("/skills returns default manifests and readiness", async () => {
  const response = await withSkillsApp((baseUrl) => fetch(`${baseUrl}/api/skills`));
  const json = (await response.json()) as {
    skills: Array<{
      skillId: string;
      project: { defaultSiblingPath: string };
      ui: { mode: string; openOnTrigger: boolean };
    }>;
    readiness: Array<{
      skillId: string;
      project: { status: string; defaultSiblingPath: string };
    }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.skills.map((skill) => skill.skillId),
    [
      "web_listening",
      "doc_to_md",
      "md_to_rag",
      "rag_to_agent",
      "climate_monitor",
      "ai_actuary",
      "example_reporter",
    ],
  );
  assert.equal(json.skills[0]?.project.defaultSiblingPath, "../web_listening");
  assert.equal(json.skills[0]?.ui.mode, "html");
  assert.equal(json.skills[0]?.ui.openOnTrigger, true);
  assert.deepEqual(
    json.readiness.map((item) => [item.skillId, item.project.status]),
    [
      ["web_listening", "not_configured"],
      ["doc_to_md", "not_configured"],
      ["md_to_rag", "not_configured"],
      ["rag_to_agent", "not_configured"],
      ["climate_monitor", "not_configured"],
      ["ai_actuary", "not_configured"],
      ["example_reporter", "not_configured"],
    ],
  );
});

test("/skills can be served from an injected custom registry", async () => {
  const response = await withSkillsApp(
    (baseUrl) => fetch(`${baseUrl}/api/skills`),
    [customReporterManifest()],
  );
  const json = (await response.json()) as {
    skills: Array<{ skillId: string; artifactKinds: string[] }>;
    readiness: Array<{
      skillId: string;
      adapter: { adapterId: string; missingRequiredEnv: string[] };
    }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.skills.map((skill) => skill.skillId),
    ["custom_reporter"],
  );
  assert.deepEqual(json.skills[0]?.artifactKinds, ["custom_report"]);
  assert.deepEqual(json.readiness, [
    {
      skillId: "custom_reporter",
      project: {
        status: "not_configured",
        configuredBy: "defaultSiblingPath",
        defaultSiblingPath: "../custom_reporter",
      },
      adapter: {
        status: "missing_required_env",
        configured: false,
        adapterId: "custom_reporter.http.v1",
        missingRequiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
        configuredOptionalEnv: [],
      },
      ui: {
        mode: "auto",
        hasHtml: false,
        openOnTrigger: false,
        preferredRenderer: "markdown",
      },
    },
  ]);
});

test("/skills preserves custom MCP execution metadata", async () => {
  const response = await withSkillsApp(
    (baseUrl) => fetch(`${baseUrl}/api/skills`),
    [customMcpManifest()],
  );
  const json = (await response.json()) as {
    skills: Array<{
      execution: {
        kind: string;
        mcpServerEnv?: string;
        mcpToolName?: string;
      };
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(json.skills[0]?.execution.kind, "mcp");
  assert.equal(json.skills[0]?.execution.mcpServerEnv, "CUSTOM_MCP_SERVER_URL");
  assert.equal(json.skills[0]?.execution.mcpToolName, "custom.tool");
});

test("POST /api/skill-manifests returns 403 unless custom write mode is enabled", async () => {
  const response = await withSkillsApp(
    (baseUrl) =>
      fetch(`${baseUrl}/api/skill-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(skillManifestBody()),
      }),
    undefined,
    {},
    await createRoot(),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Skill manifest writes require AI_INTERFACE_MANIFEST_WRITE_MODE=custom",
  });
});

test("POST /api/skill-manifests creates and redacts a custom skill when enabled", async () => {
  const cwd = await createRoot();
  const response = await withSkillsApp(
    (baseUrl) =>
      fetch(`${baseUrl}/api/skill-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...skillManifestBody(),
          manifest: {
            ...skillManifestBody().manifest,
            description: "Read /home/ec2-user/work/secret/.env before acting.",
          },
        }),
      }),
    undefined,
    { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    cwd,
  );
  const json = (await response.json()) as {
    manifest: { skillId: string; project: { source: string }; description: string };
    path: string;
  };

  assert.equal(response.status, 201);
  assert.equal(json.manifest.skillId, "my_skill");
  assert.equal(json.manifest.project.source, "custom");
  assert.equal(json.path, "[redacted]");
  assert.equal(json.manifest.description.includes("/home/ec2-user/work/secret/.env"), false);
  assert.match(json.manifest.description, /\[redacted\]/);
});

test("POST /api/skill-manifests rejects cross-site writes before file write", async () => {
  const cwd = await createRoot();
  const response = await withSkillsApp(
    (baseUrl) =>
      fetch(`${baseUrl}/api/skill-manifests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify(skillManifestBody()),
      }),
    undefined,
    { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    cwd,
  );

  assert.equal(response.status, 403);
  assert.equal(
    await fileExists(join(cwd, "skills", "custom", "my_skill", "skill.yaml")),
    false,
  );
});

test("POST /api/skill-manifests rejects built-in skill IDs", async () => {
  const cwd = await createRoot();
  const builtinDir = join(cwd, "skills", "builtin", "my_skill");
  await mkdir(builtinDir, { recursive: true });
  await writeFile(
    join(builtinDir, "skill.yaml"),
    formatSkillManifestYaml({
      ...(skillManifestBody().manifest as Record<string, unknown>),
      skillId: "my_skill",
      project: { source: "builtin", defaultSiblingPath: "../builtin_project" },
    } as SkillManifest),
    "utf8",
  );

  const response = await withSkillsApp(
    (baseUrl) =>
      fetch(`${baseUrl}/api/skill-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(skillManifestBody()),
      }),
    undefined,
    { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    cwd,
  );

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /built-in skill manifest/);
});

test("POST /api/skill-manifests rejects traversal-like skill IDs", async () => {
  const cwd = await createRoot();
  const body = skillManifestBody();
  body.skillId = "../escape";

  const response = await withSkillsApp(
    (baseUrl) =>
      fetch(`${baseUrl}/api/skill-manifests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    undefined,
    { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    cwd,
  );

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /Invalid skillId/);
});

test("POST /api/skill-manifests rejects portal-style cross-origin writes", async () => {
  const cwd = await createRoot();
  const response = await withSkillsApp(
    (baseUrl) =>
      rawSkillManifestPost(baseUrl, skillManifestBody(), {
        origin: "https://portal.example.com",
      }),
    undefined,
    { AI_INTERFACE_MANIFEST_WRITE_MODE: "custom" },
    cwd,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(
    await fileExists(join(cwd, "skills", "custom", "my_skill", "skill.yaml")),
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
