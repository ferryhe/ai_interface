import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  adapterDefinitions,
  getAdapterDefinition,
  getAdapterReadiness,
  listAdapterReadiness,
} from "./adapter-registry";

test("registers one adapter for each business module", () => {
  assert.deepEqual(
    adapterDefinitions.map((adapter) => adapter.moduleId),
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
  assert.equal(getAdapterDefinition("doc_to_md").adapterKind, "http");
  assert.equal(getAdapterDefinition("md_to_rag").adapterKind, "cli");
  const climateMonitor = getAdapterDefinition("climate_monitor");
  assert.equal(climateMonitor.adapterId, "climate_monitor.cli.v1");
  assert.deepEqual(climateMonitor.requiredEnv, [
    "CLIMATE_MONITOR_PROJECT_PATH",
  ]);
  assert.deepEqual(climateMonitor.allowedCommands, [
    "scripts/run_climate_monitor.py",
  ]);
  const aiActuary = getAdapterDefinition("ai_actuary");
  assert.equal(aiActuary.adapterId, "ai_actuary.cli.v1");
  assert.deepEqual(aiActuary.requiredEnv, ["AI_ACTUARY_PROJECT_PATH"]);
  assert.deepEqual(aiActuary.command, [
    "python",
    "scripts/run_tool_pipeline.py",
    "--json",
  ]);
  assert.deepEqual(aiActuary.allowedCommands, [
    "python scripts/run_tool_pipeline.py",
  ]);
  assert.equal(aiActuary.workingDirectory, "project");
});

test("reports missing required env without exposing env values", () => {
  const readiness = listAdapterReadiness(
    {
      DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
      DOC_TO_MD_API_TOKEN: "secret-token",
    },
    { pathExists: () => false },
  );

  const docToMd = readiness.find((item) => item.moduleId === "doc_to_md");
  assert.equal(docToMd?.status, "ready");
  assert.equal(docToMd?.configured, true);
  assert.deepEqual(docToMd?.missingRequiredEnv, []);
  assert.deepEqual(docToMd?.configuredOptionalEnv, ["DOC_TO_MD_API_TOKEN"]);
  assert.equal(JSON.stringify(docToMd).includes("secret-token"), false);

  const webListening = readiness.find(
    (item) => item.moduleId === "web_listening",
  );
  assert.equal(webListening?.status, "missing_required_env");
  assert.deepEqual(webListening?.missingRequiredEnv, [
    "WEB_LISTENING_CLI_PATH",
  ]);

  const climateMonitor = readiness.find(
    (item) => item.moduleId === "climate_monitor",
  );
  assert.equal(climateMonitor?.status, "missing_required_env");
  assert.deepEqual(climateMonitor?.missingRequiredEnv, [
    "CLIMATE_MONITOR_PROJECT_PATH",
  ]);

  const aiActuary = readiness.find((item) => item.moduleId === "ai_actuary");
  assert.equal(aiActuary?.status, "missing_required_env");
  assert.deepEqual(aiActuary?.missingRequiredEnv, ["AI_ACTUARY_PROJECT_PATH"]);

  const exampleReporter = readiness.find(
    (item) => item.moduleId === "example_reporter",
  );
  assert.equal(exampleReporter?.status, "missing_required_env");
  assert.deepEqual(exampleReporter?.missingRequiredEnv, [
    "EXAMPLE_REPORTER_ENABLED",
  ]);
});

test("treats blank env values as missing", () => {
  const readiness = listAdapterReadiness(
    {
      RAG_TO_AGENT_API_BASE_URL: "   ",
    },
    { pathExists: () => false },
  );

  const ragToAgent = readiness.find((item) => item.moduleId === "rag_to_agent");
  assert.equal(ragToAgent?.configured, false);
  assert.equal(ragToAgent?.status, "missing_required_env");
  assert.deepEqual(ragToAgent?.missingRequiredEnv, [
    "RAG_TO_AGENT_API_BASE_URL",
  ]);
});

test("reports readiness for a single adapter with copied arrays", () => {
  const definition = getAdapterDefinition("web_listening");
  const readiness = getAdapterReadiness(definition, {
    WEB_LISTENING_CLI_PATH: "C:\\tools\\web-listening.exe",
    WEB_LISTENING_WORKDIR: "C:\\workspace\\web-listening",
    WEB_LISTENING_API_BASE_URL: "   ",
  });

  assert.equal(readiness.status, "ready");
  assert.deepEqual(readiness.requiredEnv, ["WEB_LISTENING_CLI_PATH"]);
  assert.deepEqual(readiness.configuredOptionalEnv, [
    "WEB_LISTENING_WORKDIR",
  ]);
  assert.equal(JSON.stringify(readiness).includes("web-listening.exe"), false);
  assert.notEqual(readiness.requiredEnv, definition.requiredEnv);
  assert.notEqual(readiness.allowedCommands, definition.allowedCommands);
});

test("treats mcpServerEnv as required even when a definition omits it from requiredEnv", () => {
  const readiness = getAdapterReadiness(
    {
      adapterId: "test.mcp.v1",
      moduleId: "rag_to_agent",
      adapterKind: "mcp",
      displayName: "Test MCP",
      description: "Test MCP adapter.",
      sourceRepo: "https://example.com/test-mcp",
      requiredEnv: [],
      optionalEnv: [],
      timeoutMs: 1000,
      maxOutputBytes: 4096,
      allowedCommands: [],
      supportsResume: false,
      readinessHint: "Set TEST_MCP_SERVER_URL.",
      mcpServerEnv: "TEST_MCP_SERVER_URL",
      mcpToolName: "test.tool",
    },
    {},
  );

  assert.equal(readiness.status, "missing_required_env");
  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.requiredEnv, ["TEST_MCP_SERVER_URL"]);
  assert.deepEqual(readiness.missingRequiredEnv, ["TEST_MCP_SERVER_URL"]);
});

