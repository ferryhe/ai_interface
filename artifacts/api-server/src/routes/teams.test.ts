import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";

import type { AgentManifest } from "../agent-registry/agent-manifest";
import { createAgentRuntimeRegistry } from "../agent-registry/agent-runtime-registry";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import { createTeamsRouter } from "./teams";

function agent(agentId: string, teamId?: string): AgentManifest {
  return {
    agentId,
    name: agentId,
    description: `${agentId} fixture.`,
    source: "custom",
    instructions: "Use approved skills.",
    skills: [],
    planner: {
      mode: "linear",
      failureStrategy: "fail_fast",
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: false,
    },
    memory: {
      promotionMode: "disabled",
    },
    handoffs: [],
    tests: [],
    ...(teamId ? { teamId } : {}),
  };
}

async function withTeamsApp<T>(
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  const registry = createAgentRuntimeRegistry(
    [
      agent("pricing_actuary", "insurance"),
      agent("claims_reviewer", "insurance"),
      agent("knowledge_builder", "knowledge"),
      agent("unassigned_agent"),
    ],
    createSkillRuntimeRegistry([]),
  );

  app.use(
    createTeamsRouter(registry, {
      teamRegistry: {
        insurance: {
          displayName: "Insurance",
          description: "Life insurance operations.",
          industries: ["life_insurance"],
        },
        knowledge: {
          displayName: "Knowledge",
          description: "Knowledge engineering.",
          industries: [],
        },
      },
    }),
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

test("/teams serves injected team registry with derived members", async () => {
  const response = await withTeamsApp((baseUrl) => fetch(`${baseUrl}/teams`));
  const json = (await response.json()) as {
    teams: Array<{
      teamId: string;
      displayName: string;
      memberAgentIds: string[];
    }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(json.teams, [
    {
      teamId: "insurance",
      displayName: "Insurance",
      description: "Life insurance operations.",
      industries: ["life_insurance"],
      memberAgentIds: ["pricing_actuary", "claims_reviewer"],
    },
    {
      teamId: "knowledge",
      displayName: "Knowledge",
      description: "Knowledge engineering.",
      industries: [],
      memberAgentIds: ["knowledge_builder"],
    },
  ]);
});

test("team registry YAML errors include the registry path", async () => {
  const root = join(tmpdir(), `teams-router-${Date.now()}`);
  const teamsDir = join(root, "teams");
  await mkdir(join(root, "agents", "builtin"), { recursive: true });
  await mkdir(teamsDir, { recursive: true });
  const registryPath = join(teamsDir, "team-registry.yaml");
  await writeFile(registryPath, "teams:\n  insurance: [", "utf8");
  const registry = createAgentRuntimeRegistry([], createSkillRuntimeRegistry([]));

  assert.throws(
    () => createTeamsRouter(registry, { cwd: root }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Failed to load team registry") &&
      error.message.includes(registryPath),
  );
});
