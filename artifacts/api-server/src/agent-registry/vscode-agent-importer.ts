import { parse } from "yaml";

import type { WritableAgentManifest } from "./agent-manifest-writer";

export interface ImportVscodeAgentMarkdownInput {
  agentId: string;
  name: string;
  markdown: string;
  registeredSkillIds: string[];
}

export interface ImportVscodeAgentMarkdownResult {
  manifest: WritableAgentManifest & { agentId: string; source: "custom" };
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function splitFrontMatter(markdown: string): {
  frontMatter: Record<string, unknown>;
  body: string;
} {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return { frontMatter: {}, body: markdown.trim() };
  }

  const lineEnding = normalized.startsWith("---\r\n") ? "\r\n" : "\n";
  const closingMarker = `${lineEnding}---${lineEnding}`;
  const closingIndex = normalized.indexOf(closingMarker, 3);
  if (closingIndex === -1) {
    return { frontMatter: {}, body: markdown.trim() };
  }

  const rawFrontMatter = normalized.slice(3 + lineEnding.length, closingIndex);
  const parsed = parse(rawFrontMatter);
  return {
    frontMatter: isRecord(parsed) ? parsed : {},
    body: normalized.slice(closingIndex + closingMarker.length).trim(),
  };
}

function stringList(value: unknown): string[] {
  if (value === undefined) return [];
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function importVscodeAgentMarkdown(
  input: ImportVscodeAgentMarkdownInput,
): ImportVscodeAgentMarkdownResult {
  const { frontMatter, body } = splitFrontMatter(input.markdown);
  const registeredSkillIds = new Set(input.registeredSkillIds);
  const requestedNames = [
    ...stringList(frontMatter.skills),
    ...stringList(frontMatter.tools),
  ];
  const selectedSkillIds: string[] = [];
  const warnings: string[] = [];

  for (const name of requestedNames) {
    if (registeredSkillIds.has(name)) {
      if (!selectedSkillIds.includes(name)) selectedSkillIds.push(name);
      continue;
    }
    warnings.push(`Unmatched VS Code tool or skill name: ${name}`);
  }

  return {
    manifest: {
      agentId: input.agentId,
      name: input.name,
      description:
        typeof frontMatter.description === "string" &&
        frontMatter.description.trim() !== ""
          ? frontMatter.description
          : `Imported VS Code agent: ${input.name}`,
      source: "custom",
      instructions: body,
      skills: selectedSkillIds.map((skillId) => ({
        skillId,
        required: false,
      })),
      planner: { mode: "linear", failureStrategy: "fail_fast" },
      permissions: {
        approvalRequired: false,
        canUseNetwork: false,
        canWriteDatabase: true,
      },
      memory: { promotionMode: "run_summary" },
      handoffs: [],
      tests: [],
    },
    warnings,
  };
}
