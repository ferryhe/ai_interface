import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import {
  getAgentRunTimeline,
  InMemoryAgentRuntimeRepository,
} from "../agent-runtime/agent-runtime-service";
import { approveApprovalRequest, listApprovalsService } from "../approvals/approval-decision-service";
import { createModuleRun, getCurrentInteraction } from "../modules/ingest-service";
import { InMemoryMissionRepository } from "../mission/in-memory-mission-repository";
import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import { createMissionsRouter } from "./missions";

async function withMissionsApp<T>(
  callback: (baseUrl: string, repositories: {
    missionRepository: InMemoryMissionRepository;
    configRepository: InMemoryAgentConfigRepository;
    runtimeRepository: InMemoryAgentRuntimeRepository;
  }) => Promise<T>,
  repositories = {
    missionRepository: new InMemoryMissionRepository(),
    configRepository: new InMemoryAgentConfigRepository(),
    runtimeRepository: new InMemoryAgentRuntimeRepository(),
  },
  skillManifests?: SkillManifest[],
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(
    createMissionsRouter(
      repositories.missionRepository,
      repositories.configRepository,
      repositories.runtimeRepository,
      skillManifests
        ? { registry: createSkillRuntimeRegistry(skillManifests) }
        : undefined,
    ),
  );

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    return await callback(`http://127.0.0.1:${port}`, repositories);
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) };
}

async function getJson(
  baseUrl: string,
  path: string,
  headers?: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
  });
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) };
}

function missionRuntimeEnv(): Record<string, string> {
  return {
    OPENAI_API_KEY: "test-openai-key",
    DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
    CROSS2_CLI_PATH: "/tmp/fake-cross2",
    RAG_TO_AGENT_API_BASE_URL: "https://agent.example.internal",
  };
}

async function withScopedMissionRuntimeEnv<T>(
  env: Record<string, string>,
  callback: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  ) as Record<string, string | undefined>;
  try {
    Object.assign(process.env, env);
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function withMissionRuntimeEnv<T>(callback: () => Promise<T>): Promise<T> {
  return withScopedMissionRuntimeEnv(missionRuntimeEnv(), callback);
}

function customReporterManifest(): SkillManifest {
  return {
    skillId: "custom_reporter_skill",
    moduleId: "custom_reporter_module",
    name: "Custom Reporter",
    description: "Create custom reports from mission artifacts.",
    category: "agent",
    project: {
      source: "external",
      defaultSiblingPath: "../custom_reporter",
    },
    execution: {
      kind: "cli",
      adapterId: "custom_reporter.cli.v1",
      requiredEnv: ["CUSTOM_REPORTER_CLI_PATH"],
      optionalEnv: [],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: ["custom-reporter run"],
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
      canWriteDatabase: false,
    },
  };
}

test("POST /missions/:missionId/execute resolves module-only mission steps through the skill registry", async () => {
  await withScopedMissionRuntimeEnv(
    {
      OPENAI_API_KEY: "test-openai-key",
      CUSTOM_REPORTER_CLI_PATH: "/tmp/fake-custom-reporter",
    },
    async () => {
      const manifest = customReporterManifest();
      await withMissionsApp(
        async (baseUrl, repositories) => {
          const missionId = "mission-custom-module-only";
          const created = await repositories.missionRepository.createMission({
            missionId,
            title: "Run a custom reporter mission",
            userGoal: "Run the custom reporter through mission execution.",
            status: "needs_confirmation",
            riskLevel: "low",
            plan: {
              missionId,
              title: "Run a custom reporter mission",
              userGoal: "Run the custom reporter through mission execution.",
              summary: "Run the custom reporter from a module-only Mission step.",
              status: "needs_confirmation",
              riskLevel: "low",
              steps: [
                {
                  stepId: "step-1",
                  title: "Custom reporter",
                  objective: "Create a custom report artifact.",
                  moduleId: manifest.moduleId,
                  dependsOn: [],
                  status: "pending",
                },
              ],
              warnings: [],
              nonGoals: [],
            },
          });

          const approved = await postJson(baseUrl, `/missions/${missionId}/approve`, {
            revisionId: created.revision.revisionId,
          });
          assert.equal(approved.status, 200);

          const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
            revisionId: created.revision.revisionId,
            executionMode: "execute_ready",
          });

          assert.equal(executed.status, 200);
          assert.equal((executed.json["mission"] as { status: string }).status, "completed");
          const moduleRun = (executed.json["moduleRuns"] as Array<{
            moduleId: string;
            metadata: Record<string, unknown>;
          }>)[0];
          assert.equal(moduleRun?.moduleId, manifest.moduleId);
          assert.equal(moduleRun?.metadata["skillId"], manifest.skillId);
          assert.equal(moduleRun?.metadata["adapterExecutionStatus"], "succeeded");
        },
        undefined,
        [manifest],
      );
    },
  );
});

