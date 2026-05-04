import {
  Bot,
  Database,
  Globe2,
  GitBranch,
  ListChecks,
  Package,
  PanelsRightBottom,
  Search,
  ServerCog,
  ShieldCheck,
  Square,
  Terminal,
  UploadCloud,
} from "lucide-react";
import type { ReactNode } from "react";

import { colors, fontFamily } from "../_shared/theme";
import type { MainDockView, ToolSlotId } from "../_shared/types";

interface BottomDockProps {
  activeView: MainDockView;
  currentTool: ToolSlotId;
  toolSwitcherOpen: boolean;
  running: boolean;
  onToggleRunning: () => void;
  onSelectView: (view: MainDockView) => void;
  onToggleToolSwitcher: () => void;
  onSelectTool: (tool: ToolSlotId) => void;
}

const toolLabels: Record<ToolSlotId, string> = {
  git: "Git",
  console: "Console",
  secrets: "Secrets",
  database: "Database",
  packages: "Packages",
  search: "Search",
  debugger: "Debug",
};

function ToolIcon({ tool, size = 20 }: { tool: ToolSlotId; size?: number }) {
  if (tool === "git") return <GitBranch size={size} />;
  if (tool === "console") return <Terminal size={size} />;
  if (tool === "secrets") return <ShieldCheck size={size} />;
  if (tool === "database") return <Database size={size} />;
  if (tool === "packages") return <Package size={size} />;
  if (tool === "search") return <Search size={size} />;
  return <ServerCog size={size} />;
}

export function BottomDock({
  activeView,
  currentTool,
  toolSwitcherOpen,
  running,
  onToggleRunning,
  onSelectView,
  onToggleToolSwitcher,
  onSelectTool,
}: BottomDockProps) {
  const dockButton = (
    view: MainDockView,
    label: string,
    icon: ReactNode,
  ) => {
    const className = [
      "dock-button",
      activeView === view ? "active" : "",
      view === "agent" ? "agent-dock-button" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        type="button"
        className={className}
        onClick={() => onSelectView(view)}
        title={label}
        aria-label={label}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="bottom-dock-shell">
      <button
        type="button"
        className={running ? "stop-button running" : "stop-button"}
        onClick={onToggleRunning}
        title={running ? "Stop" : "Start"}
        aria-label={running ? "Stop app" : "Start app"}
      >
        <Square size={19} fill="currentColor" />
        <span>{running ? "Stop" : "Run"}</span>
      </button>

      <nav className="bottom-dock">
        {dockButton("preview", "Preview", <PanelsRightBottom size={21} />)}
        {dockButton("agent", "Agent", <Bot size={24} />)}
        {dockButton("deploy", "Deploy", <UploadCloud size={21} />)}
        <span className="dock-divider" />
        {dockButton(
          "tool",
          toolLabels[currentTool],
          <ToolIcon tool={currentTool} size={21} />,
        )}
        {dockButton("tasks", "Tasks", <ListChecks size={21} />)}
      </nav>

      <div className="tool-switcher-wrap">
        <button
          type="button"
          className={toolSwitcherOpen ? "switcher-button active" : "switcher-button"}
          onClick={onToggleToolSwitcher}
          title="Switch tool page"
          aria-label="Switch tool page"
        >
          <Globe2 size={20} />
        </button>

        {toolSwitcherOpen && (
          <div className="tool-menu">
            {(
              [
                "git",
                "console",
                "secrets",
                "database",
                "packages",
                "search",
                "debugger",
              ] as ToolSlotId[]
            ).map((tool) => (
              <button
                key={tool}
                type="button"
                className={currentTool === tool ? "tool-option active" : "tool-option"}
                onClick={() => onSelectTool(tool)}
                aria-label={`Switch tool to ${toolLabels[tool]}`}
              >
                <ToolIcon tool={tool} size={16} />
                {toolLabels[tool]}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .bottom-dock-shell {
          height: 84px;
          background: ${colors.surface};
          border-top: 1px solid ${colors.border};
          display: grid;
          grid-template-columns: 120px 1fr 120px;
          align-items: center;
          gap: 14px;
          padding: 0 18px;
          flex-shrink: 0;
          position: relative;
        }

        .bottom-dock {
          justify-self: center;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 7px;
          border: 1px solid ${colors.border};
          border-radius: 18px;
          background: #0f151d;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.28);
        }

        .dock-button,
        .switcher-button,
        .stop-button {
          border: none;
          font-family: ${fontFamily};
          cursor: pointer;
          color: ${colors.muted};
        }

        .dock-button {
          width: 70px;
          height: 54px;
          border-radius: 14px;
          background: transparent;
          display: grid;
          place-items: center;
          gap: 2px;
          font-size: 10px;
        }

        .dock-button span {
          line-height: 1;
        }

        .dock-button.active {
          background: ${colors.surfaceRaised};
          color: ${colors.text};
          box-shadow: inset 0 -3px 0 ${colors.blue};
        }

        .dock-button.active.agent-dock-button {
          color: ${colors.violet};
          box-shadow: inset 0 -3px 0 ${colors.violet};
        }

        .dock-divider {
          width: 1px;
          height: 30px;
          background: ${colors.borderStrong};
          margin: 0 5px;
        }

        .stop-button {
          justify-self: start;
          width: 88px;
          height: 44px;
          border-radius: 12px;
          background: ${colors.surfaceAlt};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
        }

        .stop-button.running {
          color: ${colors.red};
        }

        .tool-switcher-wrap {
          justify-self: end;
          position: relative;
        }

        .switcher-button {
          width: 48px;
          height: 44px;
          border-radius: 12px;
          background: ${colors.surfaceAlt};
          display: grid;
          place-items: center;
        }

        .switcher-button.active {
          color: ${colors.blue};
          box-shadow: inset 0 0 0 1px ${colors.blue};
        }

        .tool-menu {
          position: absolute;
          right: 0;
          bottom: 54px;
          width: 178px;
          border: 1px solid ${colors.border};
          border-radius: 12px;
          background: ${colors.surface};
          padding: 6px;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
          display: grid;
          gap: 4px;
          z-index: 50;
        }

        .tool-option {
          height: 34px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: ${colors.muted};
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 9px;
          font-family: ${fontFamily};
          font-size: 12px;
          cursor: pointer;
          text-align: left;
        }

        .tool-option.active {
          color: ${colors.text};
          background: ${colors.surfaceRaised};
        }

        @media (max-width: 760px) {
          .bottom-dock-shell {
            height: 74px;
            grid-template-columns: 48px 1fr 48px;
            gap: 8px;
            padding: 0 10px;
          }

          .bottom-dock {
            gap: 2px;
            padding: 6px;
            border-radius: 16px;
          }

          .dock-button {
            width: 42px;
            height: 48px;
          }

          .dock-button span,
          .stop-button span {
            display: none;
          }

          .stop-button,
          .switcher-button {
            width: 42px;
            height: 42px;
          }

          .dock-divider {
            margin: 0 2px;
          }
        }
      `}</style>
    </div>
  );
}
