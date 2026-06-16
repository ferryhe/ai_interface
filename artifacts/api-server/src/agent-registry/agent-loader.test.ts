import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { loadAgentManifests } from "./agent-loader";

const defaultAgentIds = [
  "claims_reviewer",
  "compliance_auditor",
  "evidence_collector",
  "knowledge_builder",
  "life_uw_analyst",
  "pricing_actuary",
];

const minimalManifest = (options: {
  agentId?: string;
  source?: string;
  name?: string;
  skillId?: string;
} = {}) => `agentId: ${options.agentId ?? "fixture_agent"}
name: ${options.name ?? "Fixture Agent"}
description: Fixture manifest for loader tests.
source: ${options.source ?? "builtin"}
instructions: Preserve intermediate artifacts for review.
skills:
  - skillId: ${options.skillId ?? "fixture_skill"}
    required: true
`;

async function createRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "agent-loader-"));
}

async function writeManifest(
  root: string,
  agentDir: string,
  content: string,
): Promise<string> {
  const manifestDir = join(root, agentDir);
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, "agent.yaml");
  await writeFile(manifestPath, content, "utf8");
  return manifestPath;
}

test("loads built-in knowledge_builder with normalized defaults", async () => {
  const manifests = await loadAgentManifests();

  assert.deepEqual(
    manifests.map((manifest) => manifest.agentId).sort(),
    defaultAgentIds,
  );
  const manifest = manifests.find((m) => m.agentId === "knowledge_builder");
  assert.equal(manifest?.name, "Knowledge Builder");
  assert.equal(manifest?.source, "builtin");
  assert.equal(manifest?.planner.mode, "dag");
  assert.equal(manifest?.planner.failureStrategy, "fail_fast");
  assert.equal(manifest?.permissions.approvalRequired, true);
  assert.equal(manifest?.permissions.canUseNetwork, true);
  assert.equal(manifest?.permissions.canWriteDatabase, true);
  assert.equal(manifest?.memory.promotionMode, "run_summary");
  assert.equal(manifest?.runtimeStatus, "runnable");
  assert.deepEqual(manifest?.handoffs, []);
  assert.deepEqual(
    manifest?.skills.map((binding) => [
      binding.skillId,
      binding.required,
    ]),
    [
      ["web_listening", false],
      ["doc_to_md", false],
      ["md_to_rag", true],
      ["rag_to_agent", true],
    ],
  );
  assert.deepEqual(manifest?.tests, [
    {
      name: "build_from_markdown",
      prompt: "Build an agent from approved Markdown source material.",
      expectedSkillIds: ["md_to_rag", "rag_to_agent"],
    },
  ]);
});

test("applies documented defaults to minimal manifests", async () => {
  const root = await createRoot();
  await writeManifest(root, "fixture", minimalManifest());

  const [manifest] = await loadAgentManifests({ roots: [root] });

  assert.equal(manifest?.planner.mode, "linear");
  assert.equal(manifest?.planner.failureStrategy, "fail_fast");
  assert.equal(manifest?.permissions.approvalRequired, false);
  assert.equal(manifest?.permissions.canUseNetwork, false);
  assert.equal(manifest?.permissions.canWriteDatabase, true);
  assert.equal(manifest?.memory.promotionMode, "run_summary");
  assert.equal(manifest?.runtimeStatus, "runnable");
  assert.deepEqual(manifest?.handoffs, []);
  assert.deepEqual(manifest?.tests, []);
});

test("normalizes custom template nine-segment fields", async () => {
  const root = await createRoot();
  await writeManifest(
    root,
    "custom-template",
    `agentId: custom_template
name: Custom Template
description: Fixture custom template manifest.
source: custom
runtimeStatus: template
teamId: insurance
instructions: Preserve evidence for review.
identity:
  persona: Fixture persona
  background: Fixture background
criticalRules:
  - id: evidence
    description: Preserve evidence.
    severity: blocker
deliverables:
  - name: Evidence report
    format: Markdown
    description: Summarize evidence.
    successCriteria: Every claim has a source.
workflow:
  - name: Review
    description: Review evidence.
    approvalRequired: true
    deliverables:
      - Evidence report
communicationStyle:
  tone: Professional
  outputFormat: Markdown + tables
  languagePreference: zh-CN
successMetrics:
  - metric: Traceability
    target: "100%"
    measurement: Every decision links to evidence.
skills: []
planner:
  mode: linear
  failureStrategy: fail_fast
permissions:
  approvalRequired: true
  canUseNetwork: false
  canWriteDatabase: false
memory:
  promotionMode: disabled
handoffs: []
tests: []
`,
  );

  const [manifest] = await loadAgentManifests({ roots: [root] });

  assert.equal(manifest?.source, "custom");
  assert.equal(manifest?.runtimeStatus, "template");
  assert.equal(manifest?.teamId, "insurance");
  assert.deepEqual(manifest?.identity, {
    persona: "Fixture persona",
    background: "Fixture background",
  });
  assert.deepEqual(manifest?.criticalRules, [
    {
      id: "evidence",
      description: "Preserve evidence.",
      severity: "blocker",
    },
  ]);
  assert.deepEqual(manifest?.deliverables, [
    {
      name: "Evidence report",
      format: "Markdown",
      description: "Summarize evidence.",
      successCriteria: "Every claim has a source.",
    },
  ]);
  assert.deepEqual(manifest?.workflow, [
    {
      name: "Review",
      description: "Review evidence.",
      approvalRequired: true,
      deliverables: ["Evidence report"],
    },
  ]);
  assert.deepEqual(manifest?.communicationStyle, {
    tone: "Professional",
    outputFormat: "Markdown + tables",
    languagePreference: "zh-CN",
  });
  assert.deepEqual(manifest?.successMetrics, [
    {
      metric: "Traceability",
      target: "100%",
      measurement: "Every decision links to evidence.",
    },
  ]);
  assert.deepEqual(manifest?.skills, []);
  assert.equal(manifest?.permissions.approvalRequired, true);
  assert.equal(manifest?.permissions.canWriteDatabase, false);
  assert.equal(manifest?.memory.promotionMode, "disabled");
});

