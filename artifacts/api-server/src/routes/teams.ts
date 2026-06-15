import { Router, type IRouter } from "express";
import {
  defaultAgentRuntimeRegistry,
  type AgentRuntimeRegistry,
} from "../agent-registry/agent-runtime-registry";
import { createTeamResolver, type TeamEntry } from "../teams/team-service";

function buildTeamEntries(registry: AgentRuntimeRegistry): TeamEntry[] {
  const manifests = registry.listAgents();
  const { teams } = createTeamResolver();

  return teams.map((team) => ({
    ...team,
    memberAgentIds: manifests
      .filter((m) => m.teamId === team.teamId)
      .map((m) => m.agentId),
  }));
}

export function createTeamsRouter(
  registry: AgentRuntimeRegistry = defaultAgentRuntimeRegistry,
): IRouter {
  const router: IRouter = Router();

  router.get("/teams", (_req, res) => {
    res.json({ teams: buildTeamEntries(registry) });
  });

  return router;
}

export default createTeamsRouter();
