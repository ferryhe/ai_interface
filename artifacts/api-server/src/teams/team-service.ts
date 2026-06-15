import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";

export interface TeamDefinition {
  displayName: string;
  description: string;
  industries: string[];
}

export interface TeamEntry {
  teamId: string;
  displayName: string;
  description: string;
  industries: string[];
  memberAgentIds: string[];
}

function findWorkspaceRoot(startPath: string): string {
  let current = resolve(startPath);
  while (true) {
    if (
      existsSync(resolve(current, "artifacts", "api-server", "src")) ||
      existsSync(resolve(current, "agents", "builtin"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return resolve(startPath);
    current = parent;
  }
}

function loadTeamRegistry(cwd?: string): Record<string, TeamDefinition> {
  const root = findWorkspaceRoot(cwd ?? process.cwd());
  const registryPath = resolve(root, "teams", "team-registry.yaml");
  if (!existsSync(registryPath)) return {};
  const raw = readFileSync(registryPath, "utf8");
  const parsed = parse(raw) as { teams?: Record<string, unknown> };
  if (!parsed || typeof parsed !== "object" || !parsed.teams) return {};

  const teams: Record<string, TeamDefinition> = {};
  for (const [teamId, def] of Object.entries(parsed.teams)) {
    if (typeof def !== "object" || def === null) continue;
    const d = def as Record<string, unknown>;
    teams[teamId] = {
      displayName: String(d.displayName ?? teamId),
      description: String(d.description ?? ""),
      industries: Array.isArray(d.industries)
        ? d.industries.map(String)
        : [],
    };
  }
  return teams;
}

export interface TeamMemberResolver {
  agentTeamId(agentId: string): string | undefined;
  listAgentIds(): string[];
}

export function resolveTeams(
  registry: Record<string, TeamDefinition>,
  resolver: TeamMemberResolver,
): TeamEntry[] {
  const agentIds = resolver.listAgentIds();
  const membersByTeam = new Map<string, string[]>();

  for (const agentId of agentIds) {
    const teamId = resolver.agentTeamId(agentId);
    if (!teamId) continue;
    if (!membersByTeam.has(teamId)) {
      membersByTeam.set(teamId, []);
    }
    membersByTeam.get(teamId)!.push(agentId);
  }

  return Object.entries(registry).map(([teamId, def]) => ({
    teamId,
    displayName: def.displayName,
    description: def.description,
    industries: def.industries,
    memberAgentIds: membersByTeam.get(teamId) ?? [],
  }));
}

export function createTeamResolver(
  cwd?: string,
): { registry: Record<string, TeamDefinition>; teams: TeamEntry[] } {
  const registry = loadTeamRegistry(cwd);
  // Team membership is resolved from agent manifests by the caller
  const teams = resolveTeams(registry, {
    agentTeamId: () => undefined,
    listAgentIds: () => [],
  });
  return { registry, teams };
}
