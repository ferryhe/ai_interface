import { Activity, Braces, Clock3, GitBranch, ListChecks } from "lucide-react";

import { workbenchStatusColor } from "../_shared/theme";
import type { WorkbenchRunInspection } from "../_shared/types";

function statusText(status: string): string {
  return status.replace(/_/g, " ");
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
  const selectedRun =
    runs.find((run) => run.pipelineRunId === selectedRunId) ?? runs[0] ?? null;

  return (
    <div className="run-inspector-layout">
      <aside className="run-list" aria-label="Runs">
        <div className="panel-heading">
          <span>
            <Activity size={16} />
            Runs
          </span>
          <span className="soft-label">{runs.length} visible</span>
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
                <em>{run.agentId ?? "unassigned"}</em>
                <b style={{ color: workbenchStatusColor(run.status) }}>
                  {statusText(run.status)}
                </b>
              </span>
            </button>
          ))
        ) : (
          <div className="workbench-empty-state">
            <strong>No runs</strong>
            <em>Empty</em>
          </div>
        )}
      </aside>

      <div className="run-detail">
        {selectedRun ? (
          <>
            <div className="agent-detail-header">
              <div>
                <span className="soft-label">Pipeline run</span>
                <h2>{selectedRun.title}</h2>
                <p>{selectedRun.pipelineRunId}</p>
              </div>
              <span
                className="runtime-status"
                style={{ color: workbenchStatusColor(selectedRun.status) }}
              >
                {statusText(selectedRun.status)}
              </span>
            </div>

            <div className="workbench-metrics">
              <span>
                <strong>{selectedRun.agentId ?? "none"}</strong>
                <em>Agent</em>
              </span>
              <span>
                <strong>{selectedRun.activeSkillId ?? "idle"}</strong>
                <em>Active skill</em>
              </span>
              <span>
                <strong>{selectedRun.moduleSteps.length}</strong>
                <em>Steps</em>
              </span>
              <span>
                <strong>{selectedRun.updatedAt}</strong>
                <em>Updated</em>
              </span>
            </div>

            <section className="workbench-section">
              <span className="workbench-section-title">
                <ListChecks size={15} />
                Module steps
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
                        {statusText(step.status)}
                      </b>
                      <code>{step.moduleId}</code>
                    </div>
                  ))}
              </div>
            </section>

            <section className="workbench-section">
              <span className="workbench-section-title">
                <Clock3 size={15} />
                Events
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
                Raw JSON
              </span>
              <pre className="artifact-json">{JSON.stringify(selectedRun.raw, null, 2)}</pre>
            </section>
          </>
        ) : (
          <div className="workbench-empty-state">
            <GitBranch size={18} />
            <strong>No run selected</strong>
            <em>Empty</em>
          </div>
        )}
      </div>
    </div>
  );
}
