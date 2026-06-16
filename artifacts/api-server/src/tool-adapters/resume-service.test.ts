import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import {
  InMemoryModuleRunRepository,
  createModuleRun,
  requestModuleRunInteraction,
  submitModuleRunFeedback,
} from "../modules/ingest-service";
import type { ModuleId } from "../modules/registry";
import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import {
  ModuleRunNotFoundError,
  resumeModuleRunExecution,
} from "./resume-service";

function customReporterManifest(): SkillManifest {
  return {
    skillId: "custom_reporter",
    moduleId: "custom_reporter_module",
    name: "Custom Reporter",
    description: "Create custom reports from artifacts.",
    category: "agent",
    project: {
      source: "external",
      defaultSiblingPath: "../custom_reporter",
    },
    execution: {
      kind: "http",
      adapterId: "custom_reporter.http.v1",
      requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      optionalEnv: [],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: [],
      supportsResume: true,
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    artifactKinds: ["custom_report"],
    interactionKinds: ["question"],
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

async function createResumableRun(
  repository: InMemoryModuleRunRepository,
  moduleId: ModuleId,
  externalRunId: string,
) {
  const { run } = await createModuleRun(repository, {
    moduleId,
    externalRunId,
    inputJson: { requestedScope: "resume-test" },
    metadata: {
      source: "resume-service-test",
    },
  });

  const requested = await requestModuleRunInteraction(repository, run.id, {
    kind: "question",
    title: "Confirm resume",
    message: "The adapter needs input before continuing.",
    prompt: "Resume with the supplied answer?",
    resumeHandle: `${moduleId}:${externalRunId}:resume`,
    requestedBy: moduleId,
    metadata: {
      promptKey: "confirm-resume",
    },
  });

  const feedback = await submitModuleRunFeedback(repository, run.id, {
    responseText: "Continue with the supplied answer.",
    metadata: {
      answeredBy: "tester",
    },
  });

  return { requested, feedback };
}

async function withResumeHttpServer(): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const server = createServer((req, res) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          resumedBy: "real-http-test",
          input: data ? JSON.parse(data) : null,
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        (server as Server).close((error) =>
          error ? reject(error) : resolve(),
        );
      }),
  };
}

test("resumes a resumable interaction through the safe fake executor", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { feedback } = await createResumableRun(
    repository,
    "doc_to_md",
    "doc-resume-success-001",
  );

  const result = await resumeModuleRunExecution(repository, feedback.run.id, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });

  assert.equal(result.interaction.status, "resumed");
  assert.deepEqual(result.interaction.response, feedback.interaction.response);
  assert.equal(
    result.interaction.resumeHandle,
    "doc_to_md:doc-resume-success-001:resume",
  );
  assert.equal(result.interaction.metadata["promptKey"], "confirm-resume");
  assert.equal(typeof result.interaction.metadata["resumedAt"], "string");
  assert.ok(Date.parse(String(result.interaction.metadata["resumedAt"])));

  assert.equal(result.event.eventType, "tool.execution.resume_requested");
  assert.deepEqual(result.event.payload, {
    interactionId: result.interaction.interactionId,
    resumeHandle: "doc_to_md:doc-resume-success-001:resume",
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
    externalRunId: "doc-resume-success-001",
  });

  assert.equal(result.run.status, "succeeded");
  assert.equal(result.run.metadata?.["source"], "resume-service-test");
  assert.equal(result.run.metadata?.["adapterExecutionStatus"], "succeeded");
  assert.equal(result.run.metadata?.["interaction"], result.interaction);

  const events = await repository.listRunEvents(feedback.run.id);
  assert.deepEqual(
    events.map((event) => event.eventType),
    [
      "tool.interaction.requested",
      "tool.interaction.feedback_submitted",
      "tool.execution.resume_requested",
      "tool.execution.fake_completed",
    ],
  );
});

test("rejects duplicate resumes after the interaction is consumed", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { feedback } = await createResumableRun(
    repository,
    "rag_to_agent",
    "agent-resume-duplicate-001",
  );

  await resumeModuleRunExecution(repository, feedback.run.id, {
    env: { RAG_TO_AGENT_API_BASE_URL: "https://agent.example.internal" },
  });
  const eventCountAfterResume = repository.runEvents.length;

  await assert.rejects(
    () =>
      resumeModuleRunExecution(repository, feedback.run.id, {
        env: { RAG_TO_AGENT_API_BASE_URL: "https://agent.example.internal" },
      }),
    /already resumed/,
  );

  assert.equal(repository.runEvents.length, eventCountAfterResume);
});

test("concurrent duplicate resumes consume the interaction only once", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { feedback } = await createResumableRun(
    repository,
    "doc_to_md",
    "doc-resume-concurrent-001",
  );

  const results = await Promise.allSettled([
    resumeModuleRunExecution(repository, feedback.run.id, {
      env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
    }),
    resumeModuleRunExecution(repository, feedback.run.id, {
      env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
    }),
  ]);

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  const events = await repository.listRunEvents(feedback.run.id);
  assert.equal(
    events.filter(
      (event) => event.eventType === "tool.execution.resume_requested",
    ).length,
    1,
  );
  assert.equal(
    events.filter(
      (event) => event.eventType === "tool.execution.fake_completed",
    ).length,
    1,
  );
});

