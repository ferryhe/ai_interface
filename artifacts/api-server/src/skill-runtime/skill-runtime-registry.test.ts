import assert from "node:assert/strict";
import test from "node:test";

import { businessSkillDefinitions } from "../agent-runtime/skill-registry";
import {
  createSkillRuntimeRegistry,
  defaultSkillRuntimeRegistry,
} from "./skill-runtime-registry";
import type { SkillManifest } from "./skill-manifest";

function customReporterManifest(): SkillManifest {
  return {
    skillId: "custom_reporter",
    moduleId: "custom_reporter",
    name: "Custom Reporter",
    title: "Custom Reporter Pro",
    description: "Create custom reports from artifacts.",
    category: "agent",
    project: {
      source: "external",
      defaultSiblingPath: "../custom_reporter",
      repoUrl: "https://example.com/custom-reporter",
    },
    execution: {
      kind: "http",
      adapterId: "custom_reporter.http.v1",
      requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      optionalEnv: ["CUSTOM_REPORTER_API_TOKEN"],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: [],
      supportsResume: true,
      readinessHint: "Set CUSTOM_REPORTER_API_BASE_URL to enable reports.",
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    interactionKinds: ["question"],
    artifactKinds: ["custom_report"],
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

test("default runtime registry exposes the built-in skills in order", () => {
  const registry = createSkillRuntimeRegistry();

  assert.deepEqual(registry.listSkillIds(), [
    "web_listening",
    "doc_to_md",
    "md_to_rag",
    "rag_to_agent",
    "climate_monitor",
  ]);
});

test("legacy business skill export is backed by the default runtime registry", () => {
  assert.deepEqual(
    businessSkillDefinitions,
    defaultSkillRuntimeRegistry.listBusinessSkillDefinitions(),
  );
});

test("runtime registry derives module, adapter, and business skill definitions from a custom manifest", () => {
  const registry = createSkillRuntimeRegistry([customReporterManifest()]);

  assert.deepEqual(registry.listSkillIds(), ["custom_reporter"]);
  assert.equal(registry.hasSkill("custom_reporter"), true);
  assert.equal(registry.getSkill("missing"), null);
  assert.deepEqual(registry.listModuleDefinitions(), [
    {
      moduleId: "custom_reporter",
      displayName: "Custom Reporter Pro",
      description: "Create custom reports from artifacts.",
      category: "agent",
      resultKinds: ["custom_report"],
    },
  ]);
  assert.equal(registry.isKnownModuleId("custom_reporter"), true);

  const adapter = registry.getAdapterDefinition("custom_reporter");
  assert.equal(adapter.adapterId, "custom_reporter.http.v1");
  assert.equal(adapter.adapterKind, "http");
  assert.equal(adapter.displayName, "Custom Reporter Pro Adapter");
  assert.deepEqual(adapter.requiredEnv, ["CUSTOM_REPORTER_API_BASE_URL"]);
  assert.equal(adapter.supportsResume, true);

  const businessSkill =
    registry.getBusinessSkillDefinition("custom_reporter");
  assert.equal(businessSkill.skillId, "custom_reporter");
  assert.equal(businessSkill.displayName, "Custom Reporter Pro");
  assert.equal(businessSkill.adapter.adapterId, "custom_reporter.http.v1");
  assert.equal(businessSkill.adapterMode, "external_api");
  assert.deepEqual(businessSkill.outputContracts, ["custom_report"]);
});