test("POST /missions creates a draft mission", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await postJson(baseUrl, "/missions", {
      message: "Prepare an onboarding knowledge agent from approved docs.",
      enabledSkillIds: ["doc_to_md", "md_to_rag"],
    });

    assert.equal(response.status, 201);
    assert.equal(typeof response.json["mission"], "object");
    assert.equal((response.json["mission"] as { status: string }).status, "needs_confirmation");
    assert.equal((response.json["revision"] as { status: string }).status, "draft");
    assert.equal((response.json["plan"] as { missionId: string }).missionId.startsWith("mission-"), true);
  });
});

test("POST /missions/:missionId/revise revises the latest draft revision", async () => {
  await withMissionsApp(async (baseUrl) => {
    const created = await postJson(baseUrl, "/missions", {
      message: "Plan an ingestion mission.",
      enabledSkillIds: ["doc_to_md"],
    });
    const missionId = (created.json["mission"] as { missionId: string }).missionId;
    const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;

    const revised = await postJson(baseUrl, `/missions/${missionId}/revise`, {
      instruction: "Tighten the review notes before approval.",
      expectedRevisionId: revisionId,
    });

    assert.equal(revised.status, 200);
    assert.equal((revised.json["revision"] as { revisionNumber: number }).revisionNumber, 2);
    assert.equal((revised.json["mission"] as { status: string }).status, "needs_confirmation");
    assert.match((revised.json["plan"] as { summary: string }).summary, /Revision note/);
  });
});

test("POST /missions/:missionId/revise returns 409 for a stale revision", async () => {
  await withMissionsApp(async (baseUrl) => {
    const created = await postJson(baseUrl, "/missions", {
      message: "Plan a multi-step mission.",
      enabledSkillIds: ["doc_to_md", "md_to_rag"],
    });
    const missionId = (created.json["mission"] as { missionId: string }).missionId;
    const firstRevisionId = (created.json["revision"] as { revisionId: string }).revisionId;

    const latest = await postJson(baseUrl, `/missions/${missionId}/revise`, {
      instruction: "Refresh the draft.",
      expectedRevisionId: firstRevisionId,
    });
    assert.equal(latest.status, 200);

    const stale = await postJson(baseUrl, `/missions/${missionId}/revise`, {
      instruction: "Use the old revision again.",
      expectedRevisionId: firstRevisionId,
    });

    assert.equal(stale.status, 409);
    assert.match(stale.text, /newer revision/i);
  });
});

test("POST /missions/:missionId/approve approves the latest revision", async () => {
  await withMissionsApp(async (baseUrl) => {
    const created = await postJson(baseUrl, "/missions", {
      message: "Prepare the mission for approval.",
      enabledSkillIds: ["doc_to_md", "md_to_rag"],
    });
    const missionId = (created.json["mission"] as { missionId: string }).missionId;
    const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;

    const approved = await postJson(baseUrl, `/missions/${missionId}/approve`, {
      revisionId,
      approvedBy: "reviewer-1",
    });

    assert.equal(approved.status, 200);
    assert.equal((approved.json["mission"] as { status: string }).status, "approved");
    assert.equal((approved.json["approvedRevision"] as { status: string }).status, "approved");
    assert.equal(
      (approved.json["executionReadiness"] as { ready: boolean }).ready,
      true,
    );
  });
});

