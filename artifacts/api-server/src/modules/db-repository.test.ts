import assert from "node:assert/strict";
import test from "node:test";

import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";

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
      kind: "internal",
      adapterId: "custom_reporter.internal.v1",
      requiredEnv: [],
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
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  };
}

test("catalog definition resolution can use an injected custom registry", async () => {
  process.env["DATABASE_URL"] ??= "postgres://test:test@127.0.0.1:1/test";
  const { resolveModuleCatalogDefinition } = await import("./db-repository");
  const registry = createSkillRuntimeRegistry([customReporterManifest()]);

  assert.deepEqual(
    resolveModuleCatalogDefinition("custom_reporter", registry),
    {
      moduleId: "custom_reporter",
      displayName: "Custom Reporter",
      description: "Create custom reports from artifacts.",
      category: "agent",
      resultKinds: ["custom_report"],
    },
  );
});

test("catalog upsert helper writes custom manifest-derived definitions", async () => {
  process.env["DATABASE_URL"] ??= "postgres://test:test@127.0.0.1:1/test";
  const { ensureModuleCatalogWithWriter } = await import("./db-repository");
  const registry = createSkillRuntimeRegistry([customReporterManifest()]);
  const written: unknown[] = [];

  await ensureModuleCatalogWithWriter("custom_reporter", registry, async (definition) => {
    written.push(definition);
  });

  assert.deepEqual(written, [
    {
      moduleId: "custom_reporter",
      displayName: "Custom Reporter",
      description: "Create custom reports from artifacts.",
      category: "agent",
      resultKinds: ["custom_report"],
    },
  ]);
});
