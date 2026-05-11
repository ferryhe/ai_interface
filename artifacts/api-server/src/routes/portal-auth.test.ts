import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import { createPortalAuthRouter } from "./portal-auth";

async function requestPortalVerify(
  repository: InMemoryAgentConfigRepository,
  body: unknown,
): Promise<{ status: number; text: string; json: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use(createPortalAuthRouter(repository));

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/portal-auth/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const text = await response.text();
    return {
      status: response.status,
      text,
      json: JSON.parse(text) as Record<string, unknown>,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("portal auth route rejects invalid request bodies", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const response = await requestPortalVerify(repository, {});

  assert.equal(response.status, 400);
  assert.equal(typeof response.json["error"], "string");
});

test("portal auth route returns missing_token for blank tokens", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const response = await requestPortalVerify(repository, { token: "   " });

  assert.equal(response.status, 200);
  assert.equal(response.json["status"], "missing_token");
  assert.equal(response.json["authorized"], false);
});

test("portal auth route blocks unpublished configs without exposing token secrets", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "draft",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "draft-build",
    },
  });

  const response = await requestPortalVerify(repository, {
    token: "portal-secret-token",
  });

  assert.equal(response.status, 200);
  assert.equal(response.json["status"], "not_published");
  assert.equal(response.json["authorized"], false);
  assert.equal(response.text.includes("portal-secret-token"), false);
  assert.equal(response.text.includes("portalTokenHash"), false);
});

test("portal auth route rejects wrong tokens without exposing token secrets", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const response = await requestPortalVerify(repository, { token: "wrong-token" });

  assert.equal(response.status, 200);
  assert.equal(response.json["status"], "invalid_token");
  assert.equal(response.json["authorized"], false);
  assert.equal(response.text.includes("portal-secret-token"), false);
  assert.equal(response.text.includes("portalTokenHash"), false);
});

test("portal auth route authorizes matching published tokens without exposing token secrets", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const response = await requestPortalVerify(repository, {
    token: "portal-secret-token",
  });

  assert.equal(response.status, 200);
  assert.equal(response.json["status"], "authorized");
  assert.equal(response.json["authorized"], true);
  assert.equal(response.json["versionLabel"], "agent-v1");
  assert.equal(response.text.includes("portal-secret-token"), false);
  assert.equal(response.text.includes("portalTokenHash"), false);
});