test("POST /missions/:missionId/approve does not start execution until /execute is called", async () => {
  await withMissionsApp(async (baseUrl, repositories) => {
    const created = await postJson(baseUrl, "/missions", {
      message: "Approve first, execute later.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["doc_to_md", "md_to_rag"],
    });
    const missionId = (created.json["mission"] as { missionId: string }).missionId;
    const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;

    // Snapshot after create — a plan-generation run may have been triggered during intake.
    const runsBefore = repositories.runtimeRepository.pipelineRuns.length;

    const approved = await postJson(baseUrl, `/missions/${missionId}/approve`, {
      revisionId,
      approvedBy: "reviewer-2",
    });

    assert.equal(approved.status, 200);
    // Approve must not trigger new execution.
    assert.equal(repositories.runtimeRepository.pipelineRuns.length, runsBefore);

    const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
      revisionId,
      executionMode: "execute_ready",
    });

    assert.equal(executed.status, 200);
    assert.equal(repositories.runtimeRepository.pipelineRuns.length, runsBefore + 1);
  });
});

test("POST /missions/:missionId/execute plan_only does not mark the mission executed", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Preview the approved mission plan before a real run.",
        agentId: "knowledge_builder",
        enabledSkillIds: ["doc_to_md", "md_to_rag"],
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });

      const planOnly = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "plan_only",
      });

      assert.equal(planOnly.status, 200);
      assert.equal((planOnly.json["mission"] as { status: string }).status, "approved");
      assert.equal(
        (planOnly.json["executionReadiness"] as { status: string }).status,
        "plan_only",
      );
      const planOnlyPipeline = planOnly.json["pipelineRun"] as { metadata: Record<string, unknown> };
      const planOnlyModuleRuns = planOnly.json["moduleRuns"] as Array<{
        metadata: Record<string, unknown>;
      }>;
      assert.equal(planOnlyPipeline.metadata["missionExecutionSource"], undefined);
      assert.equal(
        planOnlyModuleRuns.some((run) => run.metadata["missionId"] === missionId),
        false,
      );
      assert.equal((await listApprovalsService(repositories.runtimeRepository)).length, 0);
      const boardAfterPlanOnly = await getJson(baseUrl, `/missions/${missionId}/board`);
      const planOnlyBoardRows = boardAfterPlanOnly.json["board"] as Array<{
        moduleRunIds: string[];
        latestArtifacts: unknown[];
      }>;
      assert.equal(
        planOnlyBoardRows.every((row) => row.moduleRunIds.length === 0 && row.latestArtifacts.length === 0),
        true,
      );
      const latestAfterPlanOnly = await repositories.missionRepository.findLatestRevision(missionId);
      assert.equal(latestAfterPlanOnly?.status, "approved");

      const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });
      const pipelineRun = executed.json["pipelineRun"] as { metadata: Record<string, unknown> };
      assert.equal(executed.status, 200);
      assert.equal(pipelineRun.metadata["missionRerun"], undefined);
    });
  });
});

test("POST /missions/:missionId/execute preserves terminal mission status for synchronous runtime completion", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Run a mission snapshot with no runtime approval gate.",
        enabledSkillIds: ["doc_to_md"],
        reviewMode: "plan_only",
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });

      const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(executed.status, 200);
      assert.equal((executed.json["mission"] as { status: string }).status, "completed");
      assert.equal(
        (executed.json["executionReadiness"] as { status: string }).status,
        "completed",
      );
      const latestRevision = await repositories.missionRepository.findLatestRevision(missionId);
      assert.equal(latestRevision?.plan.status, "completed");

      const rerun = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });
      const rerunPipeline = rerun.json["pipelineRun"] as { metadata: Record<string, unknown> };
      assert.equal(rerun.status, 200);
      assert.equal(rerunPipeline.metadata["missionRerun"], true);
    });
  });
});

