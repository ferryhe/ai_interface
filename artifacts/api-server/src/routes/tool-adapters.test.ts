import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";
import { createToolAdaptersRouter } from "./tool-adapters";

async function withToolAdaptersApp<T>(
  callback: (baseUrl: string) => Promise<T>,
  manifests: SkillManifest[],
): Promise<T> {
  const app = express();
  app.use(
    createToolAdaptersRouter(createSkillRuntimeRegistry(manifests), {}, {
      pathExists: () => false,
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
      kind: "http",
      adapterId: "custom_reporter.http.v1",
      requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      optionalEnv: ["CUSTOM_REPORTER_API_TOKEN"],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: [],
      supportsResume: true,
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
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  };
}

test("/tool-adapters can be served from an injected custom registry", async () => {
  const response = await withToolAdaptersApp(
    (baseUrl) => fetch(`${baseUrl}/tool-adapters`),
    [customReporterManifest()],
  );
  const json = (await response.json()) as {
    adapters: Array<{
      adapterId: string;
      moduleId: string;
      requiredEnv: string[];
    }>;
    readiness: Array<{
      adapterId: string;
      status: string;
      missingRequiredEnv: string[];
    }>;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.adapters.map((adapter) => adapter.adapterId),
    ["custom_reporter.http.v1"],
  );
  assert.deepEqual(json.adapters[0]?.requiredEnv, [
    "CUSTOM_REPORTER_API_BASE_URL",
  ]);
  assert.deepEqual(json.readiness, [
    {
      adapterId: "custom_reporter.http.v1",
      moduleId: "custom_reporter",
      adapterKind: "http",
      displayName: "Custom Reporter Adapter",
      description: "Create custom reports from artifacts.",
      sourceRepo: "",
      requiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      optionalEnv: ["CUSTOM_REPORTER_API_TOKEN"],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: [],
      supportsResume: true,
      readinessHint:
        "Configure custom_reporter.http.v1 to enable skill handoffs.",
      configured: false,
      status: "missing_required_env",
      missingRequiredEnv: ["CUSTOM_REPORTER_API_BASE_URL"],
      configuredOptionalEnv: [],
    },
  ]);
});
