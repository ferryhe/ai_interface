import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { loadSkillManifests } from "./skill-loader";

const defaultSkillIds = [
  "web_listening",
  "doc_to_md",
  "md_to_rag",
  "rag_to_agent",
  "climate_monitor",
  "ai_actuary",
  "example_reporter",
];

interface MinimalManifestOptions {
  skillId?: string;
  moduleId?: string;
  executionKind?: string;
  projectSource?: string;
  name?: string;
  extraProject?: string;
  extraExecution?: string;
}

const minimalManifest = (
  options: MinimalManifestOptions = {},
) => `skillId: ${options.skillId ?? "fixture_skill"}
moduleId: ${options.moduleId ?? "fixture_module"}
name: ${options.name ?? "Fixture Skill"}
description: Fixture manifest for loader tests.
category: source
project:
  source: ${options.projectSource ?? "builtin"}
  defaultSiblingPath: ../fixture
${options.extraProject ?? ""}
execution:
  kind: ${options.executionKind ?? "cli"}
  adapterId: fixture.cli.v1
${options.extraExecution ?? ""}
inputSchema:
  type: object
outputSchema:
  type: object
`;

async function createRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "skill-loader-"));
}

async function writeManifest(
  root: string,
  skillDir: string,
  content: string,
): Promise<string> {
  const manifestDir = join(root, skillDir);
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, "skill.yaml");
  await writeFile(manifestPath, content, "utf8");
  return manifestPath;
}

test("loads default YAML manifests in deterministic runtime order", async () => {
  const manifests = await loadSkillManifests();

  assert.deepEqual(
    manifests.map((manifest) => manifest.skillId),
    defaultSkillIds,
  );
  assert.equal(manifests.length, 7);
});

test("loads explicit roots in builtin, community, then custom source order", async () => {
  const root = await createRoot();
  const builtinRoot = join(root, "skills", "builtin");
  const communityRoot = join(root, "skills", "community");
  const customRoot = join(root, "skills", "custom");
  await writeManifest(
    customRoot,
    "local_reporter",
    minimalManifest({
      skillId: "local_reporter",
      moduleId: "local_reporter",
      projectSource: "custom",
    }),
  );
  await writeManifest(
    communityRoot,
    "community_reporter",
    minimalManifest({
      skillId: "community_reporter",
      moduleId: "community_reporter",
      projectSource: "community",
    }),
  );
  await writeManifest(
    builtinRoot,
    "builtin_fixture",
    minimalManifest({
      skillId: "builtin_fixture",
      moduleId: "builtin_fixture",
      projectSource: "builtin",
    }),
  );

  const manifests = await loadSkillManifests({ cwd: root });

  assert.deepEqual(
    manifests.map((manifest) => [
      manifest.skillId,
      manifest.project.source,
    ]),
    [
      ["builtin_fixture", "builtin"],
      ["community_reporter", "community"],
      ["local_reporter", "custom"],
    ],
  );
});

test("custom manifests override community manifests for local testing", async () => {
  const root = await createRoot();
  const communityRoot = join(root, "skills", "community");
  const customRoot = join(root, "skills", "custom");
  await writeManifest(
    communityRoot,
    "reporter",
    minimalManifest({
      skillId: "reporter",
      moduleId: "reporter",
      projectSource: "community",
      name: "Community Reporter",
    }),
  );
  await writeManifest(
    customRoot,
    "reporter",
    minimalManifest({
      skillId: "reporter",
      moduleId: "reporter",
      projectSource: "custom",
      name: "Custom Reporter",
    }),
  );

  const manifests = await loadSkillManifests({ cwd: root });

  assert.equal(manifests.length, 1);
  assert.equal(manifests[0]?.name, "Custom Reporter");
  assert.equal(manifests[0]?.project.source, "custom");
});