test("POST /missions/:missionId/execute treats skipped adapter execution as failed and retryable", async () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousDocBaseUrl = process.env.DOC_TO_MD_API_BASE_URL;
  process.env.OPENAI_API_KEY = "set";
  delete process.env.DOC_TO_MD_API_BASE_URL;
  try {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Run a mission before adapter env is ready.",
        enabledSkillIds: ["doc_to_md"],
        reviewMode: "plan_only",
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });

      const skipped = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(skipped.status, 200);
      assert.equal((skipped.json["mission"] as { status: string }).status, "failed");
      assert.equal(
        (skipped.json["executionReadiness"] as { status: string }).status,
        "failed",
      );
      const skippedRun = (skipped.json["moduleRuns"] as Array<{ metadata: Record<string, unknown> }>)[0];
      const skippedPipeline = skipped.json["pipelineRun"] as { status: string };
      assert.equal(skippedRun?.metadata["adapterExecutionStatus"], "skipped");
      assert.equal(skippedPipeline.status, "failed");

      process.env.DOC_TO_MD_API_BASE_URL = "https://doc.example.internal";
      const retried = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });
      const retriedPipeline = retried.json["pipelineRun"] as { metadata: Record<string, unknown> };

      assert.equal(retried.status, 200);
      assert.equal((retried.json["mission"] as { status: string }).status, "completed");
      assert.equal(retriedPipeline.metadata["missionRerun"], true);
      assert.equal(repositories.runtimeRepository.pipelineRuns.length, 2);
    });
  } finally {
    if (previousOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
    if (previousDocBaseUrl === undefined) {
      delete process.env.DOC_TO_MD_API_BASE_URL;
    } else {
      process.env.DOC_TO_MD_API_BASE_URL = previousDocBaseUrl;
    }
  }
});

test("POST /missions/:missionId/execute rejects multi-agent revisions instead of dropping agent context", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const missionId = "mission-multi-agent-runtime";
      const created = await repositories.missionRepository.createMission({
        missionId,
        title: "Coordinate a multi-agent mission",
        userGoal: "Run two assigned agents without losing their runtime context.",
        status: "needs_confirmation",
        riskLevel: "medium",
        plan: {
          missionId,
          title: "Coordinate a multi-agent mission",
          userGoal: "Run two assigned agents without losing their runtime context.",
          summary: "This revision deliberately has more than one assigned agent.",
          status: "needs_confirmation",
          riskLevel: "medium",
          steps: [
            {
              stepId: "step-1",
              title: "Prepare docs",
              objective: "Convert source documents.",
              skillId: "doc_to_md",
              moduleId: "doc_to_md",
              assignedAgentId: "knowledge_builder",
              role: "executor",
              dependsOn: [],
              status: "pending",
            },
            {
              stepId: "step-2",
              title: "Index docs",
              objective: "Build the RAG index.",
              skillId: "md_to_rag",
              moduleId: "md_to_rag",
              assignedAgentId: "second_agent",
              role: "executor",
              dependsOn: ["step-1"],
              status: "pending",
            },
          ],
          warnings: [],
          nonGoals: [],
        },
      });
      await postJson(baseUrl, `/missions/${missionId}/approve`, {
        revisionId: created.revision.revisionId,
      });

      const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId: created.revision.revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(executed.status, 400);
      assert.match(executed.text, /single assigned agent/i);
      assert.equal(repositories.runtimeRepository.pipelineRuns.length, 0);
    });
  });
});

test("POST /missions/:missionId/execute rejects an approved mission with an existing active runtime run", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Do not start a second runtime while a matching run is active.",
        agentId: "knowledge_builder",
        enabledSkillIds: ["doc_to_md", "md_to_rag", "rag_to_agent"],
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });
      const pipelineRun = await repositories.runtimeRepository.createPipelineRun({
        threadId: null,
        title: "Already active mission runtime",
        status: "running",
        activeModuleId: "doc_to_md",
        metadata: {
          missionExecutionSource: "mission-execute",
          missionId,
          revisionId,
          executionMode: "execute_ready",
        },
      });
      await createModuleRun(repositories.runtimeRepository, {
        moduleId: "doc_to_md",
        externalRunId: `${pipelineRun.id}:1:doc_to_md`,
        pipelineRunId: pipelineRun.id,
        title: "Already running ingestion",
        status: "running",
        inputJson: { missionId, revisionId },
        metadata: {
          missionId,
          revisionId,
          skillId: "doc_to_md",
        },
      });

      const duplicate = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(duplicate.status, 409);
      assert.match(duplicate.text, /already has an active execution run/i);
    });
  });
});

