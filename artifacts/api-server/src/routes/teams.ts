import { Router, type IRouter } from "express";
import { ListTeamsResponse } from "@workspace/api-zod";
import {
  defaultAgentRuntimeRegistry,
  type AgentRuntimeRegistry,
} from "../agent-registry/agent-runtime-registry";
import {
  createTeamResolver,
  resolveTeams,
  type TeamDefinition,
  type TeamEntry,
} from "../teams/team-service";

export interface CreateTeamsRouterOptions {
  cwd?: string;
  teamRegistry?: Record<string, TeamDefinition>;
}

function buildTeamEntries(
  registry: AgentRuntimeRegistry,
  teamRegistry: Record<string, TeamDefinition>,
): TeamEntry[] {
  const manifests = registry.listAgents();
  const agentTeamIds = new Map(
    manifests.map((manifest) => [manifest.agentId, manifest.teamId]),
  );

  return resolveTeams(teamRegistry, {
    agentTeamId: (agentId) => agentTeamIds.get(agentId),
    listAgentIds: () => manifests.map((manifest) => manifest.agentId),
  });
}

export function createTeamsRouter(
  registry: AgentRuntimeRegistry = defaultAgentRuntimeRegistry,
  options: CreateTeamsRouterOptions = {},
): IRouter {
  const router: IRouter = Router();
  const teamRegistry =
    options.teamRegistry ?? createTeamResolver({ cwd: options.cwd }).registry;

  router.get("/teams", (_req, res) => {
    const data = ListTeamsResponse.parse({
      teams: buildTeamEntries(registry, teamRegistry),
    });
    res.json(data);
  });

  return router;
}

export default createTeamsRouter();
