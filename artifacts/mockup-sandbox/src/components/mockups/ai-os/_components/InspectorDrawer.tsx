import { useEffect, useRef } from "react";
import { Code2, Eye, FileText, GitBranch, Terminal, X } from "lucide-react";

import { colors, fontFamily, monoFamily } from "../_shared/theme";
import type { FileChange, InspectorFile, InspectorView } from "../_shared/types";

interface InspectorDrawerProps {
  open: boolean;
  view: InspectorView;
  changes: FileChange[];
  file: InspectorFile;
  logs: string[];
  onChangeView: (view: InspectorView) => void;
  onClose: () => void;
}

const views: Array<{ id: InspectorView; label: string }> = [
  { id: "changes", label: "Changes" },
  { id: "code", label: "Code" },
  { id: "logs", label: "Logs" },
  { id: "preview", label: "Preview" },
];

function viewIcon(view: InspectorView) {
  if (view === "changes") return <GitBranch size={14} />;
  if (view === "code") return <Code2 size={14} />;
  if (view === "logs") return <Terminal size={14} />;
  return <Eye size={14} />;
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

export function InspectorDrawer({
  open,
  view,
  changes,
  file,
  logs,
  onChangeView,
  onClose,
}: InspectorDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirstControl = window.setTimeout(() => {
      const drawer = drawerRef.current;
      if (!drawer) return;

      const firstFocusable = getFocusableElements(drawer)[0];
      (firstFocusable ?? drawer).focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;

      const focusable = getFocusableElements(drawer);
      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusFirstControl);
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="inspector-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        ref={drawerRef}
        className="inspector-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
        tabIndex={-1}
      >
        <header className="inspector-header">
          <div>
            <div style={{ color: colors.faint, fontSize: 11 }}>Inspector</div>
            <div
              id="inspector-title"
              style={{ color: colors.text, fontWeight: 800 }}
            >
              Agent implementation details
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="close-drawer"
            aria-label="Close inspector"
          >
            <X size={16} />
          </button>
        </header>

        <div className="inspector-tabs">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={view === item.id ? "active" : ""}
            >
              {viewIcon(item.id)}
              {item.label}
            </button>
          ))}
        </div>

        <div className="inspector-body">
          {view === "changes" && (
            <div className="drawer-list">
              {changes.map((change) => (
                <div key={change.path} className="drawer-change">
                  <FileText size={15} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{change.path}</strong>
                    <span>{change.summary}</span>
                  </div>
                  <em>
                    +{change.additions} / -{change.deletions}
                  </em>
                </div>
              ))}
            </div>
          )}

          {view === "code" && (
            <div className="code-view">
              <div className="code-title">
                <span>{file.path}</span>
                <span>{file.language}</span>
              </div>
              <pre>
                {file.lines.map((line, index) => (
                  <div key={`${line}-${index}`} className="code-line">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <code>{line || " "}</code>
                  </div>
                ))}
              </pre>
            </div>
          )}

          {view === "logs" && (
            <div className="log-view">
              {logs.map((log) => (
                <div key={log}>{log}</div>
              ))}
            </div>
          )}

          {view === "preview" && (
            <div className="wide-preview">
              <div className="wide-preview-header">my-rest-api.local</div>
              <div className="wide-preview-body">
                <h2>Auth API preview</h2>
                <p>Login, refresh, and logout endpoints are staged.</p>
                <div className="endpoint-table">
                  <span>POST /api/auth/login</span>
                  <strong>ready</strong>
                  <span>POST /api/auth/refresh</span>
                  <strong>waiting</strong>
                  <span>POST /api/auth/logout</span>
                  <strong>ready</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <style>{`
        .inspector-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(0, 0, 0, 0.42);
          display: flex;
          justify-content: flex-end;
        }

        .inspector-drawer {
          width: min(620px, 92vw);
          height: 100%;
          background: ${colors.surface};
          border-left: 1px solid ${colors.borderStrong};
          box-shadow: -18px 0 50px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
        }

        .inspector-header {
          height: 66px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid ${colors.border};
        }

        .close-drawer {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid ${colors.border};
          background: ${colors.surfaceAlt};
          color: ${colors.muted};
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .inspector-tabs {
          display: flex;
          gap: 6px;
          padding: 10px 12px;
          border-bottom: 1px solid ${colors.border};
          overflow-x: auto;
        }

        .inspector-tabs button {
          height: 30px;
          border-radius: 6px;
          border: 1px solid ${colors.border};
          background: ${colors.surfaceAlt};
          color: ${colors.muted};
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 10px;
          font-family: ${fontFamily};
          font-size: 12px;
          cursor: pointer;
        }

        .inspector-tabs button.active {
          color: ${colors.blue};
          border-color: ${colors.blue};
          background: #10233d;
        }

        .inspector-body {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 14px;
        }

        .drawer-list {
          display: grid;
          gap: 8px;
        }

        .drawer-change {
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${colors.surfaceAlt};
          padding: 11px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: ${colors.muted};
        }

        .drawer-change strong,
        .drawer-change span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .drawer-change strong {
          color: ${colors.text};
          font-size: 13px;
        }

        .drawer-change span {
          font-size: 12px;
          margin-top: 3px;
        }

        .drawer-change em {
          color: ${colors.green};
          font-style: normal;
          font-size: 12px;
          flex-shrink: 0;
        }

        .code-view,
        .log-view,
        .wide-preview {
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: #0c1118;
          overflow: hidden;
        }

        .code-title,
        .wide-preview-header {
          height: 34px;
          border-bottom: 1px solid ${colors.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          color: ${colors.muted};
          font-size: 12px;
        }

        .code-view pre,
        .log-view {
          margin: 0;
          padding: 12px;
          font-family: ${monoFamily};
          font-size: 12px;
          line-height: 1.7;
          color: ${colors.text};
        }

        .code-line {
          display: flex;
          gap: 12px;
        }

        .code-line span {
          color: ${colors.faint};
          user-select: none;
        }

        .code-line code {
          white-space: pre-wrap;
        }

        .log-view div {
          color: ${colors.muted};
        }

        .wide-preview-body {
          padding: 24px;
          color: ${colors.text};
        }

        .wide-preview-body h2 {
          margin: 0;
          font-size: 22px;
          letter-spacing: 0;
        }

        .wide-preview-body p {
          color: ${colors.muted};
        }

        .endpoint-table {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px 16px;
          border-top: 1px solid ${colors.border};
          padding-top: 14px;
          font-family: ${monoFamily};
          font-size: 12px;
        }

        .endpoint-table strong {
          color: ${colors.green};
        }
      `}</style>
    </div>
  );
}
