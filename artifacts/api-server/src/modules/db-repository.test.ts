import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { InMemoryAgentRuntimeRepository } from "../agent-runtime/agent-runtime-service";
import {
  createModuleRun,
  listArtifacts,
  recordModuleRunArtifact,
} from "./ingest-service";
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

test("artifact listing filters by pipeline, module run, kind, and limit", async () => {
  const repository = new InMemoryAgentRuntimeRepository();
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Artifact filter pipeline",
    status: "pending",
    activeModuleId: "doc_to_md",
    metadata: null,
  });
  const otherPipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Other artifact pipeline",
    status: "pending",
    activeModuleId: "rag_to_agent",
    metadata: null,
  });
  const first = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `db-artifact-doc-${randomUUID()}`,
    pipelineRunId: pipelineRun.id,
  });
  const second = await createModuleRun(repository, {
    moduleId: "md_to_rag",
    externalRunId: `db-artifact-rag-${randomUUID()}`,
    pipelineRunId: pipelineRun.id,
  });
  const other = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: `db-artifact-agent-${randomUUID()}`,
    pipelineRunId: otherPipelineRun.id,
  });
  await recordModuleRunArtifact(repository, first.run.id, {
    artifactKind: "markdown",
    title: "Converted Markdown",
  });
  await recordModuleRunArtifact(repository, second.run.id, {
    artifactKind: "rag_records",
    title: "RAG Records",
  });
  await recordModuleRunArtifact(repository, other.run.id, {
    artifactKind: "agent_config",
    title: "Other Agent Config",
  });

  const pipelineArtifacts = await listArtifacts(repository, {
    pipelineRunId: pipelineRun.id,
  });
  const moduleArtifacts = await listArtifacts(repository, {
    moduleRunId: second.run.id,
  });
  const limitedMarkdownArtifacts = await listArtifacts(repository, {
    kind: "markdown",
    limit: 1,
  });

  assert.deepEqual(
    pipelineArtifacts.map((artifact) => artifact.title),
    ["Converted Markdown", "RAG Records"],
  );
  assert.deepEqual(
    moduleArtifacts.map((artifact) => artifact.title),
    ["RAG Records"],
  );
  assert.deepEqual(
    limitedMarkdownArtifacts.map((artifact) => artifact.title),
    ["Converted Markdown"],
  );
});
