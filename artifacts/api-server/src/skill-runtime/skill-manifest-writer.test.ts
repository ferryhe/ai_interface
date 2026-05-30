import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { SkillManifest } from "./skill-manifest";
import {
  formatSkillManifestYaml,
  writeSkillManifest,
} from "./skill-manifest-writer";

async function createRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "skill-writer-"));
}

function manifest(skillId = "my_skill"): SkillManifest {
  return {
    skillId,
    moduleId: "my_skill_module",
    name: "My Skill",
    description: "Custom skill created in a test.",
    category: "agent",
    project: {
      source: "custom",
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
      openOnTrigger: false,
      preferredRenderer: "markdown",
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: false,
    },
  };
}

test("writes skills/custom/<skillId>/skill.yaml for a custom skill", async () => {
  const cwd = await createRoot();
  const { skillId: _skillId, project, ...rest } = manifest();

  const result = await writeSkillManifest({
    cwd,
    skillId: "my_skill",
    manifest: {
      ...rest,
      project: { ...project },
    },
  });

  const expectedPath = join(cwd, "skills", "custom", "my_skill", "skill.yaml");
  const content = await readFile(expectedPath, "utf8");

  assert.equal(result.path, expectedPath);
  assert.equal(result.manifest.skillId, "my_skill");
  assert.equal(result.manifest.project.source, "custom");
  assert.match(content, /^skillId: my_skill/m);
  assert.match(content, /^  source: custom/m);
});

test("rejects writes that target built-in skill IDs", async () => {
  const cwd = await createRoot();
  const builtinDir = join(cwd, "skills", "builtin", "my_skill");
  await mkdir(builtinDir, { recursive: true });
  await writeFile(
    join(builtinDir, "skill.yaml"),
    formatSkillManifestYaml({ ...manifest("my_skill"), project: { source: "builtin", defaultSiblingPath: "../builtin_project" } }),
    "utf8",
  );

  await assert.rejects(
    writeSkillManifest({
      cwd,
      skillId: "my_skill",
      manifest: manifest("my_skill"),
      overwrite: true,
    }),
    /Refusing to override built-in skill manifest/,
  );
});

test("rejects writes that target community skill IDs", async () => {
  const cwd = await createRoot();
  const communityDir = join(cwd, "skills", "community", "my_skill");
  await mkdir(communityDir, { recursive: true });
  await writeFile(
    join(communityDir, "skill.yaml"),
    formatSkillManifestYaml({
      ...manifest("my_skill"),
      project: { source: "community", defaultSiblingPath: "../community_project" },
    }),
    "utf8",
  );

  await assert.rejects(
    writeSkillManifest({
      cwd,
      skillId: "my_skill",
      manifest: manifest("my_skill"),
      overwrite: true,
    }),
    /Refusing to override community skill manifest/,
  );
});

test("rejects traversal-like skill IDs", async () => {
  const cwd = await createRoot();

  await assert.rejects(
    writeSkillManifest({
      cwd,
      skillId: "../escape",
      manifest: manifest("my_skill"),
    }),
    /Invalid skillId/,
  );

  await assert.rejects(
    writeSkillManifest({
      cwd,
      skillId: "/escape",
      manifest: manifest("my_skill"),
    }),
    /Invalid skillId/,
  );
});