test("does not duplicate mcpServerEnv when an MCP definition already requires it", () => {
  const readiness = getAdapterReadiness(
    {
      adapterId: "test.mcp.v1",
      moduleId: "rag_to_agent",
      adapterKind: "mcp",
      displayName: "Test MCP",
      description: "Test MCP adapter.",
      sourceRepo: "https://example.com/test-mcp",
      requiredEnv: ["TEST_MCP_SERVER_URL"],
      optionalEnv: [],
      timeoutMs: 1000,
      maxOutputBytes: 4096,
      allowedCommands: [],
      supportsResume: false,
      readinessHint: "Set TEST_MCP_SERVER_URL.",
      mcpServerEnv: "TEST_MCP_SERVER_URL",
      mcpToolName: "test.tool",
    },
    { TEST_MCP_SERVER_URL: "http://127.0.0.1:7331/mcp" },
  );

  assert.equal(readiness.status, "ready");
  assert.deepEqual(readiness.requiredEnv, ["TEST_MCP_SERVER_URL"]);
  assert.deepEqual(readiness.missingRequiredEnv, []);
});

test("uses the climate monitor sibling fallback for adapter readiness", () => {
  const definition = getAdapterDefinition("climate_monitor");
  const cwd = resolve("workspace", "ai_interface", "artifacts", "api-server");
  const readyScript = resolve(
    "workspace",
    "climate_monitor_wiki",
    "scripts",
    "run_climate_monitor.py",
  );
  const projectPath = resolve("workspace", "climate_monitor_wiki");
  const readiness = getAdapterReadiness(
    definition,
    {},
    {
      cwd,
      pathExists: (path) => path === projectPath || path === readyScript,
    },
  );

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.configured, true);
  assert.deepEqual(readiness.missingRequiredEnv, []);
  assert.deepEqual(readiness.projectFallback, {
    defaultSiblingPath: "../climate_monitor_wiki",
    envPath: "CLIMATE_MONITOR_PROJECT_PATH",
    requiredPaths: ["scripts/run_climate_monitor.py"],
  });
});

