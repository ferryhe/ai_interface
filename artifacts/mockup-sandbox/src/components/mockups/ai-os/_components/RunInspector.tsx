import { Activity, Braces, Clock3, GitBranch, ListChecks } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { workbenchStatusColor } from "../_shared/theme";
import type { WorkbenchRunInspection } from "../_shared/types";

function statusText(status: string, t: TFunction): string {
  return t(`agentFirst.status.workbenchRun.${status}`, {
    defaultValue: status.replace(/_/g, " "),
  });
}

export function RunInspector({
  runs,
  selectedRunId,
  onSelectRun,
}: {
  runs: WorkbenchRunInspection[];
  selectedRunId: string | null;
  onSelectRun: (pipelineRunId: string) => void;
}) {
  const { t } = useTranslation();
  const selectedRun =
    runs.find((run) => run.pipelineRunId === selectedRunId) ?? runs[0] ?? null;

  return (
    <div className="run-inspector-layout">
      <aside className="run-list" aria-label={t("agentFirst.workbench.runs")}>
        <div className="panel-heading">
          <span>
            <Activity size={16} />
            {t("agentFirst.workbench.runs")}
          </span>
          <span className="soft-label">{t("agentFirst.workbench.visibleCount", { count: runs.length })}</span>
        </div>
        {runs.length > 0 ? (
          runs.map((run) => (
            <button
              key={run.pipelineRunId}
              type="button"
              className={
                selectedRun?.pipelineRunId === run.pipelineRunId
                  ? "run-list-row active"
                  : "run-list-row"
              }
              onClick={() => onSelectRun(run.pipelineRunId)}
            >
              <strong>{run.title}</strong>
              <span>
                <em>{run.agentId ?? t("agentFirst.workbench.unassigned")}</em>
                <b style={{ color: workbenchStatusColor(run.status) }}>
                  {statusText(run.status, t)}
                </b>
              </span>
            </button>
          ))
        ) : (
          <div className="workbench-empty-state">
            <strong>{t("agentFirst.workbench.noRuns")}</strong>
            <em>{t("agentFirst.workbench.empty")}</em>
          </div>
        )}
      </aside>

      <div className="run-detail">
        {selectedRun ? (
          <>
            <div className="agent-detail-header">
              <div>
                <span className="soft-label">{t("agentFirst.workbench.pipelineRun")}</span>
                <h2>{selectedRun.title}</h2>
                <p>{selectedRun.pipelineRunId}</p>
              </div>
              <span
                className="runtime-status"
                style={{ color: workbenchStatusColor(selectedRun.status) }}
              >
                {statusText(selectedRun.status, t)}
              </span>
            </div>

            <div className="workbench-metrics">
              <span>
                <strong>{selectedRun.agentId ?? t("agentFirst.workbench.none")}</strong>
                <em>{t("agentFirst.workbench.agent")}</em>
              </span>
              <span>
                <strong>{selectedRun.activeSkillId ?? t("agentFirst.workbench.idle")}</strong>
                <em>{t("agentFirst.workbench.activeSkill")}</em>
              </span>
              <span>
                <strong>{selectedRun.moduleSteps.length}</strong>
                <em>{t("agentFirst.workbench.steps")}</em>
              </span>
              <span>
                <strong>{selectedRun.updatedAt}</strong>
                <em>{t("agentFirst.metrics.updated")}</em>
              </span>
            </div>

            <section className="workbench-section">
              <span className="workbench-section-title">
                <ListChecks size={15} />
                {t("agentFirst.workbench.moduleSteps")}
              </span>
              <div className="run-step-list">
                {[...selectedRun.moduleSteps]
                  .sort((left, right) => left.order - right.order)
                  .map((step) => (
                    <div key={step.id} className="run-step-row">
                      <span>{step.order}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <em>{step.summary}</em>
                      </div>
                      <b style={{ color: workbenchStatusColor(step.status) }}>
                        {statusText(step.status, t)}
                      </b>
                      <code>{step.moduleId}</code>
                    </div>
                  ))}
              </div>
            </section>

            <section className="workbench-section">
              <span className="workbench-section-title">
                <Clock3 size={15} />
                {t("agentFirst.workbench.events")}
              </span>
              <div className="event-feed">
                {selectedRun.events.map((event) => (
                  <div key={event.id} className="event-row">
                    <span style={{ color: workbenchStatusColor(event.status) }}>
                      {event.type}
                    </span>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                    <em>{event.time}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="workbench-section">
              <span className="workbench-section-title">
                <Braces size={15} />
                {t("agentFirst.workbench.rawJson")}
              </span>
              <pre className="artifact-json">{JSON.stringify(selectedRun.raw, null, 2)}</pre>
            </section>
          </>
        ) : (
          <div className="workbench-empty-state">
            <GitBranch size={18} />
            <strong>{t("agentFirst.workbench.noRunSelected")}</strong>
            <em>{t("agentFirst.workbench.empty")}</em>
          </div>
        )}
      </div>
    </div>
  );
}
