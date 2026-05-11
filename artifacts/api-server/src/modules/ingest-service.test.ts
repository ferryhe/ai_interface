import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryModuleRunRepository,
  createModuleRun,
  recordModuleRunArtifact,
  recordModuleRunEvent,
  requestModuleRunInteraction,
  submitModuleRunFeedback,
} from "./ingest-service";

test("creates module runs idempotently by module and external run id", async () => {
  const repository = new InMemoryModuleRunRepository();

  const first = await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: "listen-001",
    title: "Listen to docs",
    status: "running",
    inputJson: { url: "https://example.com" },
  });

  const second = await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: "listen-001",
    title: "Listen to docs",
    status: "succeeded",
    outputJson: { snapshotsCreated: 4 },
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.run.id, first.run.id);
  assert.equal(second.run.status, "succeeded");
  assert.deepEqual(second.run.inputJson, { url: "https://example.com" });
  assert.deepEqual(second.run.outputJson, { snapshotsCreated: 4 });
  assert.equal(repository.moduleRuns.length, 1);
});

test("rejects unknown module ids before storing a run", async () => {
  const repository = new InMemoryModuleRunRepository();

  await assert.rejects(
    () =>
      createModuleRun(repository, {
        moduleId: "unknown_module",
        externalRunId: "bad-001",
        status: "running",
      }),
    /Unknown moduleId: unknown_module/,
  );

  assert.equal(repository.moduleRuns.length, 0);
});

test("rejects unknown pipeline runs before storing a run", async () => {
  const repository = new InMemoryModuleRunRepository();

  await assert.rejects(
    () =>
      createModuleRun(repository, {
        moduleId: "web_listening",
        externalRunId: "listen-002",
        pipelineRunId: "11111111-1111-1111-1111-111111111111",
      }),
    /Pipeline run not found: 11111111-1111-1111-1111-111111111111/,
  );

  assert.equal(repository.moduleRuns.length, 0);
});

test("stores known pipeline run ids", async () => {
  const repository = new InMemoryModuleRunRepository();
  repository.pipelineRunIds.add("11111111-1111-1111-1111-111111111111");

  const { run } = await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: "listen-003",
    pipelineRunId: "11111111-1111-1111-1111-111111111111",
  });

  assert.equal(run.pipelineRunId, "11111111-1111-1111-1111-111111111111");
});

test("records events against an existing module run", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: "doc-001",
  });

  const event = await recordModuleRunEvent(repository, run.id, {
    eventType: "conversion_warning",
    title: "OCR warning",
    message: "1 scanned page required OCR",
    severity: "warning",
    payload: { page: 3 },
  });

  assert.equal(event.moduleRunId, run.id);
  assert.equal(event.severity, "warning");
  assert.deepEqual(event.payload, { page: 3 });
  assert.equal(repository.runEvents.length, 1);
});

test("stores artifacts with source information from the module run", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "md_to_rag",
    externalRunId: "rag-001",
  });

  const artifact = await recordModuleRunArtifact(repository, run.id, {
    artifactKind: "rag_chunk",
    title: "Chunk 1",
    contentText: "Welcome to the onboarding guide.",
    contentJson: { tokenCount: 7 },
  });

  assert.equal(artifact.sourceRunId, run.id);
  assert.equal(artifact.sourceModuleId, "md_to_rag");
  assert.equal(artifact.contentText, "Welcome to the onboarding guide.");
  assert.deepEqual(artifact.contentJson, { tokenCount: 7 });
  assert.equal(repository.artifacts.length, 1);
});

test("records a tool interaction request and marks the run waiting", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: "agent-approval-001",
  });

  const result = await requestModuleRunInteraction(repository, run.id, {
    kind: "approval",
    title: "Approve agent publish",
    message: "Review generated agent permissions before continuing.",
    prompt: "Approve publishing this agent config?",
    options: [{ id: "approve", label: "Approve" }],
    resumeHandle: "rag_to_agent:agent-approval-001:publish",
    requestedBy: "rag_to_agent",
  });

  assert.equal(result.interaction.status, "waiting_for_approval");
  assert.equal(result.interaction.kind, "approval");
  assert.equal(result.run.metadata?.["interaction"], result.interaction);
  assert.equal(result.event.eventType, "tool.interaction.requested");
  assert.equal(result.event.payload?.["status"], "waiting_for_approval");
});

test("records tool feedback and marks the interaction resumable", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: "doc-feedback-001",
  });

  const requested = await requestModuleRunInteraction(repository, run.id, {
    kind: "question",
    title: "Choose conversion engine",
    message: "The document has scanned pages.",
    prompt: "Use OCR mode?",
    options: [{ id: "ocr", label: "Use OCR" }],
    resumeHandle: "doc_to_md:doc-feedback-001:ocr",
  });

  const result = await submitModuleRunFeedback(repository, run.id, {
    responseText: "Use OCR mode.",
    selectedOptionId: "ocr",
    approved: true,
  });

  assert.equal(result.interaction.interactionId, requested.interaction.interactionId);
  assert.equal(result.interaction.status, "resumable");
  assert.deepEqual(result.interaction.response, {
    responseText: "Use OCR mode.",
    selectedOptionId: "ocr",
    approved: true,
    artifactIds: [],
    metadata: {},
  });
  assert.equal(result.run.metadata?.["interaction"], result.interaction);
  assert.equal(result.event.eventType, "tool.interaction.feedback_submitted");
});

test("rejects tool feedback without an active interaction", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "web_listening",
    externalRunId: "listen-feedback-001",
  });

  await assert.rejects(
    () =>
      submitModuleRunFeedback(repository, run.id, {
        responseText: "Continue.",
      }),
    /Module run has no active interaction/,
  );

  assert.equal(repository.runEvents.length, 0);
});