test("blocks community manifests from overriding builtin manifests", async () => {
  const root = await createRoot();
  const builtinRoot = join(root, "skills", "builtin");
  const communityRoot = join(root, "skills", "community");
  const builtinPath = await writeManifest(
    builtinRoot,
    "reporter",
    minimalManifest({
      skillId: "reporter",
      moduleId: "reporter",
      projectSource: "builtin",
    }),
  );
  const communityPath = await writeManifest(
    communityRoot,
    "reporter",
    minimalManifest({
      skillId: "reporter",
      moduleId: "reporter",
      projectSource: "community",
    }),
  );

  await assert.rejects(
    loadSkillManifests({ cwd: root }),
    (error) =>
      error instanceof Error &&
      error.message.includes("community cannot override builtin skillId reporter") &&
      error.message.includes(builtinPath) &&
      error.message.includes(communityPath),
  );
});

test("blocks custom manifests from overriding builtin manifests without opt-in", async () => {
  const root = await createRoot();
  const builtinRoot = join(root, "skills", "builtin");
  const customRoot = join(root, "skills", "custom");
  const builtinPath = await writeManifest(
    builtinRoot,
    "reporter",
    minimalManifest({
      skillId: "reporter",
      moduleId: "reporter",
      projectSource: "builtin",
    }),
  );
  const customPath = await writeManifest(
    customRoot,
    "reporter",
    minimalManifest({
      skillId: "reporter",
      moduleId: "reporter",
      projectSource: "custom",
    }),
  );

  await assert.rejects(
    loadSkillManifests({ cwd: root, env: {} }),
    (error) =>
      error instanceof Error &&
      error.message.includes("custom cannot override builtin skillId reporter") &&
      error.message.includes("AI_INTERFACE_ALLOW_BUILTIN_SKILL_OVERRIDE=1") &&
      error.message.includes(builtinPath) &&
      error.message.includes(customPath),
  );
});

test("rejects community-root manifests that declare a builtin source", async () => {
  const root = await createRoot();
  const communityRoot = join(root, "skills", "community");
  const manifestPath = await writeManifest(
    communityRoot,
    "misdeclared",
    minimalManifest({
      skillId: "misdeclared",
      moduleId: "misdeclared",
      projectSource: "builtin",
    }),
  );

  await assert.rejects(
    loadSkillManifests({ cwd: root }),
    (error) =>
      error instanceof Error &&
      error.message.includes("project.source mismatch") &&
      error.message.includes("expected community") &&
      error.message.includes("found builtin") &&
      error.message.includes(manifestPath),
  );
});

test("rejects custom-root manifests that declare community or builtin sources", async () => {
  for (const declaredSource of ["community", "builtin"]) {
    const root = await createRoot();
    const customRoot = join(root, "skills", "custom");
    const manifestPath = await writeManifest(
      customRoot,
      `misdeclared_${declaredSource}`,
      minimalManifest({
        skillId: `misdeclared_${declaredSource}`,
        moduleId: `misdeclared_${declaredSource}`,
        projectSource: declaredSource,
      }),
    );

    await assert.rejects(
      loadSkillManifests({ cwd: root }),
      (error) =>
        error instanceof Error &&
        error.message.includes("project.source mismatch") &&
        error.message.includes("expected custom") &&
        error.message.includes(`found ${declaredSource}`) &&
        error.message.includes(manifestPath),
    );
  }
});

test("rejects builtin-root manifests that declare community or custom sources", async () => {
  for (const declaredSource of ["community", "custom"]) {
    const root = await createRoot();
    const builtinRoot = join(root, "skills", "builtin");
    const manifestPath = await writeManifest(
      builtinRoot,
      `misdeclared_${declaredSource}`,
      minimalManifest({
        skillId: `misdeclared_${declaredSource}`,
        moduleId: `misdeclared_${declaredSource}`,
        projectSource: declaredSource,
      }),
    );

    await assert.rejects(
      loadSkillManifests({ cwd: root }),
      (error) =>
        error instanceof Error &&
        error.message.includes("project.source mismatch") &&
        error.message.includes("expected builtin") &&
        error.message.includes(`found ${declaredSource}`) &&
        error.message.includes(manifestPath),
    );
  }
});

