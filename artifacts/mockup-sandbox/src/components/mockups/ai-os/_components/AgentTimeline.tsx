import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Code2,
  Eye,
  FileCode2,
  GitBranch,
  Play,
  ShieldAlert,
  Terminal,
} from "lucide-react";

import { colors, fontFamily, toolbarButton } from "../_shared/theme";
import type {
  AgentTask,
  InspectorView,
  TimelineEvent,
  TimelineKind,
  TimelineStatus,
} from "../_shared/types";

interface AgentTimelineProps {
  task: AgentTask;
  events: TimelineEvent[];
  sessionNote: string | null;
  onOpenInspector: (view: InspectorView) => void;
}

function getKindIcon(kind: TimelineKind) {
  if (kind === "plan") return <ClipboardCheck size={16} />;
  if (kind === "tool") return <Terminal size={16} />;
  if (kind === "change") return <FileCode2 size={16} />;
  if (kind === "test") return <Play size={16} />;
  if (kind === "preview") return <Eye size={16} />;
  return <ShieldAlert size={16} />;
}

function getStatusColor(status: TimelineStatus): string {
  if (status === "done") return colors.green;
  if (status === "active") return colors.blue;
  if (status === "waiting") return colors.yellow;
  return colors.faint;
}

function getStatusIcon(status: TimelineStatus) {
  if (status === "done") return <CheckCircle2 size={16} />;
  if (status === "active") return <CircleDashed size={16} />;
  if (status === "waiting") return <ShieldAlert size={16} />;
  return <CircleDashed size={16} />;
}

export function AgentTimeline({
  task,
  events,
  sessionNote,
  onOpenInspector,
}: AgentTimelineProps) {
  return (
    <main className="agent-main">
      <div className="agent-main-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ color: colors.muted, fontSize: 12 }}>
            {task.project} / objective
          </div>
          <h1
            style={{
              margin: "3px 0 0",
              color: colors.text,
              fontSize: 22,
              lineHeight: 1.2,
              letterSpacing: 0,
            }}
          >
            {task.title}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => onOpenInspector("changes")}
            style={toolbarButton}
          >
            <GitBranch size={14} />
            Review changes
          </button>
          <button
            type="button"
            onClick={() => onOpenInspector("code")}
            style={toolbarButton}
          >
            <Code2 size={14} />
            Inspect code
          </button>
        </div>
      </div>

      <section className="agent-objective-strip">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: colors.green,
              boxShadow: `0 0 0 5px ${colors.green}18`,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: colors.text, fontWeight: 700, fontSize: 13 }}>
              Agent is implementing and pausing at approval points.
            </div>
            <div style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              The main surface tracks intent, progress, decisions, and outcomes.
            </div>
          </div>
        </div>
        <div
          style={{
            minWidth: 120,
            color: colors.text,
            fontSize: 12,
            textAlign: "right",
          }}
        >
          <div style={{ color: colors.muted }}>Progress</div>
          <strong>{task.progress}%</strong>
        </div>
      </section>

      <section className="agent-timeline">
        {sessionNote && (
          <div className="timeline-event queued-note">
            <div className="event-marker" style={{ color: colors.orange }}>
              <CircleDashed size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="event-title">Queued user instruction</div>
              <div className="event-detail">{sessionNote}</div>
            </div>
          </div>
        )}

        {events.map((event) => {
          const statusColor = getStatusColor(event.status);

          return (
            <article key={event.id} className="timeline-event">
              <div className="event-marker" style={{ color: statusColor }}>
                {getStatusIcon(event.status)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="event-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: statusColor }}>
                      {getKindIcon(event.kind)}
                    </span>
                    <h2 className="event-title">{event.title}</h2>
                  </div>
                  <span style={{ color: colors.faint, fontSize: 11 }}>
                    {event.time}
                  </span>
                </div>
                <p className="event-detail">{event.detail}</p>

                {(event.artifact || event.files) && (
                  <div className="event-artifacts">
                    {event.artifact && (
                      <span className="artifact-chip">{event.artifact}</span>
                    )}
                    {event.files?.map((file) => (
                      <button
                        key={file}
                        type="button"
                        onClick={() => onOpenInspector("code")}
                        className="artifact-chip artifact-button"
                      >
                        {file}
                      </button>
                    ))}
                  </div>
                )}

                {event.requiresApproval && (
                  <div className="approval-row">
                    <button type="button" className="approve-button">
                      Approve secure cookie flow
                    </button>
                    <button type="button" className="secondary-button">
                      Keep JSON tokens
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <style>{`
        .agent-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: ${colors.bg};
        }

        .agent-main-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 22px 12px;
          border-bottom: 1px solid ${colors.border};
        }

        .agent-objective-strip {
          margin: 12px 22px 0;
          padding: 12px;
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: linear-gradient(90deg, #10231c, #101720 65%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .agent-timeline {
          padding: 14px 22px 20px;
          overflow-y: auto;
          display: grid;
          gap: 8px;
        }

        .timeline-event {
          display: flex;
          gap: 12px;
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${colors.surface};
          padding: 12px;
        }

        .queued-note {
          border-color: ${colors.orange}66;
          background: #20170f;
        }

        .event-marker {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: ${colors.surfaceRaised};
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .event-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .event-title {
          margin: 0;
          color: ${colors.text};
          font-size: 14px;
          line-height: 1.35;
          letter-spacing: 0;
        }

        .event-detail {
          margin: 5px 0 0;
          color: ${colors.muted};
          font-size: 13px;
          line-height: 1.55;
        }

        .event-artifacts {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .artifact-chip {
          border: 1px solid ${colors.border};
          border-radius: 999px;
          background: ${colors.surfaceAlt};
          color: ${colors.muted};
          font-size: 11px;
          padding: 4px 8px;
          font-family: ${fontFamily};
        }

        .artifact-button {
          cursor: pointer;
        }

        .approval-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .approve-button,
        .secondary-button {
          height: 30px;
          border-radius: 6px;
          padding: 0 11px;
          font-size: 12px;
          font-family: ${fontFamily};
          cursor: pointer;
        }

        .approve-button {
          border: none;
          color: #fff;
          background: ${colors.orange};
          font-weight: 700;
        }

        .secondary-button {
          border: 1px solid ${colors.border};
          color: ${colors.muted};
          background: ${colors.surfaceAlt};
        }

        @media (max-width: 620px) {
          .agent-main-header > div:last-child {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr;
          }

          .agent-main-header button {
            width: 100%;
            min-width: 0;
            padding-left: 8px !important;
            padding-right: 8px !important;
            font-size: 11px !important;
          }

          .event-row > span:last-child {
            display: none;
          }

          .timeline-event {
            gap: 10px;
            min-width: 0;
          }

          .event-detail {
            overflow-wrap: anywhere;
          }

          .agent-objective-strip {
            margin-left: 12px;
            margin-right: 12px;
          }

          .agent-timeline {
            padding-left: 12px;
            padding-right: 12px;
          }
        }
      `}</style>
    </main>
  );
}
