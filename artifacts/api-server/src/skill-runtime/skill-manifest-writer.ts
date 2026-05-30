import { constants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { stringify } from "yaml";

import { loadSkillManifests } from "./skill-loader";
import type { SkillManifest, SkillProjectMetadata } from "./skill-manifest";

export const SKILL_ID_PATTERN = /^(?!\.\.?$)(?!.*(?:^|[\\/])\.\.(?:$|[\\/]))(?![A-Za-z]:[\\/])(?![\\/])[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;

type WritableSkillProjectMetadata = Omit<SkillProjectMetadata, "source"> &
  Partial<Pick<SkillProjectMetadata, "source">>;

export type WritableSkillManifest = Omit<SkillManifest, "skillId" | "project"> &
  Partial<Pick<SkillManifest, "skillId">> & {
    project: WritableSkillProjectMetadata;
  };

export interface WriteSkillManifestInput {
  skillId: string;
  manifest: WritableSkillManifest;
  overwrite?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface WriteSkillManifestResult {
  manifest: SkillManifest;
  path: string;
}

function assertWritableSkillId(skillId: string): void {
  if (!SKILL_ID_PATTERN.test(skillId)) {
    throw new Error(`Invalid skillId: ${skillId}`);
  }
}

function toCustomManifest(
  skillId: string,
  manifest: WritableSkillManifest,
): SkillManifest {
  if (manifest.skillId !== undefined && manifest.skillId !== skillId) {
    throw new Error(
      `manifest.skillId must match skillId: ${manifest.skillId} !== ${skillId}`,
    );
  }
  if (manifest.project.source !== undefined && manifest.project.source !== "custom") {
    throw new Error("Only custom skill manifests can be written");
  }

  return {
    ...manifest,
    skillId,
    project: {
      ...manifest.project,
      source: "custom",
    },
  };
}

export function formatSkillManifestYaml(manifest: SkillManifest): string {
  return stringify(manifest, { lineWidth: 0 });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function defaultCwd(startCwd: string): Promise<string> {
  let current = resolve(startCwd);
  while (true) {
    if (await pathExists(join(current, "skills", "builtin"))) return current;
    const parent = resolve(current, "..");
    if (parent === current) return resolve(startCwd);
    current = parent;
  }
}

function assertInside(parent: string, child: string, message: string): void {
  const childRelative = relative(parent, child);
  if (
    childRelative === "" ||
    childRelative.startsWith(`..${sep}`) ||
    childRelative === ".." ||
    isAbsolute(childRelative)
  ) {
    throw new Error(message);
  }
}

async function assertNoSymlinkedCustomPath(
  cwd: string,
  customRoot: string,
  skillDir: string,
): Promise<void> {
  const realCwd = await realpath(cwd);
  const expectedRealCustomRoot = resolve(realCwd, "skills", "custom");
  const pathsToCheck = [resolve(cwd, "skills"), customRoot, skillDir];

  for (const path of pathsToCheck) {
    try {
      const stats = await lstat(path);
      if (stats.isSymbolicLink()) {
        throw new Error(
          `Refusing to write through symlinked or redirected skills/custom path: ${path}`,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }

  if (await pathExists(customRoot)) {
    const realCustomRoot = await realpath(customRoot);
    if (realCustomRoot !== expectedRealCustomRoot) {
      throw new Error(
        `Refusing to write through symlinked or redirected skills/custom path: ${customRoot}`,
      );
    }
  }

  if (await pathExists(skillDir)) {
    const realSkillDir = await realpath(skillDir);
    assertInside(
      expectedRealCustomRoot,
      realSkillDir,
      `Refusing to write outside skills/custom: ${skillDir}`,
    );
  }
}

async function assertManifestPathNotSymlink(manifestPath: string): Promise<void> {
  try {
    const stats = await lstat(manifestPath);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Refusing to overwrite symlinked skill manifest: ${manifestPath}`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

async function validateManifestBeforeFinalWrite(
  skillId: string,
  manifest: SkillManifest,
): Promise<SkillManifest> {
  const tempRoot = await mkdtemp(join(tmpdir(), "skill-manifest-validate-"));
  try {
    const customRoot = join(tempRoot, "skills", "custom");
    const skillDir = join(customRoot, skillId);
    const manifestPath = join(skillDir, "skill.yaml");
    await mkdir(skillDir, { recursive: true });
    await writeFile(manifestPath, formatSkillManifestYaml(manifest), {
      encoding: "utf8",
      flag: "wx",
    });

    const manifests = await loadSkillManifests({
      cwd: tempRoot,
      roots: [customRoot],
    });
    const normalized =
      manifests.find((candidate) => candidate.skillId === skillId) ?? null;
    if (!normalized) {
      throw new Error(`Failed to validate skill manifest: ${skillId}`);
    }
    return normalized;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function assertProtectedSkillIdWriteAllowed(
  cwd: string,
  skillId: string,
  env: Record<string, string | undefined>,
): Promise<void> {
  let protectedManifests: SkillManifest[];
  try {
    protectedManifests = await loadSkillManifests({
      cwd,
      roots: [join("skills", "builtin"), join("skills", "community")],
      env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("No skill manifests found under root(s):")) {
      return;
    }
    throw error;
  }
  const existing =
    protectedManifests.find((candidate) => candidate.skillId === skillId) ?? null;
  if (!existing) return;

  if (existing.project.source === "builtin") {
    throw new Error(`Refusing to override built-in skill manifest: ${skillId}`);
  }

  throw new Error(`Refusing to override community skill manifest: ${skillId}`);
}

export async function writeSkillManifest(
  input: WriteSkillManifestInput,
): Promise<WriteSkillManifestResult> {
  const cwd =
    input.cwd === undefined
      ? await defaultCwd(process.cwd())
      : resolve(input.cwd);
  const env = input.env ?? process.env;
  assertWritableSkillId(input.skillId);

  const customRoot = resolve(cwd, "skills", "custom");
  const skillDir = resolve(customRoot, input.skillId);
  const manifestPath = resolve(skillDir, "skill.yaml");
  const expectedManifestPath = join(customRoot, input.skillId, "skill.yaml");
  if (manifestPath !== expectedManifestPath) {
    throw new Error(`Refusing to write outside skills/custom: ${manifestPath}`);
  }

  const manifest = toCustomManifest(input.skillId, input.manifest);
  const normalizedManifest = await validateManifestBeforeFinalWrite(
    input.skillId,
    manifest,
  );

  await assertProtectedSkillIdWriteAllowed(cwd, input.skillId, env);
  await assertNoSymlinkedCustomPath(cwd, customRoot, skillDir);
  if ((await pathExists(manifestPath)) && input.overwrite !== true) {
    throw new Error(`Skill manifest already exists: ${manifestPath}`);
  }

  await mkdir(skillDir, { recursive: true });
  await assertNoSymlinkedCustomPath(cwd, customRoot, skillDir);
  await assertManifestPathNotSymlink(manifestPath);
  await writeFile(manifestPath, formatSkillManifestYaml(normalizedManifest), {
    encoding: "utf8",
    flag: input.overwrite === true ? "w" : "wx",
  });

  const normalized = await loadSkillManifests({
    cwd,
    roots: [customRoot],
  });
  const written =
    normalized.find((candidate) => candidate.skillId === input.skillId) ?? null;
  if (!written) {
    throw new Error(`Failed to reload written skill manifest: ${manifestPath}`);
  }

  return {
    manifest: written,
    path: manifestPath,
  };
}