test("default roots load built-in YAML manifests from an explicit repository root cwd", async () => {
  const manifests = await loadSkillManifests({
    cwd: resolve(process.cwd(), "../.."),
  });

  assert.deepEqual(
    manifests.map((manifest) => manifest.skillId),
    defaultSkillIds,
  );
});

test("default roots load built-in YAML manifests from an explicit api-server cwd", async () => {
  const manifests = await loadSkillManifests({ cwd: process.cwd() });

  assert.deepEqual(
    manifests.map((manifest) => manifest.skillId),
    defaultSkillIds,
  );
});

test("default roots fail clearly when no manifests are found", async () => {
  const cwd = await createRoot();
  const expectedRoot = join(cwd, "skills", "builtin");

  await assert.rejects(
    loadSkillManifests({ cwd }),
    (error) =>
      error instanceof Error &&
      error.message.includes("No skill manifests found") &&
      error.message.includes(expectedRoot),
  );
});

test("applies documented defaults to a minimal manifest", async () => {
  const root = await createRoot();
  await writeManifest(root, "fixture", minimalManifest());

  const [manifest] = await loadSkillManifests({ roots: [root] });

  assert.equal(manifest?.ui.mode, "auto");
  assert.equal(manifest?.ui.openOnTrigger, false);
  assert.equal(manifest?.ui.preferredRenderer, "json");
  assert.equal(manifest?.execution.timeoutMs, 120000);
  assert.equal(manifest?.execution.maxOutputBytes, 1048576);
  assert.deepEqual(manifest?.execution.requiredEnv, []);
  assert.deepEqual(manifest?.project.readiness?.requiredPaths, []);
  assert.deepEqual(manifest?.execution.optionalEnv, []);
  assert.deepEqual(manifest?.execution.allowedCommands, []);
  assert.equal(manifest?.execution.supportsResume, false);
  assert.equal(manifest?.permissions.approvalRequired, false);
  assert.equal(manifest?.permissions.canUseNetwork, false);
  assert.equal(manifest?.permissions.canWriteDatabase, true);
  assert.deepEqual(manifest?.interactionKinds, []);
  assert.deepEqual(manifest?.artifactKinds, []);
});

test("loads project readiness required paths from a manifest", async () => {
  const root = await createRoot();
  await writeManifest(
    root,
    "fixture",
    minimalManifest({
      extraProject:
        "  readiness:\n    requiredPaths:\n      - scripts/run_fixture.py\n      - config/default.yaml",
    }),
  );

  const [manifest] = await loadSkillManifests({ roots: [root] });

  assert.deepEqual(manifest?.project.readiness?.requiredPaths, [
    "scripts/run_fixture.py",
    "config/default.yaml",
  ]);
});

test("rejects absolute project readiness required paths", async () => {
  const root = await createRoot();
  const manifestPath = await writeManifest(
    root,
    "fixture",
    minimalManifest({
      extraProject:
        "  readiness:\n    requiredPaths:\n      - /opt/fixture/run.py",
    }),
  );

  await assert.rejects(
    loadSkillManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("project.readiness.requiredPaths") &&
      error.message.includes("relative paths") &&
      error.message.includes(manifestPath),
  );
});

test("rejects traversal project readiness required paths", async () => {
  const root = await createRoot();
  const manifestPath = await writeManifest(
    root,
    "fixture",
    minimalManifest({
      extraProject:
        "  readiness:\n    requiredPaths:\n      - scripts/../run_fixture.py",
    }),
  );

  await assert.rejects(
    loadSkillManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("project.readiness.requiredPaths") &&
      error.message.includes("relative paths") &&
      error.message.includes(manifestPath),
  );
});

