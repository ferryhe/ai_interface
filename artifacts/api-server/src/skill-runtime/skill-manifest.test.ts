import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  builtinSkillManifests,
  createSkillManifestRegistry,
  listSkillReadiness,
  manifestAdapterDefinition,
  type SkillManifest,
} from "./skill-manifest";

function customProjectCliManifest(
  overrides: Partial<SkillManifest> = {},
): SkillManifest {
  return {
    skillId: "community_tool",
    moduleId: "community_tool",
    name: "Community Tool",
    description: "Community CLI tool.",
    category: "agent",
    project: {
      source: "community",
      envPath: "COMMUNITY_TOOL_PROJECT_PATH",
      defaultSiblingPath: "../community_tool",
      readiness: {
        requiredPaths: ["bin/community-tool"],
      },
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    artifactKinds: ["json"],
    interactionKinds: [],
    execution: {
      kind: "cli",
      adapterId: "community_tool.cli.v1",
      supportsResume: false,
      timeoutMs: 30000,
      maxOutputBytes: 65536,
      requiredEnv: ["COMMUNITY_TOOL_PROJECT_PATH"],
      optionalEnv: [],
      allowedCommands: ["bin/community-tool"],
    },
    ui: {
      mode: "auto",
      preferredRenderer: "json",
      openOnTrigger: false,
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
    ...overrides,
  };
}

test("default skill manifests map built-in and community project skills", () => {
  assert.deepEqual(
    builtinSkillManifests.map((skill) => [
      skill.skillId,
      skill.project.defaultSiblingPath,
    ]),
    [
      ["web_listening", "../web_listening"],
      ["doc_to_md", "../doc_to_md"],
      ["md_to_rag", "../c-ross-2"],
      ["rag_to_agent", "../c-ross-2"],
      ["climate_monitor", "../climate_monitor_wiki"],
      ["ai_actuary", "../ai_actuary"],
      ["example_reporter", "skills/community/example_reporter"],
    ],
  );

  const docToMd = builtinSkillManifests.find(
    (skill) => skill.skillId === "doc_to_md",
  );
  assert.equal(docToMd?.execution.kind, "http");
  assert.equal(docToMd?.ui.preferredRenderer, "markdown");
  assert.deepEqual(docToMd?.interactionKinds, ["question", "data_request"]);

  const climateMonitor = builtinSkillManifests.find(
    (skill) => skill.skillId === "climate_monitor",
  );
  assert.equal(climateMonitor?.project.envPath, "CLIMATE_MONITOR_PROJECT_PATH");
  assert.deepEqual(climateMonitor?.project.readiness?.requiredPaths, [
    "scripts/run_climate_monitor.py",
  ]);
  assert.equal(climateMonitor?.execution.adapterId, "climate_monitor.cli.v1");
  assert.deepEqual(climateMonitor?.artifactKinds, [
    "climate_monitor_report",
    "climate_monitor_run_json",
    "climate_monitor_scope_status",
  ]);
  assert.equal(climateMonitor?.permissions.approvalRequired, true);
  assert.equal(climateMonitor?.permissions.canUseNetwork, true);

  const aiActuary = builtinSkillManifests.find(
    (skill) => skill.skillId === "ai_actuary",
  );
  assert.equal(aiActuary?.project.envPath, "AI_ACTUARY_PROJECT_PATH");
  assert.deepEqual(aiActuary?.project.readiness?.requiredPaths, [
    "scripts/run_tool_pipeline.py",
  ]);
  assert.equal(aiActuary?.execution.adapterId, "ai_actuary.cli.v1");
  assert.deepEqual(aiActuary?.execution.command, [
    "python",
    "scripts/run_tool_pipeline.py",
    "--json",
  ]);
  assert.equal(aiActuary?.execution.workingDirectory, "project");
  assert.deepEqual(aiActuary?.inputSchema["anyOf"], [
    { required: ["args"] },
    { required: ["pipeline", "input"] },
  ]);
  assert.deepEqual(aiActuary?.outputSchema["required"], ["ok", "status"]);
  assert.deepEqual(aiActuary?.artifactKinds.slice(0, 3), [
    "case_input",
    "deterministic_result",
    "narrative_draft",
  ]);
});

test("manifest adapter fallback is derived from project readiness metadata", () => {
  const manifest = customProjectCliManifest();

  assert.deepEqual(manifestAdapterDefinition(manifest).projectFallback, {
    defaultSiblingPath: "../community_tool",
    envPath: "COMMUNITY_TOOL_PROJECT_PATH",
    requiredPaths: ["bin/community-tool"],
  });
});

test("manifest adapter fallback can use project root readiness without required paths", () => {
  const manifest = customProjectCliManifest({
    project: {
      source: "community",
      envPath: "COMMUNITY_TOOL_PROJECT_PATH",
      defaultSiblingPath: "../community_tool",
    },
  });

  assert.deepEqual(manifestAdapterDefinition(manifest).projectFallback, {
    defaultSiblingPath: "../community_tool",
    envPath: "COMMUNITY_TOOL_PROJECT_PATH",
    requiredPaths: [],
  });
});

test("manifest adapter fallback is emitted for root-only projects without env path", () => {
  const manifest = customProjectCliManifest({
    project: {
      source: "community",
      defaultSiblingPath: "../community_tool",
    },
    execution: {
      ...customProjectCliManifest().execution,
      requiredEnv: [],
    },
  });

  assert.deepEqual(manifestAdapterDefinition(manifest).projectFallback, {
    defaultSiblingPath: "../community_tool",
    envPath: undefined,
    requiredPaths: [],
  });
});

test("skill manifest registry accepts registered custom skills", () => {
  const registry = createSkillManifestRegistry([
    {
      skillId: "custom_reporter",
      moduleId: "custom_reporter",
      name: "Custom Reporter",
      description: "Create a custom report from existing artifacts.",
      category: "agent",
      project: {
        source: "external",
        defaultSiblingPath: "../custom_reporter",
        readiness: {
          requiredPaths: [],
        },
      },
      inputSchema: { type: "object", properties: { topic: { type: "string" } } },
      outputSchema: { type: "object", properties: { report: { type: "string" } } },
      artifactKinds: ["report_markdown"],
      interactionKinds: ["question"],
      execution: {
        kind: "internal",
        adapterId: "custom_reporter.internal.v1",
        supportsResume: false,
        timeoutMs: 30000,
        maxOutputBytes: 65536,
        requiredEnv: [],
        optionalEnv: [],
        allowedCommands: [],
      },
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
    },
  ]);

  assert.equal(registry.hasSkill("custom_reporter"), true);
  assert.equal(registry.getSkill("custom_reporter")?.name, "Custom Reporter");
  assert.equal(registry.listSkills().at(-1)?.skillId, "custom_reporter");
});

test("skill readiness reports missing project paths without leaking env values", () => {
  const registry = createSkillManifestRegistry([
    {
      skillId: "html_skill",
      moduleId: "html_skill",
      name: "HTML Skill",
      description: "Skill with a Backstage HTML UI.",
      category: "transform",
      project: {
        source: "external",
        envPath: "HTML_SKILL_PATH",
        defaultSiblingPath: "../missing-html-skill",
        readiness: {
          requiredPaths: [],
        },
      },
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      artifactKinds: ["json"],
      interactionKinds: ["approval"],
      execution: {
        kind: "http",
        adapterId: "html_skill.http.v1",
        supportsResume: true,
        timeoutMs: 30000,
        maxOutputBytes: 65536,
        requiredEnv: ["HTML_SKILL_SECRET"],
        optionalEnv: [],
        allowedCommands: [],
      },
      ui: {
        mode: "html",
        htmlEntrypoint: "/skill-ui",
        preferredRenderer: "json",
        openOnTrigger: true,
      },
      permissions: {
        approvalRequired: true,
        canUseNetwork: false,
        canWriteDatabase: true,
      },
    },
  ]);

  const readiness = listSkillReadiness(registry, {
    env: {
      HTML_SKILL_PATH: "C:/very/secret/local/path",
      HTML_SKILL_SECRET: "do-not-leak",
    },
    pathExists: () => false,
  }).find((item) => item.skillId === "html_skill");

  assert.equal(readiness?.project.status, "not_configured");
  assert.equal(readiness?.project.configuredBy, "HTML_SKILL_PATH");
  assert.equal(JSON.stringify(readiness).includes("do-not-leak"), false);
  assert.equal(
    JSON.stringify(readiness).includes("C:/very/secret/local/path"),
    false,
  );
});

test("community manifest readiness uses required paths for project fallback", () => {
  const registry = createSkillManifestRegistry([customProjectCliManifest()]);
  const cwd = resolve("workspace", "ai_interface", "artifacts", "api-server");
  const projectPath = resolve("workspace", "community_tool");
  const readyScript = resolve(projectPath, "bin", "community-tool");

  const missingRequiredFile = listSkillReadiness(registry, {
    env: {},
    cwd,
    pathExists: (path) => path === projectPath,
  }).find((item) => item.skillId === "community_tool");

  assert.equal(missingRequiredFile?.project.status, "not_configured");
  assert.equal(missingRequiredFile?.adapter.status, "missing_required_env");
  assert.deepEqual(missingRequiredFile?.adapter.missingRequiredEnv, [
    "COMMUNITY_TOOL_PROJECT_PATH",
  ]);

  const ready = listSkillReadiness(registry, {
    env: {},
    cwd,
    pathExists: (path) => path === projectPath || path === readyScript,
  }).find((item) => item.skillId === "community_tool");

  assert.equal(ready?.project.status, "ready");
  assert.equal(ready?.project.configuredBy, "defaultSiblingPath");
  assert.equal(ready?.adapter.status, "ready");
  assert.deepEqual(ready?.adapter.missingRequiredEnv, []);
});

test("community manifest project fallback can use an existing project root without required paths", () => {
  const registry = createSkillManifestRegistry([
    customProjectCliManifest({
      project: {
        source: "community",
        envPath: "COMMUNITY_TOOL_PROJECT_PATH",
        defaultSiblingPath: "../community_tool",
      },
    }),
  ]);
  const cwd = resolve("workspace", "ai_interface", "artifacts", "api-server");
  const projectPath = resolve("workspace", "community_tool");

  const readiness = listSkillReadiness(registry, {
    env: {},
    cwd,
    pathExists: (path) => path === projectPath,
  }).find((item) => item.skillId === "community_tool");

  assert.equal(readiness?.project.status, "ready");
  assert.equal(readiness?.adapter.status, "ready");
  assert.deepEqual(readiness?.adapter.missingRequiredEnv, []);
});

test("climate skill adapter readiness accepts the default sibling project", () => {
  const registry = createSkillManifestRegistry();
  const cwd = resolve("workspace", "ai_interface", "artifacts", "api-server");
  const climateProject = resolve("workspace", "climate_monitor_wiki");
  const readyScript = resolve(
    climateProject,
    "scripts",
    "run_climate_monitor.py",
  );

  const readiness = listSkillReadiness(registry, {
    env: {},
    cwd,
    pathExists: (path) => path === climateProject || path === readyScript,
  }).find((item) => item.skillId === "climate_monitor");

  assert.equal(readiness?.project.status, "ready");
  assert.equal(readiness?.project.configuredBy, "defaultSiblingPath");
  assert.equal(readiness?.adapter.configured, true);
  assert.deepEqual(readiness?.adapter.missingRequiredEnv, []);
});
