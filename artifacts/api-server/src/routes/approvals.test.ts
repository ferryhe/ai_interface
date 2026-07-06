import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import { InMemoryAgentRuntimeRepository } from "../agent-runtime/agent-runtime-service";
import {
  createModuleRun,
  requestModuleRunInteraction,
} from "../modules/ingest-service";
import { InMemoryMissionRepository } from "../mission/in-memory-mission-repository";
import { builtinSkillManifests, type SkillManifest } from "../skill-runtime/skill-manifest";
import {
  createSkillRuntimeRegistry,
  type SkillRuntimeRegistry,
} from "../skill-runtime/skill-runtime-registry";
import { createApprovalsRouter } from "./approvals";

async function withApprovalsApp<T>(
  callback: (
    baseUrl: string,
    repositories: {
      runtimeRepository: InMemoryAgentRuntimeRepository;
      configRepository: InMemoryAgentConfigRepository;
      missionRepository?: InMemoryMissionRepository;
    },
  ) => Promise<T>,
  options: {
    env?: Record<string, string | undefined>;
    registry?: SkillRuntimeRegistry;
    repositories?: {
      runtimeRepository: InMemoryAgentRuntimeRepository;
      configRepository: InMemoryAgentConfigRepository;
      missionRepository?: InMemoryMissionRepository;
    };
  } = {},
): Promise<T> {
  const repositories =
    options.repositories ?? {
      runtimeRepository: new InMemoryAgentRuntimeRepository(),
      configRepository: new InMemoryAgentConfigRepository(),
    };

  const app = express();
  app.use(express.json());
  app.use(
    createApprovalsRouter(
      repositories.runtimeRepository,
      repositories.configRepository,
      {
        env: options.env,
        missionRepository: repositories.missionRepository,
        registry: options.registry,
      },
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

async function createPendingApproval(
  repository: InMemoryAgentRuntimeRepository,
  input: {
    action?: string;
    reason?: string;
    missionId?: string;
    revisionId?: string;
    approvalRequestedAt?: unknown;
  } = {},
): Promise<{ approvalId: string; runId: string }> {
  const missionId = input.missionId ?? "mission-route";
  const revisionId = input.revisionId ?? "revision-route";
  const pipelineRun = await repository.createPipelineRun({
    threadId: null,
    title: "Inbox pipeline",
    status: "running",
    activeModuleId: "doc_to_md",
    metadata: {
      missionId,
      revisionId,
    },
  });

  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `${pipelineRun.id}:1:doc_to_md`,
    pipelineRunId: pipelineRun.id,
    title: "Convert inbox document",
    inputJson: { topic: "routes" },
    metadata: {
      missionId,
      revisionId,
      action: input.action ?? "Approve deployment token «redacted:sk-…»",
      approvalReason:
        input.reason ??
        "Reads /home/ec2-user/work/Secret Project/.env before publishing.",
      approvalRiskLevel: "high",
      adapterExecutionStatus: "approval_required",
      requiresApproval: true,
      stepId: "publish-agent",
      skillId: "doc_to_md",
      adapterKind: "http",
      ...(input.approvalRequestedAt !== undefined
        ? { approvalRequestedAt: input.approvalRequestedAt }
        : {}),
    },
  });

  const requested = await requestModuleRunInteraction(repository, run.id, {
    kind: "approval",
    title: input.action ?? "Approve deployment token sk-route-token-12345678",
    message:
      input.reason ??
      "Reads /home/ec2-user/work/Secret Project/.env before publishing.",
    resumeHandle: `doc_to_md:${run.externalRunId}:resume`,
    metadata: {
      action: input.action ?? "Approve deployment token sk-route-token-12345678",
      reason:
        input.reason ??
        "Reads /home/ec2-user/work/Secret Project/.env before publishing.",
      riskLevel: "high",
      stepId: "publish-agent",
      toolKind: "http",
    },
  });

  return { approvalId: requested.interaction.interactionId, runId: run.id };
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

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
      repoUrl: "https://example.com/custom-reporter",
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    artifactKinds: ["report_markdown"],
    interactionKinds: ["approval"],
    execution: {
      kind: "http",
      adapterId: "custom_reporter.http.v1",
      supportsResume: true,
      timeoutMs: 30000,
      maxOutputBytes: 65536,
      requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      optionalEnv: [],
      allowedCommands: [],
    },
    ui: {
      mode: "auto",
      preferredRenderer: "markdown",
      openOnTrigger: false,
    },
    permissions: {
      approvalRequired: true,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  };
}

test("GET /approvals lists pending approvals with redaction", async () => {
  await withApprovalsApp(
    async (baseUrl, { runtimeRepository }) => {
      await createPendingApproval(runtimeRepository);

      const response = await fetch(`${baseUrl}/approvals`);
      const text = await response.text();
      const json = JSON.parse(text) as { approvals: Array<Record<string, unknown>> };

      assert.equal(response.status, 200);
      assert.equal(json.approvals.length, 1);
      assert.equal(text.includes("«redacted:sk-…»"), false);
      assert.equal(text.includes("/home/ec2-user/work/Secret Project/.env"), false);
      assert.match(text, /\[redacted\]/);
    },
    {
      env: {
        OPENAI_API_KEY: "«redacted:sk-…»",
        SECRET_PROJECT_PATH: "/home/ec2-user/work/Secret Project/.env",
      },
    },
  );
});

test("GET /approvals can scope results to the current mission", async () => {
  await withApprovalsApp(async (baseUrl, { runtimeRepository }) => {
    await createPendingApproval(runtimeRepository, {
      missionId: "mission-current",
      action: "Approve current mission publish",
    });
    await createPendingApproval(runtimeRepository, {
      missionId: "mission-other",
      action: "Approve unrelated publish",
    });

    const response = await fetch(`${baseUrl}/approvals?missionId=mission-current`);
    const json = JSON.parse(await response.text()) as { approvals: Array<Record<string, unknown>> };

    assert.equal(response.status, 200);
    assert.equal(json.approvals.length, 1);
    assert.equal(json.approvals[0]?.["missionId"], "mission-current");
    assert.equal(json.approvals[0]?.["action"], "Approve current mission publish");
  });
});

test("GET /approvals normalizes invalid approval requested timestamps before contract validation", async () => {
  await withApprovalsApp(async (baseUrl, { runtimeRepository }) => {
    await createPendingApproval(runtimeRepository, {
      action: "Approve malformed metadata timestamp",
      approvalRequestedAt: "not-a-date",
    });

    const response = await fetch(`${baseUrl}/approvals`);
    const json = JSON.parse(await response.text()) as { approvals: Array<Record<string, unknown>> };
    const requestedAt = json.approvals[0]?.["requestedAt"];

    assert.equal(response.status, 200);
    assert.equal(json.approvals.length, 1);
    assert.notEqual(requestedAt, "not-a-date", "invalid metadata timestamp must not leak through");
    assert.equal(Number.isNaN(Date.parse(String(requestedAt))), false);
  });
});

test("POST /approvals/:approvalId/approve allows admin access", async () => {
  await withApprovalsApp(
    async (baseUrl, { runtimeRepository }) => {
      const fixture = await createPendingApproval(runtimeRepository, {
        action: "Approve doc import",
        reason: "Human review is required before import.",
      });

      const response = await fetch(
        `${baseUrl}/approvals/${encodeURIComponent(fixture.approvalId)}/approve`,
        { method: "POST" },
      );
      const json = await responseJson(response);

      assert.equal(response.status, 200);
      assert.equal(
        (json["approval"] as { status?: string }).status,
        "approved",
      );
    },
    { env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" } },
  );
});

test("POST /approvals/:approvalId/approve forwards custom registry for downstream mission steps", async () => {
  const registry = createSkillRuntimeRegistry([
    ...builtinSkillManifests,
    customReporterManifest(),
  ]);
  await withApprovalsApp(
    async (baseUrl, { runtimeRepository }) => {
      const pipelineRun = await runtimeRepository.createPipelineRun({
        threadId: null,
        title: "Custom registry approval pipeline",
        status: "running",
        activeModuleId: "doc_to_md",
        metadata: {
          missionExecutionSource: "mission-execute",
          missionId: "mission-custom-registry",
          revisionId: "revision-custom-registry",
        },
      });

      const { run: approvalRun } = await createModuleRun(runtimeRepository, {
        moduleId: "doc_to_md",
        externalRunId: `${pipelineRun.id}:1:doc_to_md`,
        pipelineRunId: pipelineRun.id,
        title: "Approve source conversion",
        inputJson: { topic: "routes" },
        metadata: {
          missionExecutionSource: "mission-execute",
          missionId: "mission-custom-registry",
          revisionId: "revision-custom-registry",
          action: "Approve source conversion",
          approvalReason: "Custom registry successor waits for this approval.",
          adapterExecutionStatus: "approval_required",
          requiresApproval: true,
          dagStepId: "step-1",
          dagDependsOn: [],
          skillId: "doc_to_md",
          agentId: "knowledge_builder",
          adapterKind: "http",
        },
      });
      const requested = await requestModuleRunInteraction(runtimeRepository, approvalRun.id, {
        kind: "approval",
        title: "Approve source conversion",
        message: "Custom registry successor waits for this approval.",
        resumeHandle: `doc_to_md:${approvalRun.externalRunId}:resume`,
        metadata: {
          action: "Approve source conversion",
          reason: "Custom registry successor waits for this approval.",
          riskLevel: "high",
          stepId: "step-1",
          toolKind: "http",
        },
      });
      await runtimeRepository.updateModuleRun(approvalRun.id, {
        status: "pending",
        metadata: {
          ...requested.run.metadata,
          adapterExecutionStatus: "approval_required",
        },
      });

      const { run: customRun } = await createModuleRun(
        runtimeRepository,
        {
          moduleId: "custom_reporter_module",
          externalRunId: `${pipelineRun.id}:2:custom_reporter_module`,
          pipelineRunId: pipelineRun.id,
          title: "Create custom report",
          inputJson: { topic: "routes" },
          metadata: {
            missionExecutionSource: "mission-execute",
            missionId: "mission-custom-registry",
            revisionId: "revision-custom-registry",
            action: "Create custom report",
            requiresApproval: false,
            dagStepId: "step-2",
            dagDependsOn: ["step-1"],
            dagExecutionStatus: "blocked",
            dagBlockedReason: "approval_required",
            dagBlockedByStepIds: ["step-1"],
            skillId: "custom_reporter",
            agentId: "knowledge_builder",
            adapterKind: "http",
          },
        },
        { registry },
      );

      const response = await fetch(
        `${baseUrl}/approvals/${encodeURIComponent(requested.interaction.interactionId)}/approve`,
        { method: "POST" },
      );
      const text = await response.text();

      assert.equal(response.status, 200, text);
      const resumedCustomRun = await runtimeRepository.findModuleRunById(customRun.id);
      assert.equal(resumedCustomRun?.status, "succeeded");
      assert.equal(
        resumedCustomRun?.metadata?.["adapterId"],
        "custom_reporter.http.v1",
      );
    },
    {
      registry,
      env: {
        DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
        CUSTOM_REPORTER_API_BASE_URL: "https://report.example.internal",
      },
    },
  );
});

test("POST /approvals/:approvalId/approve skips mission reconciliation for non-mission runs", async () => {
  const repositories = {
    runtimeRepository: new InMemoryAgentRuntimeRepository(),
    configRepository: new InMemoryAgentConfigRepository(),
    missionRepository: new InMemoryMissionRepository(),
  };

  await withApprovalsApp(
    async (baseUrl) => {
      const fixture = await createPendingApproval(repositories.runtimeRepository, {
        missionId: "agent-run-derived-mission-id",
        revisionId: "agent-run-derived-revision-id",
        action: "Approve regular agent run",
        reason: "This approval is not linked to a Mission execution.",
      });

      const response = await fetch(
        `${baseUrl}/approvals/${encodeURIComponent(fixture.approvalId)}/approve`,
        { method: "POST" },
      );
      const json = await responseJson(response);

      assert.equal(response.status, 200);
      assert.equal((json["approval"] as { status?: string }).status, "approved");
    },
    {
      repositories,
      env: { DOC_TO_MD_API_BASE_URL: "https://doc.example.internal" },
    },
  );
});

test("approval routes reject portal access without a token", async () => {
  await withApprovalsApp(async (baseUrl, { runtimeRepository }) => {
    const fixture = await createPendingApproval(runtimeRepository);

    const response = await fetch(
      `${baseUrl}/approvals/${encodeURIComponent(fixture.approvalId)}/reject`,
      {
        method: "POST",
        headers: { "X-AI-Interface-Surface": "agent-portal" },
      },
    );

    assert.equal(response.status, 403);
    assert.match(await response.text(), /Portal access denied/);
  });
});

test("approval routes allow portal access with a verified token", async () => {
  const repositories = {
    runtimeRepository: new InMemoryAgentRuntimeRepository(),
    configRepository: new InMemoryAgentConfigRepository(),
  };
  await updateAgentConfig(repositories.configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "approval-v1",
    },
  });

  await withApprovalsApp(async (baseUrl) => {
    const fixture = await createPendingApproval(repositories.runtimeRepository, {
      action: "Approve portal import",
      reason: "Portal approval should be accepted.",
    });

    const response = await fetch(
      `${baseUrl}/approvals/${encodeURIComponent(fixture.approvalId)}/reject`,
      {
        method: "POST",
        headers: {
          "X-AI-Interface-Surface": "agent-portal",
          "X-Portal-Token": "portal-secret-token",
        },
      },
    );
    const text = await response.text();
    const json = JSON.parse(text) as { approval: { status: string } };

    assert.equal(response.status, 200);
    assert.equal(json.approval.status, "rejected");
    assert.equal(text.includes("portal-secret-token"), false);
  }, { repositories });
});
