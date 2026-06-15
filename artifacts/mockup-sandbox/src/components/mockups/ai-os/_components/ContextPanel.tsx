import {
  Activity,
  ChevronRight,
  Eye,
  FileCode2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { colors, statusColor } from "../_shared/theme";
import type {
  AgentTask,
  FileChange,
  InspectorView,
  RuntimeSignal,
} from "../_shared/types";

interface ContextPanelProps {
  task: AgentTask;
  changes: FileChange[];
  runtimeSignals: RuntimeSignal[];
  onOpenInspector: (view: InspectorView) => void;
}

export function ContextPanel({
  task,
  changes,
  runtimeSignals,
  onOpenInspector,
}: ContextPanelProps) {
  const { t } = useTranslation();

  return (
    <aside className="context-panel">
      <section className="context-section preview-section">
        <div className="section-heading">
          <span>
            <Eye size={14} />
            {t("legacyAi.context.livePreview")}
          </span>
          <button type="button" onClick={() => onOpenInspector("preview")}>
            {t("legacyAi.context.open")}
          </button>
        </div>
        <div className="preview-window">
          <div className="preview-topbar">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-body">
            <div className="preview-title">
              {t("legacyAi.context.preview.title")}
            </div>
            <div className="preview-route">POST /api/auth/login</div>
            <div className="preview-status">
              {t("legacyAi.context.preview.status")}
            </div>
          </div>
        </div>
      </section>

      <section className="context-section">
        <div className="section-heading">
          <span>
            <Activity size={14} />
            {t("legacyAi.context.runtime")}
          </span>
        </div>
        <div className="signal-list">
          {runtimeSignals.map((signal) => (
            <div key={signal.label} className="signal-row">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: statusColor(signal.state),
                  flexShrink: 0,
                }}
              />
              <span style={{ color: colors.muted }}>{signal.label}</span>
              <strong>{signal.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="context-section">
        <div className="section-heading">
          <span>
            <FileCode2 size={14} />
            {t("legacyAi.context.changes")}
          </span>
          <button type="button" onClick={() => onOpenInspector("changes")}>
            {t("legacyAi.context.review")}
          </button>
        </div>
        <div className="change-list">
          {changes.slice(0, 3).map((change) => (
            <button
              key={change.path}
              type="button"
              className="change-row"
              onClick={() => onOpenInspector("code")}
            >
              <span style={{ minWidth: 0 }}>
                <span className="change-path">{change.path}</span>
                <span className="change-summary">{change.summary}</span>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </section>

      <section className="context-section">
        <div className="section-heading">
          <span>
            <ShieldCheck size={14} />
            {t("legacyAi.context.agentControl")}
          </span>
        </div>
        <div className="permission-list">
          <div className="permission-row">
            <LockKeyhole size={14} />
            <span>{t("legacyAi.context.permissions.writeAccess")}</span>
            <strong>{t("legacyAi.context.permissionState.on")}</strong>
          </div>
          <div className="permission-row">
            <LockKeyhole size={14} />
            <span>{t("legacyAi.context.permissions.networkTools")}</span>
            <strong>{t("legacyAi.context.permissionState.ask")}</strong>
          </div>
          <div className="permission-row">
            <LockKeyhole size={14} />
            <span>{t("legacyAi.context.permissions.deploy")}</span>
            <strong>{t("legacyAi.context.permissionState.manual")}</strong>
          </div>
        </div>
      </section>

      <section className="context-section model-section">
        <div style={{ color: colors.muted, fontSize: 11 }}>
          {t("legacyAi.context.model")}
        </div>
        <div style={{ color: colors.text, fontWeight: 800, marginTop: 3 }}>
          {task.model}
        </div>
        <div style={{ color: colors.faint, fontSize: 11, marginTop: 6 }}>
          {t("legacyAi.context.modelDescription")}
        </div>
      </section>

      <style>{`
        .context-panel {
          width: 320px;
          min-width: 320px;
          border-left: 1px solid ${colors.border};
          background: ${colors.surface};
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
        }

        .context-section {
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${colors.surfaceAlt};
          padding: 12px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: ${colors.text};
          font-size: 12px;
          font-weight: 800;
        }

        .section-heading span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .section-heading button {
          border: 1px solid ${colors.border};
          border-radius: 5px;
          background: ${colors.surfaceRaised};
          color: ${colors.muted};
          height: 24px;
          padding: 0 8px;
          font-size: 11px;
          cursor: pointer;
        }

        .preview-window {
          margin-top: 10px;
          border: 1px solid ${colors.border};
          border-radius: 7px;
          background: #0e141b;
          overflow: hidden;
        }

        .preview-topbar {
          height: 24px;
          background: #1b2430;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 0 9px;
        }

        .preview-topbar span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${colors.faint};
        }

        .preview-body {
          min-height: 136px;
          display: grid;
          align-content: center;
          gap: 8px;
          padding: 18px;
        }

        .preview-title {
          color: ${colors.text};
          font-size: 18px;
          font-weight: 800;
        }

        .preview-route {
          color: ${colors.blue};
          font-family: monospace;
          font-size: 12px;
        }

        .preview-status {
          color: ${colors.green};
          font-size: 12px;
        }

        .signal-list,
        .change-list,
        .permission-list {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        .signal-row,
        .permission-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .signal-row strong,
        .permission-row strong {
          margin-left: auto;
          color: ${colors.text};
          font-weight: 700;
        }

        .change-row {
          border: 1px solid ${colors.border};
          border-radius: 7px;
          background: ${colors.surface};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px;
          cursor: pointer;
          text-align: left;
        }

        .change-path,
        .change-summary {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .change-path {
          color: ${colors.text};
          font-size: 12px;
          font-weight: 700;
        }

        .change-summary {
          color: ${colors.muted};
          font-size: 11px;
          margin-top: 3px;
        }

        .permission-row {
          color: ${colors.muted};
        }
      `}</style>
    </aside>
  );
}