test("records a redacted skip without consuming feedback when required env is missing", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { feedback } = await createResumableRun(
    repository,
    "doc_to_md",
    "doc-resume-missing-env-001",
  );

  const result = await resumeModuleRunExecution(repository, feedback.run.id, {
    env: { DOC_TO_MD_API_TOKEN: "secret-token" },
  });

  assert.equal(result.interaction.status, "resumable");
  assert.equal(result.run.status, "pending");
  assert.equal(result.run.metadata?.["adapterExecutionStatus"], "skipped");
  assert.equal(result.run.metadata?.["interaction"], feedback.interaction);
  assert.deepEqual(result.run.metadata?.["adapterMissingRequiredEnv"], [
    "DOC_TO_MD_API_BASE_URL",
  ]);

  const events = await repository.listRunEvents(feedback.run.id);
  const skipped = events.find(
    (event) => event.eventType === "tool.execution.skipped",
  );
  assert.ok(skipped);
  assert.deepEqual(skipped.payload, {
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
    missingRequiredEnv: ["DOC_TO_MD_API_BASE_URL"],
  });
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
  assert.equal(JSON.stringify(events).includes("secret-token"), false);

  const resumed = await resumeModuleRunExecution(repository, feedback.run.id, {
    env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
  });
  assert.equal(resumed.interaction.status, "resumed");
  assert.equal(resumed.run.status, "succeeded");
});

test("resumes custom module runs through an injected registry adapter", async () => {
  const repository = new InMemoryModuleRunRepository();
  const registry = createSkillRuntimeRegistry([customReporterManifest()]);
  const { run } = await createModuleRun(
    repository,
    {
      moduleId: "custom_reporter_module",
      externalRunId: "custom-resume-success-001",
      inputJson: { requestedScope: "custom" },
    },
    { registry },
  );
  await requestModuleRunInteraction(repository, run.id, {
    kind: "question",
    title: "Confirm custom resume",
    message: "The custom reporter needs input.",
    resumeHandle: "custom_reporter:custom-resume-success-001:resume",
  });
  const feedback = await submitModuleRunFeedback(repository, run.id, {
    responseText: "Continue.",
  });

  const result = await resumeModuleRunExecution(repository, feedback.run.id, {
    env: { CUSTOM_REPORTER_API_BASE_URL: "https://report.example.internal" },
    registry,
  });

  assert.equal(result.interaction.status, "resumed");
  assert.equal(result.run.status, "succeeded");
  assert.equal(
    result.run.metadata?.["adapterId"],
    "custom_reporter.http.v1",
  );
  assert.equal(result.event.payload?.["adapterId"], "custom_reporter.http.v1");
  assert.equal(JSON.stringify(result).includes("report.example.internal"), false);
});

test("resume execution uses the real executor only when explicitly enabled", async () => {
  const repository = new InMemoryModuleRunRepository();
  const registry = createSkillRuntimeRegistry([customReporterManifest()]);
  const server = await withResumeHttpServer();
  const { run } = await createModuleRun(
    repository,
    {
      moduleId: "custom_reporter_module",
      externalRunId: "custom-resume-real-001",
      inputJson: { requestedScope: "custom-real" },
    },
    { registry },
  );
  await requestModuleRunInteraction(repository, run.id, {
    kind: "question",
    title: "Confirm custom resume",
    message: "The custom reporter needs input.",
    resumeHandle: "custom_reporter:custom-resume-real-001:resume",
  });
  const feedback = await submitModuleRunFeedback(repository, run.id, {
    responseText: "Continue.",
  });

  try {
    const result = await resumeModuleRunExecution(repository, feedback.run.id, {
      env: {
        AI_INTERFACE_TOOL_EXECUTION_MODE: "real",
        CUSTOM_REPORTER_API_BASE_URL: server.url,
      },
      registry,
    });

    assert.equal(result.interaction.status, "resumed");
    assert.equal(result.run.status, "succeeded");
    assert.deepEqual(result.run.outputJson, {
      resumedBy: "real-http-test",
      input: { requestedScope: "custom-real" },
    });
    const events = await repository.listRunEvents(feedback.run.id);
    assert.equal(
      events.some((event) => event.eventType === "tool.execution.http_completed"),
      true,
    );
    assert.equal(
      events.some((event) => event.eventType === "tool.execution.fake_completed"),
      false,
    );
    assert.equal(JSON.stringify(result).includes(server.url), false);
  } finally {
    await server.close();
  }
});

test("rejects a run without a resumable interaction", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: "doc-resume-no-interaction-001",
  });

  await assert.rejects(
    () =>
      resumeModuleRunExecution(repository, run.id, {
        env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
      }),
    /no resumable interaction/,
  );

  assert.equal(repository.runEvents.length, 0);
});

test("rejects missing module runs with a typed not-found error", async () => {
  const repository = new InMemoryModuleRunRepository();

  await assert.rejects(
    () => resumeModuleRunExecution(repository, "missing-run"),
    (error) =>
      error instanceof ModuleRunNotFoundError &&
      error.message === "Module run not found: missing-run",
  );

  assert.equal(repository.runEvents.length, 0);
});

test("rejects adapters that do not support resume without consuming feedback", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { feedback } = await createResumableRun(
    repository,
    "md_to_rag",
    "rag-resume-unsupported-001",
  );

  await assert.rejects(
    () =>
      resumeModuleRunExecution(repository, feedback.run.id, {
        env: { CROSS2_CLI_PATH: "C:\\tools\\cross2.exe" },
      }),
    /does not support resume/,
  );

  const stored = await repository.findModuleRunById(feedback.run.id);
  assert.equal(repository.runEvents.length, 2);
  assert.equal(stored?.metadata?.["interaction"], feedback.interaction);
});