test("POST /missions/:missionId/execute creates mission-linked runtime, timeline, artifacts, and board projection", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Build and publish a traceable knowledge agent.",
        agentId: "knowledge_builder",
        enabledSkillIds: ["doc_to_md", "md_to_rag", "rag_to_agent"],
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;

      const approved = await postJson(baseUrl, `/missions/${missionId}/approve`, {
        revisionId,
        approvedBy: "route-test",
      });
      assert.equal(approved.status, 200);

      const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(executed.status, 200);
      const pipelineRun = executed.json["pipelineRun"] as {
        id: string;
        threadId: string;
        metadata: Record<string, unknown>;
      };
      const thread = executed.json["thread"] as { id: string; metadata: Record<string, unknown> };
      const moduleRuns = executed.json["moduleRuns"] as Array<{
        id: string;
        pipelineRunId: string;
        moduleId: string;
        status: string;
        metadata: Record<string, unknown>;
      }>;

      assert.equal(typeof pipelineRun.id, "string");
      assert.equal(pipelineRun.metadata["missionId"], missionId);
      assert.equal(pipelineRun.metadata["revisionId"], revisionId);
      assert.equal(thread.id, pipelineRun.threadId);
      assert.equal(thread.metadata["missionId"], missionId);
      assert.equal(moduleRuns.length, 3);
      assert.equal(moduleRuns.every((run) => run.pipelineRunId === pipelineRun.id), true);
      assert.equal(moduleRuns.every((run) => run.metadata["missionId"] === missionId), true);
      assert.equal(moduleRuns.every((run) => run.metadata["revisionId"] === revisionId), true);
      assert.deepEqual(
        moduleRuns.map((run) => run.metadata["dagStepId"]),
        ["step-1", "step-2", "step-3"],
      );
      assert.equal(moduleRuns[2]?.metadata["adapterExecutionStatus"], "approval_required");

      const timeline = await getAgentRunTimeline(repositories.runtimeRepository, pipelineRun.id);
      assert.equal(timeline.pipelineRun.id, pipelineRun.id);
      assert.equal(timeline.messages.length >= 2, true);
      assert.equal(
        timeline.runEvents.some((event) => event.eventType === "tool.execution.fake_completed"),
        true,
      );
      assert.equal(
        timeline.runEvents.some((event) => event.eventType === "tool.interaction.requested"),
        true,
      );

      const artifacts = await repositories.runtimeRepository.listArtifacts({
        pipelineRunId: pipelineRun.id,
      });
      assert.equal(artifacts.length >= 1, true);
      assert.equal(artifacts[0]?.provenance?.["missionId"], missionId);
      assert.equal(artifacts[0]?.provenance?.["revisionId"], revisionId);
      assert.equal(artifacts[0]?.provenance?.["pipelineRunId"], pipelineRun.id);

      const board = await getJson(baseUrl, `/missions/${missionId}/board`);
      assert.equal(board.status, 200);
      const boardRows = board.json["board"] as Array<{
        status: string;
        moduleRunIds: string[];
        latestArtifacts: Array<{ artifactId: string }>;
      }>;
      assert.equal(boardRows.some((row) => row.status === "waiting_approval"), true);
      assert.equal(boardRows.some((row) => row.latestArtifacts.length > 0), true);
    });
  });
});

test("POST /missions/:missionId/execute rejects rerun while an approval pause is active", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Build and publish a traceable knowledge agent with approval.",
        agentId: "knowledge_builder",
        enabledSkillIds: ["doc_to_md", "md_to_rag", "rag_to_agent"],
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });

      const first = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });
      const duplicate = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(first.status, 200);
      assert.equal(duplicate.status, 409);
      assert.match(duplicate.text, /already has an active execution run/i);
      assert.equal(repositories.runtimeRepository.pipelineRuns.length, 1);
    });
  });
});

