import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  ExternalLink,
  FileCode2,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Package,
  Search,
  ServerCog,
  ShieldCheck,
  Terminal,
  UploadCloud,
} from "lucide-react";

import { AgentTimeline } from "./_components/AgentTimeline";
import { BottomDock } from "./_components/BottomDock";
import { CommandBar } from "./_components/CommandBar";
import { InspectorDrawer } from "./_components/InspectorDrawer";
import {
  agentTasks,
  fileChanges,
  inspectorFile,
  inspectorLogs,
  runtimeSignals,
  timelineEvents,
} from "./_shared/data";
import { colors, fontFamily, monoFamily, statusColor } from "./_shared/theme";
import type { InspectorView, MainDockView, ToolSlotId } from "./_shared/types";

export function AgentFirstInterface() {
  const [selectedTaskId, setSelectedTaskId] = useState(agentTasks[0]?.id ?? "");
  const [command, setCommand] = useState("");
  const [planMode, setPlanMode] = useState(false);
  const [sessionNote, setSessionNote] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorView, setInspectorView] = useState<InspectorView>("changes");
  const [activeView, setActiveView] = useState<MainDockView>("agent");
  const [currentTool, setCurrentTool] = useState<ToolSlotId>("git");
  const [toolSwitcherOpen, setToolSwitcherOpen] = useState(false);
  const [running, setRunning] = useState(true);

  const selectedTask = useMemo(
    () => agentTasks.find((task) => task.id === selectedTaskId) ?? agentTasks[0],
    [selectedTaskId],
  );

  if (!selectedTask) {
    return null;
  }

  const events = timelineEvents[selectedTask.id] ?? [];
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const legacyHref = `${basePath}/preview/ai-os/AIInterface`;
  const viewTitle =
    activeView === "agent"
      ? "Agent"
      : activeView === "preview"
        ? "Preview"
        : activeView === "deploy"
          ? "Deploy"
          : activeView === "tasks"
            ? "Tasks"
            : `${currentTool[0].toUpperCase()}${currentTool.slice(1)}`;

  function openInspector(view: InspectorView): void {
    setInspectorView(view);
    setInspectorOpen(true);
  }

  function submitCommand(): void {
    const trimmed = command.trim();
    if (!trimmed) return;
    setSessionNote(trimmed);
    setCommand("");
  }

  function selectView(view: MainDockView): void {
    setActiveView(view);
    if (view !== "tool") {
      setToolSwitcherOpen(false);
    }
  }

  function selectTool(tool: ToolSlotId): void {
    setCurrentTool(tool);
    setActiveView("tool");
    setToolSwitcherOpen(false);
  }

  return (
    <div className="agent-first-shell">
      <div className="agent-workspace">
        <header className="agent-topbar">
          <div className="topbar-left">
            <LayoutDashboard size={16} />
            <span>{viewTitle}</span>
          </div>
          <div className="topbar-actions">
            <span className="runtime-pill">
              <ShieldCheck size={14} />
              Safe write
            </span>
            <span className={running ? "runtime-pill live" : "runtime-pill"}>
              {running ? "Running" : "Stopped"}
            </span>
            <a className="legacy-link" href={legacyHref}>
              Legacy
              <ExternalLink size={12} />
            </a>
          </div>
        </header>

        <div className="page-stack">
          {activeView === "agent" && (
            <AgentTimeline
              task={selectedTask}
              events={events}
              sessionNote={sessionNote}
              onOpenInspector={openInspector}
            />
          )}

          {activeView === "preview" && (
            <PreviewPage onOpenInspector={openInspector} />
          )}

          {activeView === "deploy" && <DeployPage />}

          {activeView === "tool" && (
            <ToolPage tool={currentTool} onOpenInspector={openInspector} />
          )}

          {activeView === "tasks" && (
            <TasksPage
              selectedTaskId={selectedTask.id}
              onSelectTask={(taskId) => {
                setSelectedTaskId(taskId);
                setSessionNote(null);
                setActiveView("agent");
              }}
            />
          )}
        </div>

        {activeView === "agent" && (
          <CommandBar
            value={command}
            planMode={planMode}
            onChange={setCommand}
            onTogglePlanMode={() => setPlanMode((value) => !value)}
            onSubmit={submitCommand}
          />
        )}

        <BottomDock
          activeView={activeView}
          currentTool={currentTool}
          toolSwitcherOpen={toolSwitcherOpen}
          running={running}
          onToggleRunning={() => setRunning((value) => !value)}
          onSelectView={selectView}
          onToggleToolSwitcher={() => setToolSwitcherOpen((value) => !value)}
          onSelectTool={selectTool}
        />
      </div>

      <InspectorDrawer
        open={inspectorOpen}
        view={inspectorView}
        changes={fileChanges}
        file={inspectorFile}
        logs={inspectorLogs}
        onChangeView={setInspectorView}
        onClose={() => setInspectorOpen(false)}
      />

      <style>{`
        .agent-first-shell {
          width: 100%;
          max-width: 100vw;
          height: auto;
          overflow: hidden;
          display: flex;
          position: fixed;
          inset: 0;
          background: ${colors.bg};
          color: ${colors.text};
          font-family: ${fontFamily};
          user-select: none;
        }

        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          margin: 0;
          overflow: hidden;
          background: ${colors.bg};
        }

        .agent-workspace {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .agent-topbar {
          height: 48px;
          border-bottom: 1px solid ${colors.border};
          background: ${colors.surface};
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          gap: 12px;
          flex-shrink: 0;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${colors.text};
          font-size: 13px;
          font-weight: 800;
          min-width: 0;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .runtime-pill,
        .legacy-link {
          height: 30px;
          border-radius: 6px;
          border: 1px solid ${colors.border};
          background: ${colors.surfaceAlt};
          color: ${colors.muted};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 10px;
          font-family: ${fontFamily};
          font-size: 12px;
          text-decoration: none;
        }

        .runtime-pill.live {
          color: ${colors.green};
          border-color: ${colors.green}55;
          background: #0e2419;
        }

        .page-stack {
          flex: 1;
          min-height: 0;
          display: flex;
          overflow: hidden;
        }

        .module-page {
          flex: 1;
          min-width: 0;
          min-height: 0;
          overflow: auto;
          padding: 18px;
          background: ${colors.bg};
        }

        .module-page-inner {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          gap: 12px;
        }

        .module-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 2px;
        }

        .module-kicker {
          color: ${colors.muted};
          font-size: 12px;
        }

        .module-title {
          margin: 4px 0 0;
          color: ${colors.text};
          font-size: 24px;
          line-height: 1.2;
          letter-spacing: 0;
        }

        .module-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
          gap: 12px;
        }

        .module-card {
          border: 1px solid ${colors.border};
          border-radius: 8px;
          background: ${colors.surface};
          padding: 14px;
          min-width: 0;
        }

        .card-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${colors.text};
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .muted {
          color: ${colors.muted};
        }

        .mini-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        button:focus-visible,
        textarea:focus-visible,
        a:focus-visible {
          outline: 2px solid ${colors.blue};
          outline-offset: 2px;
        }

        .agent-first-shell * {
          scrollbar-color: ${colors.borderStrong} transparent;
        }

        .agent-first-shell *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .agent-first-shell *::-webkit-scrollbar-track {
          background: transparent;
        }

        .agent-first-shell *::-webkit-scrollbar-thumb {
          background: ${colors.borderStrong};
          border-radius: 8px;
        }

        @media (max-width: 760px) {
          .topbar-actions {
            display: none;
          }

          .module-page {
            padding: 14px 12px;
          }

          .module-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .module-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function PreviewPage({
  onOpenInspector,
}: {
  onOpenInspector: (view: InspectorView) => void;
}) {
  return (
    <section className="module-page">
      <div className="module-page-inner">
        <div className="module-header">
          <div>
            <div className="module-kicker">Dev test</div>
            <h1 className="module-title">Preview and verify the app</h1>
          </div>
          <button
            type="button"
            className="page-action"
            onClick={() => onOpenInspector("logs")}
          >
            <Terminal size={14} />
            Open logs
          </button>
        </div>

        <div className="module-grid">
          <div className="module-card app-preview">
            <div className="preview-browser">
              <span />
              <span />
              <span />
              <strong>localhost:3000</strong>
            </div>
            <div className="preview-content">
              <h2>Auth API</h2>
              <p>Login, refresh, and logout endpoints are staged for testing.</p>
              <div className="endpoint-grid">
                <span>POST /api/auth/login</span>
                <strong>200 ready</strong>
                <span>POST /api/auth/refresh</span>
                <strong>waiting approval</strong>
                <span>POST /api/auth/logout</span>
                <strong>200 ready</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div className="module-card">
              <div className="card-heading">
                <Activity size={15} />
                Runtime
              </div>
              <div className="metric-list">
                {runtimeSignals.map((signal) => (
                  <div key={signal.label} className="metric-row">
                    <span
                      style={{ background: statusColor(signal.state) }}
                      className="dot"
                    />
                    <span>{signal.label}</span>
                    <strong>{signal.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="module-card">
              <div className="card-heading">
                <CheckCircle2 size={15} />
                Test queue
              </div>
              {["auth contracts", "refresh rotation", "rate-limit smoke"].map(
                (test) => (
                  <div key={test} className="test-row">
                    <CheckCircle2 size={14} />
                    <span>{test}</span>
                    <em>queued</em>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <PageStyles />
    </section>
  );
}

function DeployPage() {
  return (
    <section className="module-page">
      <div className="module-page-inner">
        <div className="module-header">
          <div>
            <div className="module-kicker">Publish</div>
            <h1 className="module-title">Deploy when tests pass</h1>
          </div>
          <button type="button" className="page-action primary">
            <UploadCloud size={14} />
            Publish staging
          </button>
        </div>

        <div className="module-grid">
          <div className="module-card">
            <div className="card-heading">
              <UploadCloud size={15} />
              Deployment pipeline
            </div>
            {[
              ["Build", "ready"],
              ["Auth tests", "waiting"],
              ["Secrets check", "needs JWT_SECRET"],
              ["Staging", "manual"],
            ].map(([label, status]) => (
              <div key={label} className="deploy-step">
                <span>{label}</span>
                <strong>{status}</strong>
              </div>
            ))}
          </div>

          <div className="module-card">
            <div className="card-heading">
              <ShieldCheck size={15} />
              Release controls
            </div>
            <p className="muted">
              Deploy is available as a separate page from the dock, so it stays
              out of the Agent conversation until the user asks for it.
            </p>
            <div className="release-list">
              <span>Rollback checkpoint</span>
              <strong>12</strong>
              <span>Domain</span>
              <strong>my-rest-api.local</strong>
              <span>Visibility</span>
              <strong>Private</strong>
            </div>
          </div>
        </div>
      </div>

      <PageStyles />
    </section>
  );
}

function ToolPage({
  tool,
  onOpenInspector,
}: {
  tool: ToolSlotId;
  onOpenInspector: (view: InspectorView) => void;
}) {
  const title =
    tool === "git"
      ? "Git changes"
      : tool === "console"
        ? "Console"
        : tool === "secrets"
          ? "Secrets"
          : tool === "database"
            ? "Database"
            : tool === "packages"
              ? "Packages"
              : tool === "search"
                ? "Search"
                : "Debugger";

  return (
    <section className="module-page">
      <div className="module-page-inner">
        <div className="module-header">
          <div>
            <div className="module-kicker">Switchable tool slot</div>
            <h1 className="module-title">{title}</h1>
          </div>
          <button
            type="button"
            className="page-action"
            onClick={() => onOpenInspector(tool === "console" ? "logs" : "code")}
          >
            <Code2 size={14} />
            Inspect
          </button>
        </div>

        <div className="module-grid">
          <div className="module-card">
            <ToolContent tool={tool} />
          </div>
          <div className="module-card">
            <div className="card-heading">
              <ListChecks size={15} />
              Tool behavior
            </div>
            <p className="muted">
              This page is the fifth dock slot. The rightmost switcher changes
              which tool lives here without making every tool visible on the
              Agent home screen.
            </p>
          </div>
        </div>
      </div>

      <PageStyles />
    </section>
  );
}

function ToolContent({ tool }: { tool: ToolSlotId }) {
  if (tool === "git") {
    return (
      <>
        <div className="card-heading">
          <GitBranch size={15} />
          Changed files
        </div>
        <div className="file-list">
          {fileChanges.map((change) => (
            <div key={change.path} className="file-row">
              <FileCode2 size={15} />
              <span>
                <strong>{change.path}</strong>
                <em>{change.summary}</em>
              </span>
              <b>
                +{change.additions} / -{change.deletions}
              </b>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (tool === "console") {
    return (
      <>
        <div className="card-heading">
          <Terminal size={15} />
          Latest logs
        </div>
        <pre className="terminal-block">
          {inspectorLogs.map((log) => `${log}\n`).join("")}
        </pre>
      </>
    );
  }

  if (tool === "secrets") {
    return (
      <ToolRows
        icon={<LockKeyhole size={15} />}
        rows={[
          ["JWT_SECRET", "required"],
          ["REFRESH_SECRET", "required"],
          ["DATABASE_URL", "connected"],
        ]}
      />
    );
  }

  if (tool === "database") {
    return (
      <ToolRows
        icon={<Database size={15} />}
        rows={[
          ["users", "12 rows"],
          ["refresh_tokens", "new table"],
          ["sessions", "indexed"],
        ]}
      />
    );
  }

  if (tool === "packages") {
    return (
      <ToolRows
        icon={<Package size={15} />}
        rows={[
          ["express-rate-limit", "added"],
          ["jsonwebtoken", "added"],
          ["bcrypt", "added"],
        ]}
      />
    );
  }

  if (tool === "search") {
    return (
      <ToolRows
        icon={<Search size={15} />}
        rows={[
          ["authLimiter", "src/routes/auth.ts:7"],
          ["issueTokens", "src/lib/tokens.ts:14"],
          ["JWT_SECRET", ".env.example:3"],
        ]}
      />
    );
  }

  return (
    <ToolRows
      icon={<ServerCog size={15} />}
      rows={[
        ["Breakpoint", "src/routes/auth.ts:13"],
        ["Request body", "{ email, password }"],
        ["Call stack", "verifyCredentials -> login"],
      ]}
    />
  );
}

function ToolRows({
  icon,
  rows,
}: {
  icon: ReactNode;
  rows: Array<[string, string]>;
}) {
  return (
    <>
      <div className="card-heading">{icon}Tool details</div>
      <div className="file-list">
        {rows.map(([label, value]) => (
          <div key={label} className="file-row">
            <span>
              <strong>{label}</strong>
              <em>{value}</em>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function TasksPage({
  selectedTaskId,
  onSelectTask,
}: {
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
}) {
  return (
    <section className="module-page">
      <div className="module-page-inner">
        <div className="module-header">
          <div>
            <div className="module-kicker">Task list</div>
            <h1 className="module-title">Pick the active Agent objective</h1>
          </div>
        </div>

        <div className="task-grid">
          {agentTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={task.id === selectedTaskId ? "task-card active" : "task-card"}
              onClick={() => onSelectTask(task.id)}
            >
              <span className="mini-row">
                <Bot size={16} />
                <strong>{task.title}</strong>
              </span>
              <span className="muted">{task.project}</span>
              <span className="task-progress">
                <i style={{ width: `${task.progress}%` }} />
              </span>
              <em>{task.progress}% complete</em>
            </button>
          ))}
        </div>
      </div>

      <PageStyles />
    </section>
  );
}

function PageStyles() {
  return (
    <style>{`
      .page-action {
        height: 32px;
        border-radius: 6px;
        border: 1px solid ${colors.border};
        background: ${colors.surfaceAlt};
        color: ${colors.text};
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 0 11px;
        font-family: ${fontFamily};
        font-size: 12px;
        cursor: pointer;
      }

      .page-action.primary {
        border-color: ${colors.orange};
        background: ${colors.orange};
        color: #fff;
        font-weight: 800;
      }

      .app-preview {
        min-height: 360px;
        padding: 0;
        overflow: hidden;
      }

      .preview-browser {
        height: 34px;
        border-bottom: 1px solid ${colors.border};
        background: ${colors.surfaceAlt};
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 12px;
        color: ${colors.muted};
        font-size: 12px;
      }

      .preview-browser span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${colors.faint};
      }

      .preview-browser strong {
        margin-left: 8px;
        font-weight: 500;
      }

      .preview-content {
        padding: 34px;
        color: ${colors.text};
      }

      .preview-content h2 {
        margin: 0;
        font-size: 28px;
        letter-spacing: 0;
      }

      .preview-content p {
        color: ${colors.muted};
        margin: 8px 0 24px;
      }

      .endpoint-grid,
      .release-list {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px 16px;
        font-family: ${monoFamily};
        font-size: 12px;
      }

      .endpoint-grid strong,
      .release-list strong {
        color: ${colors.green};
      }

      .metric-list,
      .file-list {
        display: grid;
        gap: 8px;
      }

      .metric-row,
      .test-row,
      .deploy-step,
      .file-row {
        min-height: 38px;
        border: 1px solid ${colors.border};
        border-radius: 7px;
        background: ${colors.surfaceAlt};
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 10px;
        color: ${colors.muted};
        font-size: 12px;
      }

      .metric-row strong,
      .deploy-step strong,
      .file-row b {
        margin-left: auto;
        color: ${colors.text};
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .test-row em,
      .file-row em {
        color: ${colors.faint};
        font-style: normal;
      }

      .file-row span {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .file-row strong,
      .file-row em {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .terminal-block {
        margin: 0;
        border: 1px solid ${colors.border};
        border-radius: 8px;
        background: #0b1016;
        color: ${colors.green};
        padding: 12px;
        font-family: ${monoFamily};
        font-size: 12px;
        line-height: 1.7;
        overflow: auto;
      }

      .task-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 10px;
      }

      .task-card {
        border: 1px solid ${colors.border};
        border-radius: 8px;
        background: ${colors.surface};
        color: ${colors.text};
        padding: 14px;
        display: grid;
        gap: 9px;
        text-align: left;
        font-family: ${fontFamily};
        cursor: pointer;
      }

      .task-card.active {
        border-color: ${colors.blue};
        background: #122033;
      }

      .task-progress {
        height: 5px;
        border-radius: 999px;
        background: ${colors.surfaceRaised};
        overflow: hidden;
      }

      .task-progress i {
        display: block;
        height: 100%;
        background: ${colors.green};
      }

      .task-card em {
        color: ${colors.muted};
        font-style: normal;
        font-size: 12px;
      }

      @media (max-width: 760px) {
        .preview-content {
          padding: 22px;
        }

        .module-title {
          font-size: 22px;
        }
      }
    `}</style>
  );
}

export default AgentFirstInterface;
