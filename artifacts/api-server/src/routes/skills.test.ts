import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import { createSkillsRouter } from "./skills";

async function withSkillsApp<T>(
  callback: (baseUrl: string) => Promise<T>,
  manifests?: SkillManifest[],
): Promise<T> {
  const app = express();
  app.use(
    createSkillsRouter(
      manifests ? createSkillRuntimeRegistry(manifests) : createSkillRuntimeRegistry(),
      {},
      () => false,
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

test("/skills returns default manifests and readiness", async () => {
  const response = await withSkillsApp((baseUrl) => fetch(`${baseUrl}/skills`));
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
    (baseUrl) => fetch(`${baseUrl}/skills`),
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
    (baseUrl) => fetch(`${baseUrl}/skills`),
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