test("POST /missions/:missionId/execute still rejects an older active run beyond the recent page", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Build and publish a traceable knowledge agent with an older approval pause.",
        agentId: "knowledge_builder",
        enabledSkillIds: ["doc_to_md", "md_to_rag", "rag_to_agent"],
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });

      const first = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });
      assert.equal(first.status, 200);
      await new Promise((resolve) => setTimeout(resolve, 5));
      for (let index = 0; index < 125; index += 1) {
        await repositories.runtimeRepository.createPipelineRun({
          threadId: null,
          title: `Unrelated newer run ${index}`,
          status: "succeeded",
          activeModuleId: null,
          metadata: {
            missionExecutionSource: "mission-execute",
            missionId: `other-mission-${index}`,
            revisionId: `other-revision-${index}`,
          },
        });
      }

      const duplicate = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(duplicate.status, 409);
      assert.match(duplicate.text, /already has an active execution run/i);
    });
  });
});

test("mission runtime approvals resume the paused module and retain interaction provenance", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Build a knowledge agent that needs publish approval.",
        agentId: "knowledge_builder",
        enabledSkillIds: ["doc_to_md", "md_to_rag", "rag_to_agent"],
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });
      const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });
      assert.equal(executed.status, 200);

      const approvals = await listApprovalsService(repositories.runtimeRepository);
      const approval = approvals.find((item) => item.missionId === missionId);
      assert.ok(approval, "expected mission-scoped runtime approval");
      assert.equal(approval.revisionId, revisionId);
      assert.equal(approval.status, "pending");
      assert.equal(typeof approval.interactionId, "string");
      assert.equal(typeof approval.resumeHandle, "string");

      const approved = await approveApprovalRequest(
        repositories.runtimeRepository,
        approval.approvalId,
        { env: missionRuntimeEnv(), missionRepository: repositories.missionRepository },
      );
      assert.equal(approved.status, "approved");

      const resumedRun = await repositories.runtimeRepository.findModuleRunById(approval.moduleRunId);
      const interaction = resumedRun ? getCurrentInteraction(resumedRun) : null;
      assert.equal(resumedRun?.status, "succeeded");
      assert.equal(interaction?.interactionId, approval.interactionId);
      assert.equal(interaction?.status, "resumed");
      assert.equal(interaction?.response?.approved, true);
      assert.equal(interaction?.response?.resumeHandle, approval.resumeHandle);

      const events = await repositories.runtimeRepository.listRunEvents(approval.moduleRunId);
      assert.equal(
        events.some(
          (event) =>
            event.eventType === "tool.execution.resume_requested" &&
            event.payload?.["interactionId"] === approval.interactionId,
        ),
        true,
      );
      const artifacts = await repositories.runtimeRepository.listArtifacts({
        moduleRunId: approval.moduleRunId,
      });
      assert.equal(artifacts.length >= 1, true);
      assert.equal(artifacts[0]?.provenance?.["missionId"], missionId);
      assert.equal(artifacts[0]?.provenance?.["revisionId"], revisionId);
      assert.equal(artifacts[0]?.provenance?.["interactionId"], approval.interactionId);
    });
  });
});

test("POST /missions/:missionId/execute can rerun an executed revision from the same mission snapshot", async () => {
  await withMissionRuntimeEnv(async () => {
    await withMissionsApp(async (baseUrl, repositories) => {
      const created = await postJson(baseUrl, "/missions", {
        message: "Rerun the approved mission snapshot.",
        agentId: "knowledge_builder",
        enabledSkillIds: ["doc_to_md"],
      });
      const missionId = (created.json["mission"] as { missionId: string }).missionId;
      const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;
      await postJson(baseUrl, `/missions/${missionId}/approve`, { revisionId });

      const first = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });
      assert.equal(first.status, 200);
      const approval = (await listApprovalsService(repositories.runtimeRepository)).find(
        (item) => item.missionId === missionId,
      );
      assert.ok(approval, "expected a resumable approval before rerun");
      await approveApprovalRequest(repositories.runtimeRepository, approval.approvalId, {
        env: missionRuntimeEnv(),
      });

      const second = await postJson(baseUrl, `/missions/${missionId}/execute`, {
        revisionId,
        executionMode: "execute_ready",
      });

      assert.equal(second.status, 200);
      const firstRun = first.json["pipelineRun"] as { id: string; metadata: Record<string, unknown> };
      const secondRun = second.json["pipelineRun"] as { id: string; metadata: Record<string, unknown> };
      assert.notEqual(secondRun.id, firstRun.id);
      assert.equal(secondRun.metadata["missionId"], missionId);
      assert.equal(secondRun.metadata["revisionId"], revisionId);
      assert.equal(secondRun.metadata["missionRerun"], true);
    });
  });
});

