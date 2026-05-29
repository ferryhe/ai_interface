import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import { InMemoryMissionRepository } from "../mission/in-memory-mission-repository";
import { createMissionsRouter } from "./missions";

async function withMissionsApp<T>(
  callback: (baseUrl: string, repositories: {
    missionRepository: InMemoryMissionRepository;
    configRepository: InMemoryAgentConfigRepository;
  }) => Promise<T>,
  repositories = {
    missionRepository: new InMemoryMissionRepository(),
    configRepository: new InMemoryAgentConfigRepository(),
  },
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(createMissionsRouter(repositories.missionRepository, repositories.configRepository));

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
