import { stringify } from "yaml";

import type { AgentManifest } from "./agent-manifest";
import { redactAgentInteropText } from "./mcp-tool-exporter";

export interface ExportVscodeAgentMarkdownOptions {
  registeredSkillIds: string[];
}

function registeredBoundSkillIds(
  agent: AgentManifest,
  registeredSkillIds: string[],
): string[] {
  const registered = new Set(registeredSkillIds);
  const selected: string[] = [];
  for (const binding of agent.skills) {
    if (!registered.has(binding.skillId)) continue;
    if (!selected.includes(binding.skillId)) selected.push(binding.skillId);
  }
  return selected;
}

export function exportVscodeAgentMarkdown(
  agent: AgentManifest,
  options: ExportVscodeAgentMarkdownOptions,
): string {
  const frontMatter = stringify({
    description: redactAgentInteropText(agent.description),
    tools: registeredBoundSkillIds(agent, options.registeredSkillIds),
  }).trimEnd();
  const instructions = redactAgentInteropText(agent.instructions).trim();

  return `---\n${frontMatter}\n---\n\n${instructions}\n`;
}
