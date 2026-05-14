import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import { createSkillManifestRegistry } from "../skill-runtime/skill-manifest";
import { createSkillsRouter } from "./skills";

async function withSkillsApp<T>(
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(
    createSkillsRouter(
      createSkillManifestRegistry(),
      {},
      () => false,
    ),
  );

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : undefined;
  assert.equal(typeof port, "number");

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("/skills returns built-in manifests and readiness", async () => {
  const response = await withSkillsApp((baseUrl) => fetch(`${baseUrl}/skills`));
  const json = (await response.json()) as {
    skills: Array<{
      skillId: string;
      project: { defaultSiblingPath: string };
      ui: { mode: string; openOnTrigger: boolean };
    }>;
    readiness: Array<{
      skillId: string;
      project: { status: string; defaultSiblingPath: string };
    }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.skills.map((skill) => skill.skillId),
    [
      "web_listening",
      "doc_to_md",
      "md_to_rag",
      "rag_to_agent",
      "climate_monitor",
    ],
  );
  assert.equal(json.skills[0]?.project.defaultSiblingPath, "../web_listening");
  assert.equal(json.skills[0]?.ui.mode, "html");
  assert.equal(json.skills[0]?.ui.openOnTrigger, true);
  assert.deepEqual(
    json.readiness.map((item) => [item.skillId, item.project.status]),
    [
      ["web_listening", "not_configured"],
      ["doc_to_md", "not_configured"],
      ["md_to_rag", "not_configured"],
      ["rag_to_agent", "not_configured"],
      ["climate_monitor", "not_configured"],
    ],
  );
});
