import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { AgentManifest } from "./agent-manifest";
import { writeAgentManifest } from "./agent-manifest-writer";

async function createRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "agent-writer-"));
}

function manifest(agentId = "my_agent"): AgentManifest {
  return {
    agentId,
    name: "My Agent",
    description: "Custom agent created in a test.",
    source: "custom",
    instructions: "Use selected skills.",
    skills: [{ skillId: "doc_to_md", required: false }],
    planner: { mode: "linear", failureStrategy: "fail_fast" },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
    memory: { promotionMode: "run_summary" },
    handoffs: [],
    tests: [],
  };
}

test("rejects traversal and absolute-path-like agent IDs", async () => {
  const cwd = await createRoot();

  for (const agentId of ["../bad", "/bad", "C:\\bad", "c:/bad"]) {
    await assert.rejects(
      writeAgentManifest({
        cwd,
        agentId,
        manifest: manifest("my_agent"),
      }),
      /Invalid agentId/,
    );
  }
});

test("creates agents/custom/my_agent/agent.yaml for a valid request", async () => {
  const cwd = await createRoot();
  const { agentId: _agentId, source: _source, ...inputManifest } = manifest();

  const result = await writeAgentManifest({
    cwd,
    agentId: "my_agent",
    manifest: inputManifest,
  });

  const expectedPath = join(cwd, "agents", "custom", "my_agent", "agent.yaml");
  const content = await readFile(expectedPath, "utf8");

  assert.equal(result.path, expectedPath);
  assert.equal(result.manifest.agentId, "my_agent");
  assert.equal(result.manifest.source, "custom");
  assert.match(content, /^agentId: my_agent/m);
  assert.match(content, /^source: custom/m);
});

test("rejects overwrite when the custom manifest already exists", async () => {
  const cwd = await createRoot();
  await writeAgentManifest({
    cwd,
    agentId: "my_agent",
    manifest: manifest(),
  });

  await assert.rejects(
    writeAgentManifest({
      cwd,
      agentId: "my_agent",
      manifest: manifest(),
    }),
    /already exists/,
  );
});

test("overwrite true replaces an existing custom manifest", async () => {
  const cwd = await createRoot();
  await writeAgentManifest({
    cwd,
    agentId: "my_agent",
    manifest: manifest(),
  });

  const result = await writeAgentManifest({
    cwd,
    agentId: "my_agent",
    manifest: { ...manifest(), name: "Replacement Agent" },
    overwrite: true,
  });

  assert.equal(result.manifest.name, "Replacement Agent");
});

test("rejects conflicting manifest agentId before writing", async () => {
  const cwd = await createRoot();

  await assert.rejects(
    writeAgentManifest({
      cwd,
      agentId: "my_agent",
      manifest: manifest("other_agent"),
    }),
    /manifest.agentId must match agentId/,
  );

  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "my_agent", "agent.yaml")),
    false,
  );
});

test("does not leave a manifest behind when validation fails", async () => {
  const cwd = await createRoot();

  await assert.rejects(
    writeAgentManifest({
      cwd,
      agentId: "bad_agent",
      manifest: {
        ...manifest("bad_agent"),
        planner: {
          mode: "not_a_mode",
          failureStrategy: "fail_fast",
        },
      } as unknown as AgentManifest,
    }),
    /Invalid planner.mode/,
  );

  assert.equal(
    await fileExists(join(cwd, "agents", "custom", "bad_agent", "agent.yaml")),
    false,
  );
});

test("rejects symlinked custom root ancestors that escape the workspace", async (t) => {
  const cwd = await createRoot();
  const outside = await createRoot();
  await mkdir(join(cwd, "agents"), { recursive: true });
  try {
    await symlink(outside, join(cwd, "agents", "custom"), "junction");
  } catch (error) {
    t.skip(
      `Symlink or junction creation is not permitted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }

  await assert.rejects(
    writeAgentManifest({
      cwd,
      agentId: "my_agent",
      manifest: manifest(),
    }),
    /Refusing to write through symlinked or redirected agents\/custom path/,
  );

  assert.equal(
    await fileExists(join(outside, "my_agent", "agent.yaml")),
    false,
  );
});

test("overwrite true rejects an existing manifest file symlink", async (t) => {
  const cwd = await createRoot();
  const outside = await createRoot();
  const agentDir = join(cwd, "agents", "custom", "my_agent");
  const manifestPath = join(agentDir, "agent.yaml");
  const outsideManifestPath = join(outside, "outside-agent.yaml");
  await mkdir(agentDir, { recursive: true });
  await writeFile(outsideManifestPath, "outside sentinel", "utf8");
  try {
    await symlink(outsideManifestPath, manifestPath, "file");
  } catch (error) {
    t.skip(
      `File symlink creation is not permitted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }

  await assert.rejects(
    writeAgentManifest({
      cwd,
      agentId: "my_agent",
      manifest: manifest(),
      overwrite: true,
    }),
    /Refusing to overwrite symlinked agent manifest/,
  );

  assert.equal(await readFile(outsideManifestPath, "utf8"), "outside sentinel");
});

test("rejects direct writes to built-in or community manifest sources", async () => {
  const cwd = await createRoot();

  for (const source of ["builtin", "community"] as const) {
    await assert.rejects(
      writeAgentManifest({
        cwd,
        agentId: `${source}_agent`,
        manifest: { ...manifest(`${source}_agent`), source },
        overwrite: true,
      }),
      /Only custom agent manifests can be written/,
    );
  }
});

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
