import { Router, type IRouter } from "express";
import type { Request } from "express";
import {
  ExportAgentMcpToolResponse,
  GetAgentsResponse,
} from "@workspace/api-zod";

import {
  defaultAgentRuntimeRegistry,
  listAgentReadiness,
  type AgentRuntimeRegistry,
} from "../agent-registry/agent-runtime-registry";
import type { AgentRuntimeStatus } from "../agent-registry/agent-manifest";
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

function singleQueryParam(
  req: Request,
  name: string,
): string | undefined {
  const value = req.query[name];
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    throw new Error(`Expected ${name} query parameter to be provided once`);
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${name} query parameter to be a string`);
  }
  return value;
}

function parseRuntimeStatus(
  value: string | undefined,
): AgentRuntimeStatus | undefined {
  if (value === undefined) return undefined;
  if (value === "runnable" || value === "template") return value;
  throw new Error(
    "Expected runtimeStatus query parameter to be runnable or template",
  );
}

export function createAgentsRouter(
  registry: AgentRuntimeRegistry = defaultAgentRuntimeRegistry,
): IRouter {
  const router: IRouter = Router();

  router.get("/agents", (req, res) => {
    let teamId: string | undefined;
    let runtimeStatus: AgentRuntimeStatus | undefined;
    try {
      teamId = singleQueryParam(req, "teamId");
      runtimeStatus = parseRuntimeStatus(
        singleQueryParam(req, "runtimeStatus"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
      return;
    }

    let agents = registry.listAgents();
    if (teamId) {
      agents = agents.filter((a) => a.teamId === teamId);
    }
    if (runtimeStatus) {
      agents = agents.filter((a) => a.runtimeStatus === runtimeStatus);
    }
    const allReadiness = listAgentReadiness(registry);
    const filteredAgentIds = new Set(agents.map((a) => a.agentId));
    const readiness =
      teamId || runtimeStatus
        ? allReadiness.filter((r) => filteredAgentIds.has(r.agentId))
        : allReadiness;
    const data = GetAgentsResponse.parse({
      agents,
      readiness,
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
