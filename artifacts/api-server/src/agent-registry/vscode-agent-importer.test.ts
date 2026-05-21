import assert from "node:assert/strict";
import test from "node:test";

import { importVscodeAgentMarkdown } from "./vscode-agent-importer";

test("maps .agent.md front matter plus Markdown body into an agent manifest payload", () => {
  const result = importVscodeAgentMarkdown({
    agentId: "review_agent",
    name: "Review Agent",
    markdown: `---
description: Review selected documents.
tools:
  - doc_to_md
  - md_to_rag
---

Read the supplied documents and preserve intermediate artifacts.
`,
    registeredSkillIds: ["doc_to_md", "md_to_rag", "rag_to_agent"],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.manifest, {
    agentId: "review_agent",
    name: "Review Agent",
    description: "Review selected documents.",
    source: "custom",
    instructions:
      "Read the supplied documents and preserve intermediate artifacts.",
    skills: [
      { skillId: "doc_to_md", required: false },
      { skillId: "md_to_rag", required: false },
    ],
    planner: { mode: "linear", failureStrategy: "fail_fast" },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
    memory: { promotionMode: "run_summary" },
    handoffs: [],
    tests: [],
  });
});

test("warns for unmatched VS Code tool names without inventing skills", () => {
  const result = importVscodeAgentMarkdown({
    agentId: "mixed_agent",
    name: "Mixed Agent",
    markdown: `---
description: Uses a mix of registered and unknown tools.
skills:
  - md_to_rag
  - imaginary_tool
tools:
  - doc_to_md
  - browser
---

Use the registered tools only.
`,
    registeredSkillIds: ["doc_to_md", "md_to_rag"],
  });

  assert.deepEqual(result.manifest.skills, [
    { skillId: "md_to_rag", required: false },
    { skillId: "doc_to_md", required: false },
  ]);
  assert.deepEqual(result.warnings, [
    "Unmatched VS Code tool or skill name: imaginary_tool",
    "Unmatched VS Code tool or skill name: browser",
  ]);
});
