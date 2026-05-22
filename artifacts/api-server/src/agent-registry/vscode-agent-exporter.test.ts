import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "yaml";

import type { AgentManifest } from "./agent-manifest";
import { exportVscodeAgentMarkdown } from "./vscode-agent-exporter";

function knowledgeBuilderAgent(): AgentManifest {
  return {
    agentId: "knowledge_builder",
    name: "Knowledge Builder",
    description:
      "Turn approved web and document sources into a RAG-backed agent configuration.",
    source: "builtin",
    instructions:
      "Build an inspectable knowledge pipeline from approved sources.\nPreserve intermediate artifacts for review.",
    skills: [
      { skillId: "web_listening", required: false },
      { skillId: "doc_to_md", required: false },
      { skillId: "md_to_rag", required: true },
      { skillId: "rag_to_agent", required: true },
    ],
    planner: { mode: "dag", failureStrategy: "fail_fast" },
    permissions: {
      approvalRequired: true,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
    memory: { promotionMode: "run_summary" },
    handoffs: [],
    tests: [],
  };
}

function splitFrontMatter(markdown: string): {
  frontMatter: Record<string, unknown>;
  body: string;
} {
  assert.ok(markdown.startsWith("---\n"));
  const closingIndex = markdown.indexOf("\n---\n", 4);
  assert.notEqual(closingIndex, -1);
  const yaml = markdown.slice(4, closingIndex);
  const body = markdown.slice(closingIndex + "\n---\n".length).trim();
  const frontMatter = parse(yaml);
  assert.equal(typeof frontMatter, "object");
  assert.notEqual(frontMatter, null);
  return { frontMatter: frontMatter as Record<string, unknown>, body };
}

test("VS Code exporter includes front matter and instructions for knowledge_builder", () => {
  const markdown = exportVscodeAgentMarkdown(knowledgeBuilderAgent(), {
    registeredSkillIds: [
      "web_listening",
      "doc_to_md",
      "md_to_rag",
      "rag_to_agent",
    ],
  });

  const { frontMatter, body } = splitFrontMatter(markdown);

  assert.equal(
    frontMatter.description,
    "Turn approved web and document sources into a RAG-backed agent configuration.",
  );
  assert.deepEqual(frontMatter.tools, [
    "web_listening",
    "doc_to_md",
    "md_to_rag",
    "rag_to_agent",
  ]);
  assert.equal(
    body,
    "Build an inspectable knowledge pipeline from approved sources.\nPreserve intermediate artifacts for review.",
  );
});

test("VS Code exporter includes only registered skill IDs bound to the agent", () => {
  const markdown = exportVscodeAgentMarkdown(knowledgeBuilderAgent(), {
    registeredSkillIds: ["web_listening", "md_to_rag", "not_bound"],
  });

  const { frontMatter } = splitFrontMatter(markdown);

  assert.deepEqual(frontMatter.tools, ["web_listening", "md_to_rag"]);
});

test("VS Code exporter redacts secret-looking provider and local values", () => {
  const agent = knowledgeBuilderAgent();
  agent.description =
    "Use sk-proj-1234567890abcdef from http://127.0.0.1:11434/v1.";
  agent.instructions =
    "Read C:\\Users\\ferry\\.env and /home/ec2-user/work/secret/.env, then call http://localhost:7331/mcp.";
  agent.provider = {
    provider: "ollama",
    modelId: "local-model",
    reasoningEffort: "none",
  };

  const markdown = exportVscodeAgentMarkdown(agent, {
    registeredSkillIds: ["web_listening"],
  });

  assert.equal(markdown.includes("sk-proj-1234567890abcdef"), false);
  assert.equal(markdown.includes("http://127.0.0.1:11434/v1"), false);
  assert.equal(markdown.includes("C:\\Users\\ferry\\.env"), false);
  assert.equal(markdown.includes("/home/ec2-user/work/secret/.env"), false);
  assert.equal(markdown.includes("http://localhost:7331/mcp"), false);
  assert.equal(markdown.includes("local-model"), false);
  assert.match(markdown, /\[redacted\]/);
});

test("VS Code exporter redacts spaced and quoted local paths", () => {
  const agent = knowledgeBuilderAgent();
  agent.description =
    'Read "C:\\Users\\Ferry He\\.env" before /home/ec2-user/work/My Project/.env.';
  agent.instructions =
    "Never expose C:\\Users\\Ferry He\\.env or '/home/ec2-user/work/My Project/.env'.";

  const markdown = exportVscodeAgentMarkdown(agent, {
    registeredSkillIds: ["web_listening"],
  });

  assert.equal(markdown.includes("C:\\Users\\Ferry He\\.env"), false);
  assert.equal(markdown.includes("He\\.env"), false);
  assert.equal(markdown.includes("/home/ec2-user/work/My Project/.env"), false);
  assert.equal(markdown.includes("Project/.env"), false);
  assert.match(markdown, /\[redacted\]/);
});
