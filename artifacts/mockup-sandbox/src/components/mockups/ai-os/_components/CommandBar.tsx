import { Mic, Paperclip, Send, SlidersHorizontal, WandSparkles } from "lucide-react";

import { colors, fontFamily } from "../_shared/theme";

interface CommandBarProps {
  value: string;
  planMode: boolean;
  onChange: (value: string) => void;
  onTogglePlanMode: () => void;
  onSubmit: () => void;
}

export function CommandBar({
  value,
  planMode,
  onChange,
  onTogglePlanMode,
  onSubmit,
}: CommandBarProps) {
  return (
    <div className="command-bar-shell">
      <div className="command-bar">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            const nativeEvent = event.nativeEvent as KeyboardEvent & {
              isComposing?: boolean;
            };

            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !nativeEvent.isComposing
            ) {
              event.preventDefault();
              onSubmit();
            }
          }}
          rows={2}
          placeholder={
            planMode
              ? "Describe the plan you want the agent to prepare..."
              : "Tell the agent what outcome to create..."
          }
          style={{
            flex: 1,
            minWidth: 0,
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            color: colors.text,
            fontFamily,
            fontSize: 13,
            lineHeight: 1.45,
            padding: "12px 0",
          }}
        />
        <div className="command-actions">
          <button
            type="button"
            title="Attach file"
            aria-label="Attach file"
            className="icon-command"
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            title="Toggle plan mode"
            aria-pressed={planMode}
            onClick={onTogglePlanMode}
            className={planMode ? "mode-command active" : "mode-command"}
          >
            <WandSparkles size={15} />
            Plan
          </button>
          <button
            type="button"
            title="Agent settings"
            aria-label="Agent settings"
            className="icon-command"
          >
            <SlidersHorizontal size={16} />
          </button>
          <button
            type="button"
            title="Voice input"
            aria-label="Voice input"
            className="icon-command"
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            title="Send"
            aria-label="Send message"
            onClick={onSubmit}
            className="send-command"
            disabled={!value.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <div className="command-meta">
        <span>{planMode ? "Plan mode waits for approval before acting." : "Power mode can inspect, edit, run, and report back."}</span>
        <span>Enter to send / Shift+Enter for newline</span>
      </div>

      <style>{`
        .command-bar-shell {
          position: static;
          z-index: 20;
          padding: 10px 18px 8px;
          border-top: 1px solid ${colors.border};
          background: ${colors.surface};
        }

        .command-bar {
          min-height: 74px;
          border: 1px solid ${colors.borderStrong};
          border-radius: 8px;
          background: #151d28f2;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.38);
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 0 10px 0 14px;
          backdrop-filter: blur(8px);
        }

        .command-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-bottom: 10px;
          flex-shrink: 0;
        }

        .icon-command,
        .mode-command,
        .send-command {
          height: 32px;
          border-radius: 6px;
          border: 1px solid ${colors.border};
          background: ${colors.surfaceRaised};
          color: ${colors.muted};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: ${fontFamily};
          font-size: 12px;
          cursor: pointer;
        }

        .icon-command,
        .send-command {
          width: 32px;
          padding: 0;
        }

        .mode-command {
          padding: 0 10px;
        }

        .mode-command.active {
          border-color: ${colors.blue};
          color: ${colors.blue};
          background: #10233d;
        }

        .send-command {
          background: ${colors.orange};
          border-color: ${colors.orange};
          color: #fff;
        }

        .send-command:disabled {
          background: ${colors.surfaceRaised};
          border-color: ${colors.border};
          color: ${colors.faint};
          cursor: default;
        }

        .command-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: ${colors.faint};
          font-size: 11px;
          padding: 6px 4px 0;
        }

        @media (max-width: 1180px) {
          .command-bar-shell {
            padding-right: 16px;
          }
        }

        @media (max-width: 620px) {
          .command-bar-shell {
            padding: 8px 10px 6px;
          }

          .command-bar {
            min-height: 88px;
            align-items: stretch;
            flex-direction: column;
            gap: 0;
            padding: 0 10px 10px 12px;
          }

          .command-actions {
            display: none;
          }

          .mode-command {
            padding: 0 8px;
          }

          .command-meta {
            flex-direction: column;
            gap: 2px;
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}
