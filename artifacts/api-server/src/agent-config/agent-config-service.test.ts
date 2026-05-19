import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryAgentConfigRepository,
  createDefaultBusinessSkillSettings,
  getAgentConfig,
  getConnectionStatus,
  toPublicAgentConfig,
  updateAgentConfig,
  verifyPortalAccess,
} from "./agent-config-service";
import type { SkillManifest } from "../skill-runtime/skill-manifest";
import { createSkillRuntimeRegistry } from "../skill-runtime/skill-runtime-registry";

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
      kind: "internal",
      adapterId: "custom_reporter.internal.v1",
      requiredEnv: [],
      optionalEnv: [],
      timeoutMs: 45000,
      maxOutputBytes: 131072,
      allowedCommands: [],
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
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  };
}

function communityReporterManifest(): SkillManifest {
  return {
    ...customReporterManifest(),
    skillId: "community_reporter",
    moduleId: "community_reporter",
    name: "Community Reporter",
    project: {
      source: "community",
      defaultSiblingPath: "skills/community/community_reporter",
    },
  };
}

function localCustomReporterManifest(): SkillManifest {
  return {
    ...customReporterManifest(),
    skillId: "local_custom_reporter",
    moduleId: "local_custom_reporter",
    name: "Local Custom Reporter",
    project: {
      source: "custom",
      defaultSiblingPath: "skills/custom/local_custom_reporter",
    },
  };
}

test("creates the default agent config with business and general skills", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const config = await getAgentConfig(repository);

  assert.equal(config.provider, "openai");
  assert.equal(config.endpoint, "responses");
  assert.equal(config.modelId, "gpt-5.5");
  assert.equal(config.reasoningEffort, "medium");
  assert.deepEqual(
    config.businessSkillSettings.map((skill) => skill.moduleId),
    [
      "web_listening",
      "doc_to_md",
      "md_to_rag",
      "rag_to_agent",
      "climate_monitor",
      "example_reporter",
    ],
  );
  const climateMonitor = config.businessSkillSettings.find(
    (skill) => skill.moduleId === "climate_monitor",
  );
  assert.equal(climateMonitor?.approvalRequired, true);
  assert.equal(climateMonitor?.canUseNetwork, true);
  const builtInSettings = config.businessSkillSettings.filter((skill) =>
    [
      "web_listening",
      "doc_to_md",
      "md_to_rag",
      "rag_to_agent",
      "climate_monitor",
    ].includes(skill.moduleId),
  );
  assert.deepEqual(
    builtInSettings.map((skill) => skill.enabled),
    [true, true, true, true, true],
  );
  const exampleReporter = config.businessSkillSettings.find(
    (skill) => skill.moduleId === "example_reporter",
  );
  assert.equal(exampleReporter?.enabled, false);
  assert.equal(exampleReporter?.approvalRequired, true);
  assert.deepEqual(
    config.generalSkillSettings.map((skill) => skill.skillId),
    ["web_search", "browser", "github", "notion", "lark", "file_tools"],
  );
  assert.equal(config.generalSkillSettings[0]?.installOnDemand, true);
  assert.equal(config.generalSkillSettings[0]?.requiresApproval, true);
  assert.equal(config.memorySettings.longTermEnabled, true);
  assert.equal(repository.configs.length, 1);
});

test("creates default publish settings without a portal token", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const config = await getAgentConfig(repository);

  assert.equal(config.publishSettings.status, "draft");
  assert.equal(config.publishSettings.portalAccessMode, "token");
  assert.equal(config.publishSettings.portalTokenHash, null);
  assert.equal(config.publishSettings.portalTokenLast4, null);
  assert.equal(config.publishSettings.versionLabel, "draft-0.3");
});