test("POST /missions/:missionId/approve returns 409 for a stale revision", async () => {
  await withMissionsApp(async (baseUrl) => {
    const created = await postJson(baseUrl, "/missions", {
      message: "Draft a mission that will be revised before approval.",
      enabledSkillIds: ["doc_to_md"],
    });
    const missionId = (created.json["mission"] as { missionId: string }).missionId;
    const staleRevisionId = (created.json["revision"] as { revisionId: string }).revisionId;

    const revised = await postJson(baseUrl, `/missions/${missionId}/revise`, {
      instruction: "Add a newer revision.",
      expectedRevisionId: staleRevisionId,
    });
    assert.equal(revised.status, 200);

    const approved = await postJson(baseUrl, `/missions/${missionId}/approve`, {
      revisionId: staleRevisionId,
    });

    assert.equal(approved.status, 409);
    assert.match(approved.text, /latest draft revision/i);
  });
});

test("POST /missions/:missionId/execute returns 409 when the mission is not approved", async () => {
  await withMissionsApp(async (baseUrl) => {
    const created = await postJson(baseUrl, "/missions", {
      message: "Do not approve this mission yet.",
      enabledSkillIds: ["doc_to_md"],
    });
    const missionId = (created.json["mission"] as { missionId: string }).missionId;
    const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;

    const executed = await postJson(baseUrl, `/missions/${missionId}/execute`, {
      revisionId,
      executionMode: "execute_ready",
    });

    assert.equal(executed.status, 409);
    assert.match(executed.text, /must be approved/i);
  });
});

test("mission routes reject Portal-origin access without a verified token", async () => {
  await withMissionsApp(async (baseUrl) => {
    const created = await postJson(
      baseUrl,
      "/missions",
      {
        message: "Blocked portal mission.",
        enabledSkillIds: ["doc_to_md"],
      },
      { "X-AI-Interface-Surface": "agent-portal" },
    );

    assert.equal(created.status, 403);
    assert.match(created.text, /Portal access denied/);
  });
});

test("mission routes allow Portal-origin access with a verified token and support GET", async () => {
  const repositories = {
    missionRepository: new InMemoryMissionRepository(),
    configRepository: new InMemoryAgentConfigRepository(),
    runtimeRepository: new InMemoryAgentRuntimeRepository(),
  };
  await updateAgentConfig(repositories.configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "mission-v1",
    },
  });

  await withMissionsApp(async (baseUrl) => {
    const headers = {
      "X-AI-Interface-Surface": "agent-portal",
      "X-Portal-Token": "portal-secret-token",
    };
    const created = await postJson(baseUrl, "/missions", {
      message: "Allowed portal mission.",
      enabledSkillIds: ["doc_to_md"],
    }, headers);
    const missionId = (created.json["mission"] as { missionId: string }).missionId;

    const fetched = await getJson(baseUrl, `/missions/${missionId}`, headers);

    assert.equal(created.status, 201);
    assert.equal(fetched.status, 200);
    assert.equal((fetched.json["mission"] as { missionId: string }).missionId, missionId);
    assert.equal(fetched.text.includes("portal-secret-token"), false);
  }, repositories);
});

