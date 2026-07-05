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
import { createApprovalsRouter } from "./approvals";

async function withApprovalsApp<T>(
  callback: (
    baseUrl: string,
    repositories: {
      runtimeRepository: InMemoryAgentRuntimeRepository;
      configRepository: InMemoryAgentConfigRepository;
    },
  ) => Promise<T>,
  options: {
    env?: Record<string, string | undefined>;
    repositories?: {
      runtimeRepository: InMemoryAgentRuntimeRepository;
      configRepository: InMemoryAgentConfigRepository;
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
      { env: options.env },
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