test("loads MCP execution metadata from a manifest", async () => {
  const root = await createRoot();
  await writeManifest(
    root,
    "mcp_fixture",
    minimalManifest({
      executionKind: "mcp",
      extraExecution:
        "  mcpServerEnv: TEST_MCP_SERVER_URL\n  mcpToolName: test.tool",
    }),
  );

  const [manifest] = await loadSkillManifests({ roots: [root] });

  assert.equal(manifest?.execution.kind, "mcp");
  assert.equal(manifest?.execution.mcpServerEnv, "TEST_MCP_SERVER_URL");
  assert.equal(manifest?.execution.mcpToolName, "test.tool");
});

test("requires MCP manifests to declare mcpServerEnv", async () => {
  const root = await createRoot();
  const manifestPath = await writeManifest(
    root,
    "mcp_fixture",
    minimalManifest({
      executionKind: "mcp",
      extraExecution: "  mcpToolName: test.tool",
    }),
  );

  await assert.rejects(
    loadSkillManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Expected execution.mcpServerEnv") &&
      error.message.includes(manifestPath),
  );
});

test("requires MCP manifests to declare mcpToolName", async () => {
  const root = await createRoot();
  const manifestPath = await writeManifest(
    root,
    "mcp_fixture",
    minimalManifest({
      executionKind: "mcp",
      extraExecution: "  mcpServerEnv: TEST_MCP_SERVER_URL",
    }),
  );

  await assert.rejects(
    loadSkillManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Expected execution.mcpToolName") &&
      error.message.includes(manifestPath),
  );
});

test("adds mcpServerEnv to MCP manifest required env", async () => {
  const root = await createRoot();
  await writeManifest(
    root,
    "mcp_fixture",
    minimalManifest({
      executionKind: "mcp",
      extraExecution:
        "  requiredEnv:\n    - OTHER_REQUIRED_ENV\n  mcpServerEnv: TEST_MCP_SERVER_URL\n  mcpToolName: test.tool",
    }),
  );

  const [manifest] = await loadSkillManifests({ roots: [root] });

  assert.deepEqual(manifest?.execution.requiredEnv, [
    "OTHER_REQUIRED_ENV",
    "TEST_MCP_SERVER_URL",
  ]);
});

test("keeps explicit arbitrary root source declarations when no known root source can be inferred", async () => {
  const root = await createRoot();
  await writeManifest(
    root,
    "fixture",
    minimalManifest({
      projectSource: "custom",
    }),
  );

  const [manifest] = await loadSkillManifests({ roots: [root] });

  assert.equal(manifest?.project.source, "custom");
});

test("rejects duplicate skill IDs with the duplicate id and manifest paths", async () => {
  const root = await createRoot();
  const firstPath = await writeManifest(root, "first", minimalManifest());
  const secondPath = await writeManifest(
    root,
    "second",
    minimalManifest({ moduleId: "second_module" }),
  );

  await assert.rejects(
    loadSkillManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Duplicate skillId fixture_skill") &&
      error.message.includes(firstPath) &&
      error.message.includes(secondPath),
  );
});

test("rejects duplicate module IDs with the duplicate id and manifest paths", async () => {
  const root = await createRoot();
  const firstPath = await writeManifest(root, "first", minimalManifest());
  const secondPath = await writeManifest(
    root,
    "second",
    minimalManifest({ skillId: "second_skill" }),
  );

  await assert.rejects(
    loadSkillManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Duplicate moduleId fixture_module") &&
      error.message.includes(firstPath) &&
      error.message.includes(secondPath),
  );
});

test("rejects invalid execution kind with the manifest path", async () => {
  const root = await createRoot();
  const manifestPath = await writeManifest(
    root,
    "invalid",
    minimalManifest({ executionKind: "shell" }),
  );

  await assert.rejects(
    loadSkillManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Invalid execution.kind") &&
      error.message.includes(manifestPath),
  );
});