test("creates default business skill settings from an injected registry", () => {
  const settings = createDefaultBusinessSkillSettings(
    createSkillRuntimeRegistry([customReporterManifest()]),
  );

  assert.deepEqual(settings, [
    {
      moduleId: "custom_reporter",
      enabled: true,
      approvalRequired: false,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  ]);
});

test("disables community and custom skills by default", () => {
  const settings = createDefaultBusinessSkillSettings(
    createSkillRuntimeRegistry([
      customReporterManifest(),
      communityReporterManifest(),
      localCustomReporterManifest(),
    ]),
  );

  assert.deepEqual(
    settings.map((setting) => [setting.moduleId, setting.enabled]),
    [
      ["custom_reporter", true],
      ["community_reporter", false],
      ["local_custom_reporter", false],
    ],
  );
});

test("updates model, business skills, general skills, memory, and safety settings", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const updated = await updateAgentConfig(repository, {
    modelId: "gpt-5.4-mini",
    reasoningEffort: "high",
    businessSkillSettings: [
      {
        moduleId: "web_listening",
        enabled: false,
        approvalRequired: true,
        canUseNetwork: true,
        canWriteDatabase: true,
      },
    ],
    generalSkillSettings: [
      {
        skillId: "github",
        name: "GitHub",
        description: "Inspect repositories, issues, pull requests, and CI status.",
        enabled: true,
        installed: false,
        installOnDemand: true,
        requiresApproval: true,
        canUseNetwork: true,
      },
    ],
    memorySettings: {
      shortTermEnabled: true,
      longTermEnabled: false,
      promotionMode: "manual",
      ragCollection: "configure-test",
      retentionDays: 14,
    },
    safetySettings: {
      requireApprovalForExternalActions: true,
      requireApprovalForPublishing: true,
      allowSelfLearning: false,
      maxToolSteps: 8,
    },
  });

  assert.equal(updated.modelId, "gpt-5.4-mini");
  assert.equal(updated.reasoningEffort, "high");
  assert.equal(updated.businessSkillSettings[0]?.enabled, false);
  assert.equal(updated.generalSkillSettings[0]?.skillId, "github");
  assert.equal(updated.generalSkillSettings[0]?.enabled, true);
  assert.equal(updated.memorySettings.longTermEnabled, false);
  assert.equal(updated.safetySettings.maxToolSteps, 8);
});

test("updates publish settings and hashes portal token without returning plaintext", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const updated = await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  assert.equal(updated.publishSettings.status, "published");
  assert.equal(updated.publishSettings.portalAccessMode, "token");
  assert.equal(updated.publishSettings.portalTokenLast4, "oken");
  assert.equal(updated.publishSettings.portalTokenHash?.length, 64);
  assert.notEqual(updated.publishSettings.portalTokenHash, "portal-secret-token");
  assert.equal(JSON.stringify(updated).includes("portal-secret-token"), false);
  assert.ok(updated.publishSettings.portalTokenUpdatedAt);
  assert.ok(updated.publishSettings.publishedAt);
});

test("redacts portal token hash from public agent config", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const updated = await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });
  const publicConfig = toPublicAgentConfig(updated);

  assert.equal("portalTokenHash" in publicConfig.publishSettings, false);
  assert.equal(
    JSON.stringify(publicConfig).includes(updated.publishSettings.portalTokenHash!),
    false,
  );
  assert.equal(JSON.stringify(publicConfig).includes("portal-secret-token"), false);
  assert.equal(publicConfig.publishSettings.portalTokenLast4, "oken");
});

test("keeps existing portal token when publish settings update omits token", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const withToken = await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });
  const updated = await updateAgentConfig(repository, {
    publishSettings: {
      status: "paused",
      portalAccessMode: "token",
      versionLabel: "agent-v1-paused",
    },
  });

  assert.equal(updated.publishSettings.status, "paused");
  assert.equal(
    updated.publishSettings.portalTokenHash,
    withToken.publishSettings.portalTokenHash,
  );
  assert.equal(updated.publishSettings.portalTokenLast4, "oken");
});

test("portal access verification rejects missing tokens", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const result = await verifyPortalAccess(repository, "   ");

  assert.equal(result.status, "missing_token");
  assert.equal(result.authorized, false);
  assert.equal(result.publishStatus, "draft");
  assert.equal(result.portalTokenLast4, null);
});

test("portal access verification blocks unpublished configs", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "draft",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "draft-build",
    },
  });

  const result = await verifyPortalAccess(repository, "portal-secret-token");

  assert.equal(result.status, "not_published");
  assert.equal(result.authorized, false);
  assert.equal(result.publishStatus, "draft");
  assert.equal(result.versionLabel, "draft-build");
  assert.equal(result.portalTokenLast4, "oken");
});

test("portal access verification rejects wrong tokens", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const result = await verifyPortalAccess(repository, "wrong-token");

  assert.equal(result.status, "invalid_token");
  assert.equal(result.authorized, false);
  assert.equal(result.publishStatus, "published");
  assert.equal(result.versionLabel, "agent-v1");
  assert.equal(JSON.stringify(result).includes("portal-secret-token"), false);
});

test("portal access verification authorizes a published matching token", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const result = await verifyPortalAccess(repository, "portal-secret-token");

  assert.equal(result.status, "authorized");
  assert.equal(result.authorized, true);
  assert.equal(result.publishStatus, "published");
  assert.equal(result.portalTokenLast4, "oken");
  assert.equal(result.versionLabel, "agent-v1");
  assert.ok(result.checkedAt);
  assert.equal(JSON.stringify(result).includes("portal-secret-token"), false);
});

test("detects OpenAI API key status without exposing secrets", () => {
  assert.deepEqual(getConnectionStatus({}), { status: "missing_key" });
  assert.deepEqual(getConnectionStatus({ OPENAI_API_KEY: "" }), {
    status: "missing_key",
  });
  assert.deepEqual(getConnectionStatus({ OPENAI_API_KEY: "sk-test-secret" }), {
    status: "configured",
  });
});
