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

export interface LoadTeamRegistryOptions {
  cwd?: string;
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

function findWorkspaceRoot(
  startPath: string,
  pathExists: (path: string) => boolean,
): string {
  let current = resolve(startPath);
  while (true) {
    if (
      pathExists(resolve(current, "artifacts", "api-server", "src")) ||
      pathExists(resolve(current, "agents", "builtin"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return resolve(startPath);
    current = parent;
  }
}

export function loadTeamRegistry(
  options: LoadTeamRegistryOptions = {},
): Record<string, TeamDefinition> {
  const pathExists = options.exists ?? existsSync;
  const readFile =
    options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const root = findWorkspaceRoot(options.cwd ?? process.cwd(), pathExists);
  const registryPath = resolve(root, "teams", "team-registry.yaml");
  if (!pathExists(registryPath)) return {};

  let parsed: { teams?: Record<string, unknown> };
  try {
    parsed = parse(readFile(registryPath)) as {
      teams?: Record<string, unknown>;
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load team registry at ${registryPath}: ${message}`,
    );
  }

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
  options: LoadTeamRegistryOptions = {},
): { registry: Record<string, TeamDefinition>; teams: TeamEntry[] } {
  const registry = loadTeamRegistry(options);
  // Team membership is resolved from agent manifests by the caller
  const teams = resolveTeams(registry, {
    agentTeamId: () => undefined,
    listAgentIds: () => [],
  });
  return { registry, teams };
}