test("GET /missions/:missionId/board returns execution board projection", async () => {
  await withMissionsApp(async (baseUrl, repositories) => {
    const created = await postJson(baseUrl, "/missions", {
      message: "Show me the execution board.",
      enabledSkillIds: ["doc_to_md"],
    });
    const missionId = (created.json["mission"] as { missionId: string }).missionId;
    const revisionId = (created.json["revision"] as { revisionId: string }).revisionId;

    const approved = await postJson(baseUrl, `/missions/${missionId}/approve`, {
      revisionId,
      approvedBy: "route-test",
    });
    const approvedRevisionId = (approved.json["approvedRevision"] as { revisionId: string }).revisionId;

    const pipelineRun = await repositories.runtimeRepository.createPipelineRun({
      threadId: null,
      title: "Mission runtime",
      status: "pending",
      activeModuleId: null,
      metadata: {
        missionId,
        revisionId: approvedRevisionId,
      },
    });

    await createModuleRun(repositories.runtimeRepository, {
      moduleId: "doc_to_md",
      externalRunId: `${pipelineRun.id}:convert`,
      pipelineRunId: pipelineRun.id,
      title: "Doc converter",
      status: "running",
      registeredSkillIds: ["doc_to_md"],
      metadata: {
        missionId,
        revisionId: approvedRevisionId,
        agentId: "knowledge_builder",
        skillId: "doc_to_md",
        dagStepId: "step-1",
        action: "Converting approved docs",
      },
    });

    const response = await getJson(baseUrl, `/missions/${missionId}/board`);

    assert.equal(response.status, 200);
    assert.equal(response.json["missionId"], missionId);
    assert.equal(response.json["revisionId"], approvedRevisionId);
    assert.equal(Array.isArray(response.json["board"]), true);
    const boardAgent = (response.json["board"] as Array<{ status: string }>)[0];
    assert.ok(
      boardAgent?.status === "running" || boardAgent?.status === "waiting_approval",
      `Expected running or waiting_approval, got ${boardAgent?.status}`,
    );
  });
});

test("POST /missions with agentId uses only agent skill bindings", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await postJson(baseUrl, "/missions", {
      message: "Build a knowledge base from approved docs.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["md_to_rag", "rag_to_agent"],
    });

    assert.equal(response.status, 201);
    const plan = response.json["plan"] as {
      steps: Array<{ skillId: string; assignedAgentId: string }>;
    };
    const skillIds = plan.steps.map((s) => s.skillId);
    assert.deepStrictEqual(skillIds, ["md_to_rag", "rag_to_agent"]);
    assert.equal(plan.steps.every((s) => s.assignedAgentId === "knowledge_builder"), true);
  });
});

test("POST /missions with agentId rejects cross-agent skill ids", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await postJson(baseUrl, "/missions", {
      message: "Run a cross-agent mission.",
      agentId: "knowledge_builder",
      enabledSkillIds: ["climate_monitor"],
    });

    assert.equal(response.status, 400);
    assert.match(
      response.text,
      /does not declare the following skill bindings:/i,
    );
  });
});

test("POST /missions without agentId allows any registered skill", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await postJson(baseUrl, "/missions", {
      message: "Run a generic mission with any skill.",
      enabledSkillIds: ["doc_to_md", "md_to_rag", "climate_monitor"],
    });

    assert.equal(response.status, 201);
  });
});

test("POST /missions returns 400 for an empty message", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await postJson(baseUrl, "/missions", {
      message: "   ",
      enabledSkillIds: ["doc_to_md"],
    });

    assert.equal(response.status, 400);
  });
});

test("POST /missions returns 400 for an unknown agentId", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await postJson(baseUrl, "/missions", {
      message: "Mission with a missing agent.",
      agentId: "nonexistent_agent",
      enabledSkillIds: ["doc_to_md"],
    });

    assert.equal(response.status, 400);
    assert.match(response.text, /not registered/i);
  });
});

test("GET /missions/:missionId returns 404 for an unknown mission", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await getJson(baseUrl, "/missions/nonexistent-mission-id");

    assert.equal(response.status, 404);
  });
});

test("POST /missions/:missionId/revise returns 404 for an unknown mission", async () => {
  await withMissionsApp(async (baseUrl) => {
    const response = await postJson(baseUrl, "/missions/unknown-mission/revise", {
      instruction: "Revise a missing mission.",
      expectedRevisionId: "00000000-0000-0000-0000-000000000001",
    });

    assert.equal(response.status, 404);
  });
});
