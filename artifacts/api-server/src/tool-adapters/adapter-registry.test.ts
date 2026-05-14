import assert from "node:assert/strict";
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
});

test("reports missing required env without exposing env values", () => {
  const readiness = listAdapterReadiness({
    DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
    DOC_TO_MD_API_TOKEN: "secret-token",
  });

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
});

test("treats blank env values as missing", () => {
  const readiness = listAdapterReadiness({
    RAG_TO_AGENT_API_BASE_URL: "   ",
  });

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

test("throws for unknown adapter module ids", () => {
  assert.throws(
    () => getAdapterDefinition("unknown" as never),
    /Adapter is not registered: unknown/,
  );
});
