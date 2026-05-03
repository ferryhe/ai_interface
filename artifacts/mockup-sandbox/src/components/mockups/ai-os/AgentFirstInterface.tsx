import { useMemo, useState } from "react";
import {
  Bot,
  CirclePause,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  PanelRightOpen,
  Play,
  ShieldCheck,
} from "lucide-react";

import { AgentTimeline } from "./_components/AgentTimeline";
import { CommandBar } from "./_components/CommandBar";
import { ContextPanel } from "./_components/ContextPanel";
import { InspectorDrawer } from "./_components/InspectorDrawer";
import { TaskRail } from "./_components/TaskRail";
import {
  agentTasks,
  fileChanges,
  inspectorFile,
  inspectorLogs,
  runtimeSignals,
  timelineEvents,
} from "./_shared/data";
import { colors, fontFamily, toolbarButton } from "./_shared/theme";
import type { InspectorView } from "./_shared/types";

export function AgentFirstInterface() {
  const [selectedTaskId, setSelectedTaskId] = useState(agentTasks[0]?.id ?? "");
  const [command, setCommand] = useState("");
  const [planMode, setPlanMode] = useState(false);
  const [sessionNote, setSessionNote] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorView, setInspectorView] = useState<InspectorView>("changes");

  const selectedTask = useMemo(
    () => agentTasks.find((task) => task.id === selectedTaskId) ?? agentTasks[0],
    [selectedTaskId],
  );

  if (!selectedTask) {
    return null;
  }

  const events = timelineEvents[selectedTask.id] ?? [];

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

  return (
    <div className="agent-first-shell">
      <TaskRail
        tasks={agentTasks}
        selectedTaskId={selectedTask.id}
        onSelectTask={setSelectedTaskId}
      />

      <div className="agent-workspace">
        <header className="agent-topbar">
          <div className="topbar-left">
            <LayoutDashboard size={16} />
            <span>Agent-first workspace</span>
          </div>
          <div className="topbar-actions">
            <button type="button" style={toolbarButton}>
              <ShieldCheck size={14} />
              Safe write
            </button>
            <button type="button" style={toolbarButton}>
              <Clock3 size={14} />
              Checkpoints
            </button>
            <button
              type="button"
              style={toolbarButton}
              onClick={() => openInspector("changes")}
            >
              <PanelRightOpen size={14} />
              Inspector
            </button>
            <button type="button" className="run-control">
              <CirclePause size={14} />
              Pause
            </button>
          </div>
        </header>

        <div className="agent-canvas">
          <AgentTimeline
            task={selectedTask}
            events={events}
            sessionNote={sessionNote}
            onOpenInspector={openInspector}
          />
          <ContextPanel
            task={selectedTask}
            changes={fileChanges}
            runtimeSignals={runtimeSignals}
            onOpenInspector={openInspector}
          />
        </div>

        <CommandBar
          value={command}
          planMode={planMode}
          onChange={setCommand}
          onTogglePlanMode={() => setPlanMode((value) => !value)}
          onSubmit={submitCommand}
        />

        <footer className="agent-statusbar">
          <span>
            <Bot size={13} />
            Agent running
          </span>
          <span>
            <Play size={13} />
            API :3000
          </span>
          <span>3 files changed</span>
          <span>Approval required</span>
          <a href="/preview/ai-os/AIInterface">
            Legacy inspector
            <ExternalLink size={12} />
          </a>
        </footer>
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

        .agent-task-rail {
          width: 270px;
          min-width: 270px;
          background: ${colors.surface};
          border-right: 1px solid ${colors.border};
          display: flex;
          flex-direction: column;
          overflow-y: auto;
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

        .run-control {
          height: 32px;
          border-radius: 6px;
          border: 1px solid ${colors.orange};
          background: #27180d;
          color: ${colors.orange};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 11px;
          font-family: ${fontFamily};
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .agent-canvas {
          flex: 1;
          min-height: 0;
          display: flex;
          overflow: hidden;
        }

        .agent-statusbar {
          height: 30px;
          border-top: 1px solid ${colors.border};
          background: ${colors.surface};
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 12px;
          color: ${colors.muted};
          font-size: 11px;
          flex-shrink: 0;
        }

        .agent-statusbar span,
        .agent-statusbar a {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .agent-statusbar a {
          margin-left: auto;
          color: ${colors.blue};
          text-decoration: none;
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

        @media (max-width: 1180px) {
          .context-panel {
            display: none;
          }

          .command-bar-shell {
            padding-right: 16px;
          }
        }

        @media (max-width: 860px) {
          .agent-task-rail {
            display: none;
          }

          .command-bar-shell {
            padding-left: 16px;
            padding-right: 16px;
          }

          .topbar-actions button:nth-child(1),
          .topbar-actions button:nth-child(2) {
            display: none;
          }
        }

        @media (max-width: 620px) {
          .topbar-actions {
            display: none !important;
          }

          .agent-workspace,
          .agent-canvas,
          .agent-main {
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }

          .agent-main-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .agent-objective-strip {
            align-items: flex-start;
            flex-direction: column;
          }

          .agent-statusbar span:nth-child(n + 3) {
            display: none;
          }

          .agent-statusbar a {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default AgentFirstInterface;
