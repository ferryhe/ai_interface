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
  "example_reporter",
];

interface MinimalManifestOptions {
  skillId?: string;
  moduleId?: string;
  executionKind?: string;
  projectSource?: string;
  name?: string;
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
execution:
  kind: ${options.executionKind ?? "cli"}
  adapterId: fixture.cli.v1
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
  assert.equal(manifests.length, 6);
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
  assert.deepEqual(manifest?.execution.optionalEnv, []);
  assert.deepEqual(manifest?.execution.allowedCommands, []);
  assert.equal(manifest?.execution.supportsResume, false);
  assert.equal(manifest?.permissions.approvalRequired, false);
  assert.equal(manifest?.permissions.canUseNetwork, false);
  assert.equal(manifest?.permissions.canWriteDatabase, true);
  assert.deepEqual(manifest?.interactionKinds, []);
  assert.deepEqual(manifest?.artifactKinds, []);
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
