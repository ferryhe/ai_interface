import { Braces, Play, Route, ShieldCheck, Workflow } from "lucide-react";

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

function permissionValue(value: boolean): string {
  return value ? "Allowed" : "Off";
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
  const readinessStatus = readiness?.status ?? "ready";

  return (
    <div className="agent-detail-layout">
      <div className="agent-detail-header">
        <div>
          <span className="soft-label">Agent manifest</span>
          <h2>{agent.title ?? agent.name}</h2>
          <p>{agent.description}</p>
        </div>
        <button
          type="button"
          className="small-action"
          onClick={() => onTestRun(agent.agentId)}
        >
          <Play size={14} />
          Test Run
        </button>
      </div>

      <div className="workbench-metrics">
        <span>
          <strong>{agent.source}</strong>
          <em>Source</em>
        </span>
        <span>
          <strong style={{ color: workbenchStatusColor(readinessStatus) }}>
            {readinessStatus.replace(/_/g, " ")}
          </strong>
          <em>Readiness</em>
        </span>
        <span>
          <strong>{agent.planner.mode}</strong>
          <em>Planner</em>
        </span>
        <span>
          <strong>{latestRun?.status.replace(/_/g, " ") ?? "No API run"}</strong>
          <em>Last run</em>
        </span>
      </div>

      {agent.identity && (
        <>
          <section className="workbench-section">
            <span className="workbench-section-title">
              <ShieldCheck size={15} />
              Identity
            </span>
            <div className="workbench-lines">
              <span><strong>Persona</strong><em>{agent.identity.persona}</em></span>
              <span><strong>Background</strong><em>{agent.identity.background}</em></span>
            </div>
          </section>
          {agent.teamId && <p className="soft-label">Team: {agent.teamId}</p>}
          {agent.runtimeStatus && <p className="soft-label">Status: {agent.runtimeStatus}</p>}
        </>
      )}
      {agent.criticalRules && agent.criticalRules.length > 0 && (
        <section className="workbench-section">
          <span className="workbench-section-title">⚠ Critical Rules</span>
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
          Instructions
        </span>
        <p>{agent.instructions}</p>
      </section>

      <section className="workbench-section">
        <span className="workbench-section-title">
          <Workflow size={15} />
          Bound skills
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
              <em>{binding.required ? "required" : "optional"}</em>
            </button>
          ))}
        </div>
      </section>

      <div className="workbench-two-column">
        <section className="workbench-section">
          <span className="workbench-section-title">
            <ShieldCheck size={15} />
            Permissions
          </span>
          <div className="workbench-lines">
            <span>
              <strong>Approval</strong>
              <em>{agent.permissions.approvalRequired ? "Required" : "Optional"}</em>
            </span>
            <span>
              <strong>Network</strong>
              <em>{permissionValue(agent.permissions.canUseNetwork)}</em>
            </span>
            <span>
              <strong>Database</strong>
              <em>{permissionValue(agent.permissions.canWriteDatabase)}</em>
            </span>
          </div>
        </section>

        <section className="workbench-section">
          <span className="workbench-section-title">
            <Route size={15} />
            Handoffs
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
                <strong>None</strong>
                <em>Direct run</em>
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
