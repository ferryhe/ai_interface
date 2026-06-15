import { Bot, CheckCircle2, CircleAlert, Play, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

import { workbenchStatusColor } from "../_shared/theme";
import type {
  AgentManifestPreview,
  AgentReadiness,
  WorkbenchRunInspection,
} from "../_shared/types";

function agentLabel(agent: AgentManifestPreview): string {
  return agent.title ?? agent.name;
}

function readinessForAgent(
  agentId: string,
  readiness: AgentReadiness[],
): AgentReadiness | null {
  return readiness.find((item) => item.agentId === agentId) ?? null;
}

function latestRunForAgent(
  agentId: string,
  runs: WorkbenchRunInspection[],
): WorkbenchRunInspection | null {
  return runs.find((run) => run.agentId === agentId) ?? null;
}

export function AgentCatalog({
  agents,
  readiness,
  runs,
  selectedAgentId,
  onSelectAgent,
  onTestRun,
}: {
  agents: AgentManifestPreview[];
  readiness: AgentReadiness[];
  runs: WorkbenchRunInspection[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onTestRun: (agentId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="agent-catalog-grid">
      {agents.map((agent) => {
        const agentReadiness = readinessForAgent(agent.agentId, readiness);
        const latestRun = latestRunForAgent(agent.agentId, runs);
        const isReady = agentReadiness?.status !== "missing_skills";
        const statusText = isReady
          ? t("agentFirst.status.readiness.ready")
          : t("agentFirst.workbench.missingSkills");
        const latestRunStatus = latestRun?.status ?? "queued";

        return (
          <div
            key={agent.agentId}
            className={
              agent.agentId === selectedAgentId
                ? "agent-catalog-row active"
                : "agent-catalog-row"
            }
          >
            <button
              type="button"
              className="agent-catalog-select"
              onClick={() => onSelectAgent(agent.agentId)}
            >
              <span className="agent-catalog-icon">
                <Bot size={17} />
              </span>
              <span className="agent-catalog-main">
                <strong>{agentLabel(agent)}</strong>
                <em>{agent.description}</em>
              </span>
              <span className="agent-catalog-meta">
                <span>{agent.source}</span>
                <span style={{ color: workbenchStatusColor(agentReadiness?.status ?? "ready") }}>
                  {isReady ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
                  {statusText}
                </span>
              </span>
              <span className="agent-catalog-meta">
                <span>
                  <Workflow size={13} />
                  {t("agentFirst.workbench.skillCount", {
                    count: agent.skills.length,
                  })}
                </span>
                <span style={{ color: workbenchStatusColor(latestRunStatus) }}>
                  {t(`agentFirst.status.workbenchRun.${latestRunStatus}`)}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="agent-catalog-run"
              onClick={() => onTestRun(agent.agentId)}
            >
              <Play size={14} />
              {t("agentFirst.actions.testRun")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
