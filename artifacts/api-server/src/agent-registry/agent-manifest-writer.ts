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

import { loadAgentManifests } from "./agent-loader";
import type { AgentManifest } from "./agent-manifest";
import { AGENT_ID_PATTERN } from "./agent-manifest";

export type WritableAgentManifest = Omit<
  AgentManifest,
  "agentId" | "source"
> &
  Partial<Pick<AgentManifest, "agentId" | "source">>;

export interface WriteAgentManifestInput {
  agentId: string;
  manifest: WritableAgentManifest;
  overwrite?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface WriteAgentManifestResult {
  manifest: AgentManifest;
  path: string;
}

function assertWritableAgentId(agentId: string): void {
  if (!AGENT_ID_PATTERN.test(agentId)) {
    throw new Error(`Invalid agentId: ${agentId}`);
  }
}

function toCustomManifest(
  agentId: string,
  manifest: WritableAgentManifest,
): AgentManifest {
  if (manifest.agentId !== undefined && manifest.agentId !== agentId) {
    throw new Error(
      `manifest.agentId must match agentId: ${manifest.agentId} !== ${agentId}`,
    );
  }
  if (manifest.source !== undefined && manifest.source !== "custom") {
    throw new Error("Only custom agent manifests can be written");
  }

  return {
    ...manifest,
    agentId,
    source: "custom",
  };
}

export function formatAgentManifestYaml(manifest: AgentManifest): string {
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
    if (await pathExists(join(current, "agents", "builtin"))) return current;
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
  agentDir: string,
): Promise<void> {
  const realCwd = await realpath(cwd);
  const expectedRealCustomRoot = resolve(realCwd, "agents", "custom");
  const pathsToCheck = [
    resolve(cwd, "agents"),
    customRoot,
    agentDir,
  ];

  for (const path of pathsToCheck) {
    try {
      const stats = await lstat(path);
      if (stats.isSymbolicLink()) {
        throw new Error(
          `Refusing to write through symlinked or redirected agents/custom path: ${path}`,
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
        `Refusing to write through symlinked or redirected agents/custom path: ${customRoot}`,
      );
    }
  }

  if (await pathExists(agentDir)) {
    const realAgentDir = await realpath(agentDir);
    assertInside(
      expectedRealCustomRoot,
      realAgentDir,
      `Refusing to write outside agents/custom: ${agentDir}`,
    );
  }
}

async function assertManifestPathNotSymlink(manifestPath: string): Promise<void> {
  try {
    const stats = await lstat(manifestPath);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Refusing to overwrite symlinked agent manifest: ${manifestPath}`,
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
  agentId: string,
  manifest: AgentManifest,
): Promise<AgentManifest> {
  const tempRoot = await mkdtemp(join(tmpdir(), "agent-manifest-validate-"));
  try {
    const customRoot = join(tempRoot, "agents", "custom");
    const agentDir = join(customRoot, agentId);
    const manifestPath = join(agentDir, "agent.yaml");
    await mkdir(agentDir, { recursive: true });
    await writeFile(manifestPath, formatAgentManifestYaml(manifest), {
      encoding: "utf8",
      flag: "wx",
    });

    const manifests = await loadAgentManifests({
      cwd: tempRoot,
      roots: [customRoot],
    });
    const normalized =
      manifests.find((candidate) => candidate.agentId === agentId) ?? null;
    if (!normalized) {
      throw new Error(`Failed to validate agent manifest: ${agentId}`);
    }
    return normalized;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function assertProtectedAgentIdWriteAllowed(
  cwd: string,
  agentId: string,
  env: Record<string, string | undefined>,
): Promise<void> {
  let protectedManifests: AgentManifest[];
  try {
    protectedManifests = await loadAgentManifests({
      cwd,
      roots: [join("agents", "builtin"), join("agents", "community")],
      env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("No agent manifests found under root(s):")) {
      return;
    }
    throw error;
  }
  const existing =
    protectedManifests.find((candidate) => candidate.agentId === agentId) ?? null;
  if (!existing) return;

  if (existing.source === "builtin") {
    if (env.AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE === "1") return;
    throw new Error(
      `Refusing to override built-in agent manifest: ${agentId}; set AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE=1 to allow local override`,
    );
  }

  throw new Error(`Refusing to override community agent manifest: ${agentId}`);
}

export async function writeAgentManifest(
  input: WriteAgentManifestInput,
): Promise<WriteAgentManifestResult> {
  const cwd =
    input.cwd === undefined
      ? await defaultCwd(process.cwd())
      : resolve(input.cwd);
  const env = input.env ?? process.env;
  assertWritableAgentId(input.agentId);

  const customRoot = resolve(cwd, "agents", "custom");
  const agentDir = resolve(customRoot, input.agentId);
  const manifestPath = resolve(agentDir, "agent.yaml");
  const expectedManifestPath = join(customRoot, input.agentId, "agent.yaml");
  if (manifestPath !== expectedManifestPath) {
    throw new Error(`Refusing to write outside agents/custom: ${manifestPath}`);
  }

  const manifest = toCustomManifest(input.agentId, input.manifest);
  const normalizedManifest = await validateManifestBeforeFinalWrite(
    input.agentId,
    manifest,
  );

  await assertProtectedAgentIdWriteAllowed(cwd, input.agentId, env);
  await assertNoSymlinkedCustomPath(cwd, customRoot, agentDir);
  if ((await pathExists(manifestPath)) && input.overwrite !== true) {
    throw new Error(`Agent manifest already exists: ${manifestPath}`);
  }

  await mkdir(agentDir, { recursive: true });
  await assertNoSymlinkedCustomPath(cwd, customRoot, agentDir);
  await assertManifestPathNotSymlink(manifestPath);
  await writeFile(manifestPath, formatAgentManifestYaml(normalizedManifest), {
    encoding: "utf8",
    flag: input.overwrite === true ? "w" : "wx",
  });

  const normalized = await loadAgentManifests({
    cwd,
    roots: [customRoot],
  });
  const written =
    normalized.find((candidate) => candidate.agentId === input.agentId) ?? null;
  if (!written) {
    throw new Error(`Failed to reload written agent manifest: ${manifestPath}`);
  }

  return {
    manifest: written,
    path: manifestPath,
  };
}