test("duplicate agentId errors include both manifest paths", async () => {
  const root = await createRoot();
  const firstPath = await writeManifest(root, "first", minimalManifest());
  const secondPath = await writeManifest(root, "second", minimalManifest());

  await assert.rejects(
    loadAgentManifests({ roots: [root] }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Duplicate agentId fixture_agent") &&
      error.message.includes(firstPath) &&
      error.message.includes(secondPath),
  );
});

test("community cannot override builtin agents", async () => {
  const root = await createRoot();
  const builtinRoot = join(root, "agents", "builtin");
  const communityRoot = join(root, "agents", "community");
  const builtinPath = await writeManifest(
    builtinRoot,
    "fixture",
    minimalManifest({ source: "builtin" }),
  );
  const communityPath = await writeManifest(
    communityRoot,
    "fixture",
    minimalManifest({ source: "community" }),
  );

  await assert.rejects(
    loadAgentManifests({ cwd: root }),
    (error) =>
      error instanceof Error &&
      error.message.includes("community cannot override builtin agentId fixture_agent") &&
      error.message.includes(builtinPath) &&
      error.message.includes(communityPath),
  );
});

test("custom agents can override community agents", async () => {
  const root = await createRoot();
  const communityRoot = join(root, "agents", "community");
  const customRoot = join(root, "agents", "custom");
  await writeManifest(
    communityRoot,
    "fixture",
    minimalManifest({
      source: "community",
      name: "Community Agent",
    }),
  );
  await writeManifest(
    customRoot,
    "fixture",
    minimalManifest({
      source: "custom",
      name: "Custom Agent",
    }),
  );

  const manifests = await loadAgentManifests({ cwd: root });

  assert.equal(manifests.length, 1);
  assert.equal(manifests[0]?.name, "Custom Agent");
  assert.equal(manifests[0]?.source, "custom");
});

test("custom agents cannot override builtins without opt-in", async () => {
  const root = await createRoot();
  const builtinRoot = join(root, "agents", "builtin");
  const customRoot = join(root, "agents", "custom");
  const builtinPath = await writeManifest(
    builtinRoot,
    "fixture",
    minimalManifest({ source: "builtin" }),
  );
  const customPath = await writeManifest(
    customRoot,
    "fixture",
    minimalManifest({ source: "custom" }),
  );

  await assert.rejects(
    loadAgentManifests({ cwd: root, env: {} }),
    (error) =>
      error instanceof Error &&
      error.message.includes("custom cannot override builtin agentId fixture_agent") &&
      error.message.includes("AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE=1") &&
      error.message.includes(builtinPath) &&
      error.message.includes(customPath),
  );
});

test("custom agents can override builtins with explicit opt-in", async () => {
  const root = await createRoot();
  const builtinRoot = join(root, "agents", "builtin");
  const customRoot = join(root, "agents", "custom");
  await writeManifest(
    builtinRoot,
    "fixture",
    minimalManifest({
      source: "builtin",
      name: "Builtin Agent",
    }),
  );
  await writeManifest(
    customRoot,
    "fixture",
    minimalManifest({
      source: "custom",
      name: "Custom Override Agent",
    }),
  );

  const manifests = await loadAgentManifests({
    cwd: root,
    env: { AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE: "1" },
  });

  assert.equal(manifests.length, 1);
  assert.equal(manifests[0]?.name, "Custom Override Agent");
  assert.equal(manifests[0]?.source, "custom");
});

test("rejects manifests whose source does not match a known agent root", async () => {
  for (const fixture of [
    {
      rootSource: "builtin",
      declaredSource: "community",
    },
    {
      rootSource: "community",
      declaredSource: "builtin",
    },
    {
      rootSource: "custom",
      declaredSource: "builtin",
    },
  ]) {
    const root = await createRoot();
    const agentRoot = join(root, "agents", fixture.rootSource);
    const manifestPath = await writeManifest(
      agentRoot,
      "misdeclared",
      minimalManifest({
        agentId: `misdeclared_${fixture.rootSource}`,
        source: fixture.declaredSource,
      }),
    );

    await assert.rejects(
      loadAgentManifests({ cwd: root }),
      (error) =>
        error instanceof Error &&
        error.message.includes("source mismatch") &&
        error.message.includes(`expected ${fixture.rootSource}`) &&
        error.message.includes(`found ${fixture.declaredSource}`) &&
        error.message.includes(manifestPath),
    );
  }
});

test("default roots load from an explicit repository root cwd", async () => {
  const manifests = await loadAgentManifests({
    cwd: resolve(process.cwd(), "../.."),
  });

  assert.deepEqual(
    manifests.map((manifest) => manifest.agentId).sort(),
    defaultAgentIds,
  );
});
