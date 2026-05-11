import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryAgentConfigRepository,
  getAgentConfig,
  getConnectionStatus,
  updateAgentConfig,
} from "./agent-config-service";

test("creates the default agent config from registered modules", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const config = await getAgentConfig(repository);

  assert.equal(config.provider, "openai");
  assert.equal(config.endpoint, "responses");
  assert.equal(config.modelId, "gpt-5.5");
  assert.equal(config.reasoningEffort, "medium");
  assert.deepEqual(
    config.skillSettings.map((skill) => skill.moduleId),
    ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
  );
  assert.equal(config.memorySettings.longTermEnabled, true);
  assert.equal(repository.configs.length, 1);
});

test("updates model, skill, memory, and safety settings", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const updated = await updateAgentConfig(repository, {
    modelId: "gpt-5.4-mini",
    reasoningEffort: "high",
    skillSettings: [
      {
        moduleId: "web_listening",
        enabled: false,
        approvalRequired: true,
        canUseNetwork: true,
        canWriteDatabase: true,
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
  assert.equal(updated.skillSettings[0]?.enabled, false);
  assert.equal(updated.memorySettings.longTermEnabled, false);
  assert.equal(updated.safetySettings.maxToolSteps, 8);
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
