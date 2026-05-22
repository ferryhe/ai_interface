import { Router, type IRouter } from "express";
import {
  ExportAgentMcpToolResponse,
  GetAgentsResponse,
} from "@workspace/api-zod";

import {
  defaultAgentRuntimeRegistry,
  listAgentReadiness,
  type AgentRuntimeRegistry,
} from "../agent-registry/agent-runtime-registry";
import {
  assertMcpToolMetadataContract,
  exportMcpToolMetadata,
} from "../agent-registry/mcp-tool-exporter";
import { exportVscodeAgentMarkdown } from "../agent-registry/vscode-agent-exporter";

function registeredSkillIdsForAgent(
  registry: AgentRuntimeRegistry,
  agentId: string,
): string[] {
  const readiness = listAgentReadiness(registry).find(
    (item) => item.agentId === agentId,
  );
  if (!readiness) return [];
  const missing = new Set(readiness.missingSkillIds);
  return readiness.enabledSkillIds.filter((skillId) => !missing.has(skillId));
}

export function createAgentsRouter(
  registry: AgentRuntimeRegistry = defaultAgentRuntimeRegistry,
): IRouter {
  const router: IRouter = Router();

  router.get("/agents", (_req, res) => {
    const data = GetAgentsResponse.parse({
      agents: registry.listAgents(),
      readiness: listAgentReadiness(registry),
    });
    res.json(data);
  });

  router.get("/agents/:agentId/export/vscode-agent", (req, res) => {
    const agent = registry.getAgent(req.params.agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res
      .type("text/markdown")
      .send(
        exportVscodeAgentMarkdown(agent, {
          registeredSkillIds: registeredSkillIdsForAgent(
            registry,
            req.params.agentId,
          ),
        }),
      );
  });

  router.get("/agents/:agentId/export/mcp-tool", (req, res) => {
    const agent = registry.getAgent(req.params.agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res.json(
      ExportAgentMcpToolResponse.parse(
        assertMcpToolMetadataContract(exportMcpToolMetadata(agent)),
      ),
    );
  });

  return router;
}

export default createAgentsRouter();