test("uses the ai_actuary sibling fallback for adapter readiness", () => {
  const definition = getAdapterDefinition("ai_actuary");
  const cwd = resolve("workspace", "ai_interface", "artifacts", "api-server");
  const readyScript = resolve(
    "workspace",
    "ai_actuary",
    "scripts",
    "run_tool_pipeline.py",
  );
  const projectPath = resolve("workspace", "ai_actuary");
  const readiness = getAdapterReadiness(
    definition,
    {},
    {
      cwd,
      pathExists: (path) => path === projectPath || path === readyScript,
    },
  );

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.configured, true);
  assert.deepEqual(readiness.missingRequiredEnv, []);
  assert.deepEqual(readiness.projectFallback, {
    defaultSiblingPath: "../ai_actuary",
    envPath: "AI_ACTUARY_PROJECT_PATH",
    requiredPaths: ["scripts/run_tool_pipeline.py"],
  });
});

test("project fallback only satisfies the project env missing requirement", () => {
  const cwd = resolve("workspace", "ai_interface", "artifacts", "api-server");
  const readyScript = resolve(
    "workspace",
    "custom_project_tool",
    "scripts",
    "run_tool.py",
  );
  const projectPath = resolve("workspace", "custom_project_tool");
  const readiness = getAdapterReadiness(
    {
      adapterId: "custom_project_tool.cli.v1",
      moduleId: "custom_project_tool",
      adapterKind: "cli",
      displayName: "Custom Project Tool",
      description: "Custom project tool.",
      sourceRepo: "https://example.com/custom-project-tool",
      requiredEnv: ["CUSTOM_PROJECT_TOOL_PATH", "CUSTOM_PROJECT_TOOL_CLI"],
      optionalEnv: [],
      timeoutMs: 1000,
      maxOutputBytes: 4096,
      allowedCommands: ["scripts/run_tool.py"],
      supportsResume: false,
      readinessHint: "Configure custom project tool.",
      projectFallback: {
        defaultSiblingPath: "../custom_project_tool",
        envPath: "CUSTOM_PROJECT_TOOL_PATH",
        requiredPaths: ["scripts/run_tool.py"],
      },
    },
    {},
    {
      cwd,
      pathExists: (path) => path === projectPath || path === readyScript,
    },
  );

  assert.equal(readiness.status, "missing_required_env");
  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missingRequiredEnv, ["CUSTOM_PROJECT_TOOL_CLI"]);
});

test("project fallback can satisfy project env from an existing root without required paths", () => {
  const cwd = resolve("workspace", "ai_interface", "artifacts", "api-server");
  const projectPath = resolve("workspace", "custom_project_tool");
  const readiness = getAdapterReadiness(
    {
      adapterId: "custom_project_tool.cli.v1",
      moduleId: "custom_project_tool",
      adapterKind: "cli",
      displayName: "Custom Project Tool",
      description: "Custom project tool.",
      sourceRepo: "https://example.com/custom-project-tool",
      requiredEnv: ["CUSTOM_PROJECT_TOOL_PATH"],
      optionalEnv: [],
      timeoutMs: 1000,
      maxOutputBytes: 4096,
      allowedCommands: ["scripts/run_tool.py"],
      supportsResume: false,
      readinessHint: "Configure custom project tool.",
      projectFallback: {
        defaultSiblingPath: "../custom_project_tool",
        envPath: "CUSTOM_PROJECT_TOOL_PATH",
        requiredPaths: [],
      },
    },
    {},
    {
      cwd,
      pathExists: (path) => path === projectPath,
    },
  );

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.configured, true);
  assert.deepEqual(readiness.missingRequiredEnv, []);
});

test("throws for unknown adapter module ids", () => {
  assert.throws(
    () => getAdapterDefinition("unknown" as never),
    /Adapter is not registered: unknown/,
  );
});
