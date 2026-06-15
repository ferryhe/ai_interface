import {
  Bot,
  CheckCircle2,
  CirclePause,
  Clock3,
  FolderKanban,
  Plus,
  Search,
} from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { colors, fontFamily } from "../_shared/theme";
import type { AgentRunStatus, AgentTask } from "../_shared/types";

interface TaskRailProps {
  tasks: AgentTask[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
}

const statusLabelKeys: Record<AgentRunStatus, string> = {
  running: "legacyAi.taskRail.status.running",
  waiting: "legacyAi.taskRail.status.waiting",
  paused: "legacyAi.taskRail.status.paused",
  done: "legacyAi.taskRail.status.done",
};

function getStatusMeta(
  status: AgentRunStatus,
  t: TFunction,
): { label: string; color: string } {
  if (status === "running") {
    return { label: t(statusLabelKeys.running), color: colors.green };
  }
  if (status === "waiting") {
    return { label: t(statusLabelKeys.waiting), color: colors.yellow };
  }
  if (status === "paused") {
    return { label: t(statusLabelKeys.paused), color: colors.blue };
  }
  return { label: t(statusLabelKeys.done), color: colors.faint };
}

function StatusIcon({ status }: { status: AgentRunStatus }) {
  if (status === "done") return <CheckCircle2 size={14} />;
  if (status === "waiting") return <Clock3 size={14} />;
  if (status === "paused") return <CirclePause size={14} />;
  return <Bot size={14} />;
}

export function TaskRail({
  tasks,
  selectedTaskId,
  onSelectTask,
}: TaskRailProps) {
  const { t } = useTranslation();

  return (
    <aside className="agent-task-rail">
      <div style={{ padding: 14, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: colors.orange,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: colors.text, fontWeight: 700, fontSize: 13 }}>
              {t("legacyAi.taskRail.workspaceTitle")}
            </div>
            <div style={{ color: colors.muted, fontSize: 11 }}>
              {t("legacyAi.taskRail.workspaceHandle")}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 12, display: "grid", gap: 8 }}>
        <button
          type="button"
          style={{
            height: 34,
            borderRadius: 7,
            border: `1px solid ${colors.border}`,
            background: colors.surfaceAlt,
            color: colors.muted,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            fontFamily,
            cursor: "pointer",
          }}
        >
          <Search size={14} />
          <span style={{ fontSize: 12 }}>
            {t("legacyAi.taskRail.searchTasks")}
          </span>
        </button>

        <button
          type="button"
          style={{
            height: 34,
            borderRadius: 7,
            border: "none",
            background: colors.orange,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            fontFamily,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Plus size={15} />
          {t("legacyAi.taskRail.newObjective")}
        </button>
      </div>

      <div
        style={{
          padding: "4px 12px 10px",
          color: colors.faint,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0,
          fontWeight: 700,
        }}
      >
        {t("legacyAi.taskRail.activeWork")}
      </div>

      <div style={{ display: "grid", gap: 6, padding: "0 8px" }}>
        {tasks.map((task) => {
          const active = task.id === selectedTaskId;
          const status = getStatusMeta(task.status, t);

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task.id)}
              style={{
                textAlign: "left",
                border: `1px solid ${active ? colors.blue : "transparent"}`,
                background: active ? "#122033" : "transparent",
                color: colors.text,
                borderRadius: 8,
                padding: 10,
                fontFamily,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-label={status.label}
                  title={status.label}
                  style={{
                    color: status.color,
                    display: "inline-flex",
                    flexShrink: 0,
                  }}
                >
                  <StatusIcon status={task.status} />
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {task.title}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  color: colors.muted,
                  fontSize: 11,
                }}
              >
                <FolderKanban size={12} />
                <span style={{ flex: 1, minWidth: 0 }}>{task.project}</span>
                <span>{task.updatedAt}</span>
              </div>
              <div
                style={{
                  height: 4,
                  background: colors.surfaceRaised,
                  borderRadius: 999,
                  marginTop: 9,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: `${task.progress}%`,
                    height: "100%",
                    background: status.color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
