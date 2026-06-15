import { Braces, Play, Route, ShieldCheck, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

import { workbenchStatusColor } from "../_shared/theme";
import type {
  AgentManifestPreview,
  AgentReadiness,
  WorkbenchRunInspection,
  WorkbenchSkillOption,
} from "../_shared/types";

function skillName(skillId: string, skills: WorkbenchSkillOption[]): string {
  return skills.find((skill) => skill.skillId === skillId)?.name ?? skillId;
}

export function AgentDetail({
  agent,
  readiness,
  skills,
  latestRun,
  onTestRun,
  onOpenSkill,
}: {
  agent: AgentManifestPreview;
  readiness: AgentReadiness | null;
  skills: WorkbenchSkillOption[];
  latestRun: WorkbenchRunInspection | null;
  onTestRun: (agentId: string) => void;
  onOpenSkill: (skillId: string) => void;
}) {
  const { t } = useTranslation();
  const readinessStatus = readiness?.status ?? "ready";
  const permissionValue = (value: boolean): string =>
    value ? t("agentFirst.workbench.allowed") : t("agentFirst.workbench.off");

  return (
    <div className="agent-detail-layout">
      <div className="agent-detail-header">
        <div>
          <span className="soft-label">{t("agentFirst.workbench.agentManifest")}</span>
          <h2>{agent.title ?? agent.name}</h2>
          <p>{agent.description}</p>
        </div>
        <button
          type="button"
          className="small-action"
          onClick={() => onTestRun(agent.agentId)}
        >
          <Play size={14} />
          {t("agentFirst.actions.testRun")}
        </button>
      </div>

      <div className="workbench-metrics">
        <span>
          <strong>{agent.source}</strong>
          <em>{t("agentFirst.workbench.source")}</em>
        </span>
        <span>
          <strong style={{ color: workbenchStatusColor(readinessStatus) }}>
            {t(`agentFirst.status.agentReadiness.${readinessStatus}`, {
              defaultValue: readinessStatus.replace(/_/g, " "),
            })}
          </strong>
          <em>{t("agentFirst.metrics.readiness")}</em>
        </span>
        <span>
          <strong>{agent.planner.mode}</strong>
          <em>{t("agentFirst.workbench.planner")}</em>
        </span>
        <span>
          <strong>
            {latestRun
              ? t(`agentFirst.status.workbenchRun.${latestRun.status}`, {
                  defaultValue: latestRun.status.replace(/_/g, " "),
                })
              : t("agentFirst.workbench.noApiRun")}
          </strong>
          <em>{t("agentFirst.workbench.lastRun")}</em>
        </span>
      </div>

      {agent.identity && (
        <>
          <section className="workbench-section">
            <span className="workbench-section-title">
              <ShieldCheck size={15} />
              {t("agentFirst.workbench.identity")}
            </span>
            <div className="workbench-lines">
              <span><strong>{t("agentFirst.workbench.persona")}</strong><em>{agent.identity.persona}</em></span>
              <span><strong>{t("agentFirst.workbench.background")}</strong><em>{agent.identity.background}</em></span>
            </div>
          </section>
          {agent.teamId && <p className="soft-label">{t("agentFirst.workbench.team", { teamId: agent.teamId })}</p>}
          {agent.runtimeStatus && <p className="soft-label">{t("agentFirst.workbench.status", { status: agent.runtimeStatus })}</p>}
        </>
      )}
      {agent.criticalRules && agent.criticalRules.length > 0 && (
        <section className="workbench-section">
          <span className="workbench-section-title">{t("agentFirst.workbench.criticalRules")}</span>
          <div className="workbench-lines">
            {agent.criticalRules.map((rule) => (
              <span key={rule.id}><strong>{rule.severity}</strong><em>{rule.description}</em></span>
            ))}
          </div>
        </section>
      )}

      <section className="workbench-section">
        <span className="workbench-section-title">
          <Braces size={15} />
          {t("agentFirst.workbench.instructions")}
        </span>
        <p>{agent.instructions}</p>
      </section>

      <section className="workbench-section">
        <span className="workbench-section-title">
          <Workflow size={15} />
          {t("agentFirst.workbench.boundSkills")}
        </span>
        <div className="agent-skill-list">
          {agent.skills.map((binding) => (
            <button
              key={binding.skillId}
              type="button"
              className="agent-skill-chip"
              onClick={() => onOpenSkill(binding.skillId)}
            >
              <strong>{skillName(binding.skillId, skills)}</strong>
              <em>
                {binding.required
                  ? t("agentFirst.workbench.required")
                  : t("agentFirst.workbench.optional")}
              </em>
            </button>
          ))}
        </div>
      </section>

      <div className="workbench-two-column">
        <section className="workbench-section">
          <span className="workbench-section-title">
            <ShieldCheck size={15} />
            {t("agentFirst.workbench.permissions")}
          </span>
          <div className="workbench-lines">
            <span>
              <strong>{t("agentFirst.configure.approval")}</strong>
              <em>
                {agent.permissions.approvalRequired
                  ? t("agentFirst.workbench.required")
                  : t("agentFirst.workbench.optional")}
              </em>
            </span>
            <span>
              <strong>{t("agentFirst.configure.network")}</strong>
              <em>{permissionValue(agent.permissions.canUseNetwork)}</em>
            </span>
            <span>
              <strong>{t("agentFirst.nav.data")}</strong>
              <em>{permissionValue(agent.permissions.canWriteDatabase)}</em>
            </span>
          </div>
        </section>

        <section className="workbench-section">
          <span className="workbench-section-title">
            <Route size={15} />
            {t("agentFirst.workbench.handoffs")}
          </span>
          <div className="workbench-lines">
            {agent.handoffs.length > 0 ? (
              agent.handoffs.map((handoff) => (
                <span key={`${handoff.targetAgentId}-${handoff.description}`}>
                  <strong>{handoff.targetAgentId}</strong>
                  <em>{handoff.description}</em>
                </span>
              ))
            ) : (
              <span>
                <strong>{t("agentFirst.workbench.none")}</strong>
                <em>{t("agentFirst.workbench.directRun")}</em>
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
