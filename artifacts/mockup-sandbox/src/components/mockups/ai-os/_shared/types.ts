export type AgentRunStatus = "running" | "waiting" | "done" | "paused";

export type TimelineStatus = "done" | "active" | "waiting" | "queued";

export type TimelineKind =
  | "plan"
  | "tool"
  | "change"
  | "test"
  | "preview"
  | "decision";

export type InspectorView = "changes" | "code" | "logs" | "preview";

export interface AgentTask {
  id: string;
  title: string;
  project: string;
  status: AgentRunStatus;
  progress: number;
  updatedAt: string;
  model: string;
  priority: "high" | "normal" | "low";
}

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  status: TimelineStatus;
  title: string;
  detail: string;
  time: string;
  artifact?: string;
  files?: string[];
  requiresApproval?: boolean;
}

export interface FileChange {
  path: string;
  summary: string;
  additions: number;
  deletions: number;
  status: "created" | "modified" | "review";
}

export interface RuntimeSignal {
  label: string;
  value: string;
  state: "good" | "warn" | "neutral";
}

export interface InspectorFile {
  path: string;
  language: string;
  lines: string[];
}
