import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  FileText,
  KeyRound,
  Link2,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  Radio,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type PortalView = "chat" | "steps" | "data" | "sources" | "result";
type PortalStatus = "complete" | "running" | "waiting" | "blocked";
type ModuleId = "web_listening" | "doc_to_md" | "md_to_rag" | "rag_to_agent";
type JsonObject = Record<string, unknown>;
type AgentConnectionStatus = "configured" | "missing_key" | "offline";
type PortalRunSubmitState =
  | "local"
  | "submitting"
  | "refreshing"
  | "saved"
  | "offline"
  | "failed";
type PortalAccessState =
  | "idle"
  | "checking"
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published"
  | "offline"
  | "failed";
type PortalAccessStatus =
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published";
type PortalInteractionStatus =
  | "waiting_for_user"
  | "waiting_for_approval"
  | "waiting_for_data"
  | "blocked"
  | "resumable"
  | "resumed";
type PortalActionState = "idle" | "submitting" | "succeeded" | "failed";
type PortalDetailState = "idle" | "loading" | "ready" | "empty" | "failed";
type PortalRunSyncSource = "submit" | "manual" | "auto";

interface PortalRunSyncSnapshot {
  source: PortalRunSyncSource;
  checkedAt: string;
}

interface PortalInteractionOption {
  id: string;
  label: string;
  value?: unknown;
}

interface PortalToolInteraction {
  interactionId: string;
  status: PortalInteractionStatus;
  kind: "question" | "approval" | "data_request" | "blocked";
  title: string;
  message: string;
  prompt: string | null;
  options: PortalInteractionOption[];
  artifactIds: string[];
  resumeHandle: string | null;
  requestedAt: string;
  metadata: JsonObject;
}

interface PortalStep {
  id: string;
  moduleId: ModuleId;
  label: string;
  adminModule: string;
  status: PortalStatus;
  summary: string;
  dataCount: string;
  updatedAt: string;
  runId?: string;
  externalRunId?: string;
  interaction?: PortalToolInteraction;
}

interface PortalDataRecord {
  id: string;
  kind: string;
  title: string;
  step: string;
  stepId?: string;
  runId?: string;
  artifactId?: string;
  detail: string;
  updatedAt: string;
}

interface PortalSource {
  id: string;
  label: string;
  type: string;
  step: string;
  freshness: string;
  summary: string;
  runId?: string;
  artifactId?: string;
  evidenceTitle: string;
  evidenceDetail: string;
}

type PortalResultItemKind =
  | "agent_config"
  | "memory"
  | "source_package"
  | "handoff";

interface PortalResultItem {
  id: string;
  kind: PortalResultItemKind;
  title: string;
  moduleId?: ModuleId;
  runId?: string;
  status: string;
  summary: string;
  detail: string;
}

interface PortalMessage {
  id: string;
  speaker: "user" | "agent";
  text: string;
  meta: string;
}

interface PortalAgentRunApiModuleRun {
  id: string;
  pipelineRunId: string | null;
  moduleId: ModuleId;
  externalRunId: string;
  title: string | null;
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  inputJson: JsonObject | null;
  outputJson: JsonObject | null;
  summary: string | null;
  metadata: JsonObject | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PortalRunEvent {
  id: string;
  moduleRunId: string;
  eventType: string;
  title: string | null;
  message: string | null;
  severity: "info" | "warning" | "error";
  payload: JsonObject | null;
  createdAt: string;
}

interface PortalArtifact {
  id: string;
  artifactKind: string;
  title: string;
  contentText: string | null;
  contentJson: JsonObject | null;
  sourceModuleId: ModuleId;
  sourceRunId: string;
  parentArtifactId: string | null;
  provenance: JsonObject | null;
  createdAt: string;
  updatedAt: string;
}

interface PortalModuleRunDetail {
  run: PortalAgentRunApiModuleRun;
  events: PortalRunEvent[];
  artifacts: PortalArtifact[];
}

interface PortalAgentRunApiPlanStep {
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
}

interface PortalAgentRunApiResponse {
  status: "planned" | "missing_key" | "needs_approval" | "failed";
  connection: { status: AgentConnectionStatus };
  agentMessage: { content: string };
  pipelineRun: {
    id: string;
    title: string;
    status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
    metadata: JsonObject | null;
    updatedAt: string;
  };
  moduleRuns: PortalAgentRunApiModuleRun[];
  plan: {
    summary: string;
    steps: PortalAgentRunApiPlanStep[];
    warnings: string[];
  };
}

interface PortalToolInteractionApiResponse {
  run: PortalAgentRunApiModuleRun;
  interaction: PortalToolInteraction;
}

interface PortalAccessVerificationResponse {
  status: PortalAccessStatus;
  authorized: boolean;
  publishStatus: "draft" | "published" | "paused";
  versionLabel: string;
  portalTokenLast4: string | null;
  checkedAt: string;
}

interface PortalRunUiState {
  response: PortalAgentRunApiResponse;
  steps: PortalStep[];
  messages: PortalMessage[];
  dataRecords: PortalDataRecord[];
  sources: PortalSource[];
  readiness: ReadonlyArray<readonly [string, string]>;
  resultItems: PortalResultItem[];
}

const portalSteps: PortalStep[] = [
  {
    id: "listen",
    moduleId: "web_listening",
    label: "Listen",
    adminModule: "web_listening",
    status: "complete",
    summary: "Watched source URLs and captured changed pages.",
    dataCount: "18 snapshots",
    updatedAt: "2 min ago",
  },
  {
    id: "convert",
    moduleId: "doc_to_md",
    label: "Convert",
    adminModule: "doc_to_md",
    status: "complete",
    summary: "Converted source material into clean Markdown records.",
    dataCount: "6 markdown docs",
    updatedAt: "1 min ago",
  },
  {
    id: "index",
    moduleId: "md_to_rag",
    label: "Index",
    adminModule: "md_to_rag",
    status: "running",
    summary: "Chunking Markdown and preparing retrieval metadata.",
    dataCount: "96 / 124 chunks",
    updatedAt: "running",
  },
  {
    id: "generate",
    moduleId: "rag_to_agent",
    label: "Generate Agent",
    adminModule: "rag_to_agent",
    status: "waiting",
    summary: "Waiting for validated RAG memory before final agent output.",
    dataCount: "draft config",
    updatedAt: "queued",
    interaction: {
      interactionId: "demo-agent-approval",
      status: "waiting_for_approval",
      kind: "approval",
      title: "Approve final agent draft",
      message:
        "Review the generated prompt and tool policy before the published agent is unlocked.",
      prompt: "Approve this draft for publish?",
      options: [
        { id: "approve", label: "Approve" },
        { id: "revise", label: "Request revision" },
      ],
      artifactIds: [],
      resumeHandle: "demo-agent-approval:resume",
      requestedAt: new Date(0).toISOString(),
      metadata: { source: "local-demo" },
    },
  },
];

const portalMessages: PortalMessage[] = [
  {
    id: "m1",
    speaker: "user",
    text: "Build an onboarding knowledge agent from the watched docs and show me what changed.",
    meta: "Request",
  },
  {
    id: "m2",
    speaker: "agent",
    text: "The run has finished Listen and Convert. Index is active now, with 96 of 124 chunks ready. You can inspect the step timeline, source citations, or the database records while validation waits.",
    meta: "Agent progress",
  },
];

const dataRecords: PortalDataRecord[] = [
  {
    id: "d1",
    kind: "Snapshot",
    title: "Docs landing page",
    step: "Listen",
    detail:
      "Captured text and change metadata from the watched documentation URL.",
    updatedAt: "2 min ago",
  },
  {
    id: "d2",
    kind: "Markdown",
    title: "Onboarding guide.md",
    step: "Convert",
    detail:
      "Converted source document into Markdown with 2 conversion warnings.",
    updatedAt: "1 min ago",
  },
  {
    id: "d3",
    kind: "Chunk",
    title: "Authentication setup chunk",
    step: "Index",
    detail:
      "843 tokens with embedding metadata prepared for the RAG collection.",
    updatedAt: "running",
  },
  {
    id: "d4",
    kind: "Agent config",
    title: "Support agent draft",
    step: "Generate Agent",
    detail:
      "Prompt and tool plan waiting for index validation before publishing.",
    updatedAt: "queued",
  },
];

const portalSources: PortalSource[] = [
  {
    id: "s1",
    label: "docs.example.com/start",
    type: "Watched URL",
    step: "Listen",
    freshness: "Snapshot captured 2 min ago",
    summary:
      "Primary onboarding page used to detect copy and setup flow changes.",
    evidenceTitle: "Watched URL snapshot",
    evidenceDetail:
      "The Listen step captured page text and change metadata before downstream conversion.",
  },
  {
    id: "s2",
    label: "Onboarding Guide export",
    type: "Source document",
    step: "Convert",
    freshness: "Converted 1 min ago",
    summary: "Original user guide converted into Markdown before chunking.",
    evidenceTitle: "Converted source document",
    evidenceDetail:
      "The Convert step normalized the original guide into Markdown before chunking.",
  },
  {
    id: "s3",
    label: "RAG collection onboarding-v1",
    type: "Memory record",
    step: "Index",
    freshness: "96 chunks indexed",
    summary: "Retrieval memory that will power the published Agent answers.",
    evidenceTitle: "RAG memory collection",
    evidenceDetail:
      "The Index step stores chunks and retrieval metadata for the published Agent.",
  },
];

const modulePortalLabels: Record<
  ModuleId,
  { id: string; label: string; fallbackSummary: string; fallbackData: string }
> = {
  web_listening: {
    id: "listen",
    label: "Listen",
    fallbackSummary: "Watched source URLs and captured changed pages.",
    fallbackData: "snapshots",
  },
  doc_to_md: {
    id: "convert",
    label: "Convert",
    fallbackSummary: "Converted source material into clean Markdown records.",
    fallbackData: "markdown docs",
  },
  md_to_rag: {
    id: "index",
    label: "Index",
    fallbackSummary: "Chunking Markdown and preparing retrieval metadata.",
    fallbackData: "chunks",
  },
  rag_to_agent: {
    id: "generate",
    label: "Generate Agent",
    fallbackSummary: "Generating and validating the agent handoff.",
    fallbackData: "agent config",
  },
};

const readiness = [
  ["RAG index", "Running"],
  ["Validation", "Queued"],
  ["Published URL", "Locked until validation"],
  ["Agent version", "draft-0.3"],
] as const;

const resultItems: PortalResultItem[] = [
  {
    id: "local-agent-config",
    kind: "agent_config",
    title: "Support agent draft",
    moduleId: "rag_to_agent",
    status: "Waiting for approval",
    summary:
      "Draft prompt, tool policy, and handoff notes are ready for review.",
    detail:
      "Generated from the indexed onboarding collection and waiting on the final approval step.",
  },
  {
    id: "local-memory",
    kind: "memory",
    title: "Onboarding RAG memory",
    moduleId: "md_to_rag",
    status: "Indexing",
    summary: "96 of 124 chunks are ready for retrieval.",
    detail:
      "The published Agent will answer from this collection once indexing and validation complete.",
  },
];

const navItems: Array<{ id: PortalView; label: string; icon: ReactNode }> = [
  { id: "chat", label: "Chat", icon: <MessageSquareText size={18} /> },
  { id: "steps", label: "Steps", icon: <ListChecks size={18} /> },
  { id: "data", label: "Data", icon: <Database size={18} /> },
  { id: "sources", label: "Sources", icon: <FileSearch size={18} /> },
  { id: "result", label: "Result", icon: <Sparkles size={18} /> },
];

function readInitialDemoToken(): string {
  if (typeof window === "undefined") return "";
  // Mock preview shortcut only. Production portal access must use server-side auth/session state.
  return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
}

function readInitialDemoAdminToken(): string {
  if (typeof window === "undefined") return "";
  // Mock preview shortcut only. Production admin access must not depend on URL query tokens.
  return (
    new URLSearchParams(window.location.search).get("adminToken")?.trim() ?? ""
  );
}

function previewUrl(componentPath: string, search = ""): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${basePath}/preview/${componentPath}${search}`;
}

function portalRuntimeHeaders(
  tokenValue: string,
  input: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    ...input,
    "X-AI-Interface-Surface": "agent-portal",
  };
  const cleanToken = tokenValue.trim();
  if (cleanToken) headers["X-Portal-Token"] = cleanToken;
  return headers;
}

function isPortalRuntimeAccessDenied(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function statusIcon(status: PortalStatus): ReactNode {
  if (status === "complete") return <CheckCircle2 size={16} />;
  if (status === "running") return <Radio size={16} />;
  return <Clock3 size={16} />;
}

function statusText(status: PortalStatus): string {
  if (status === "complete") return "Complete";
  if (status === "running") return "Running";
  if (status === "blocked") return "Blocked";
  return "Waiting";
}

function portalRunStateLabel(state: PortalRunSubmitState): string {
  if (state === "submitting") return "Submitting";
  if (state === "refreshing") return "Refreshing";
  if (state === "saved") return "API saved";
  if (state === "offline") return "API offline";
  if (state === "failed") return "API failed";
  return "Local demo";
}

function portalAutoRefreshLabel({
  isAvailable,
  isEnabled,
  isActive,
  isPaused,
}: {
  isAvailable: boolean;
  isEnabled: boolean;
  isActive: boolean;
  isPaused: boolean;
}): string {
  if (!isAvailable) return "Auto idle";
  if (!isEnabled) return "Auto off";
  if (isActive) return "Auto active";
  if (isPaused) return "Auto paused";
  return "Auto on";
}

function portalAccessStateLabel(state: PortalAccessState): string {
  if (state === "checking") return "Checking";
  if (state === "authorized") return "API authorized";
  if (state === "missing_token") return "Token required";
  if (state === "invalid_token") return "Invalid token";
  if (state === "not_published") return "Not published";
  if (state === "offline") return "Demo offline";
  if (state === "failed") return "Verification failed";
  return "Locked";
}

function metadataString(
  metadata: JsonObject | null,
  key: string,
  fallback: string,
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableJsonObject(value: unknown): value is JsonObject | null {
  return value === null || isJsonObject(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPortalAccessStatus(value: unknown): value is PortalAccessStatus {
  return (
    value === "authorized" ||
    value === "missing_token" ||
    value === "invalid_token" ||
    value === "not_published"
  );
}

function isPublishStatus(
  value: unknown,
): value is PortalAccessVerificationResponse["publishStatus"] {
  return value === "draft" || value === "published" || value === "paused";
}

function isPortalAccessVerificationResponse(
  value: unknown,
): value is PortalAccessVerificationResponse {
  if (!isJsonObject(value)) return false;
  return (
    isPortalAccessStatus(value["status"]) &&
    typeof value["authorized"] === "boolean" &&
    isPublishStatus(value["publishStatus"]) &&
    typeof value["versionLabel"] === "string" &&
    isNullableString(value["portalTokenLast4"]) &&
    typeof value["checkedAt"] === "string"
  );
}

function isModuleId(value: unknown): value is ModuleId {
  return (
    value === "web_listening" ||
    value === "doc_to_md" ||
    value === "md_to_rag" ||
    value === "rag_to_agent"
  );
}

function isConnectionStatus(value: unknown): value is AgentConnectionStatus {
  return (
    value === "configured" || value === "missing_key" || value === "offline"
  );
}

function isAgentRunStatus(
  value: unknown,
): value is PortalAgentRunApiResponse["status"] {
  return (
    value === "planned" ||
    value === "missing_key" ||
    value === "needs_approval" ||
    value === "failed"
  );
}

function isModuleRunStatus(
  value: unknown,
): value is PortalAgentRunApiModuleRun["status"] {
  return (
    value === "pending" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled"
  );
}

function isPipelineStatus(
  value: unknown,
): value is PortalAgentRunApiResponse["pipelineRun"]["status"] {
  return isModuleRunStatus(value);
}

function isPortalPipelineInProgress(
  status: PortalAgentRunApiResponse["pipelineRun"]["status"],
): boolean {
  return status === "pending" || status === "running";
}

function isPortalAgentRunApiModuleRun(
  value: unknown,
): value is PortalAgentRunApiModuleRun {
  if (!isJsonObject(value)) return false;
  return (
    typeof value["id"] === "string" &&
    (value["pipelineRunId"] === null ||
      typeof value["pipelineRunId"] === "string") &&
    isModuleId(value["moduleId"]) &&
    typeof value["externalRunId"] === "string" &&
    isNullableString(value["title"]) &&
    isModuleRunStatus(value["status"]) &&
    isNullableJsonObject(value["inputJson"]) &&
    isNullableJsonObject(value["outputJson"]) &&
    isNullableString(value["summary"]) &&
    isNullableJsonObject(value["metadata"]) &&
    isNullableString(value["startedAt"]) &&
    isNullableString(value["completedAt"]) &&
    typeof value["createdAt"] === "string" &&
    typeof value["updatedAt"] === "string"
  );
}

function isPortalRunEvent(value: unknown): value is PortalRunEvent {
  if (!isJsonObject(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["moduleRunId"] === "string" &&
    typeof value["eventType"] === "string" &&
    isNullableString(value["title"]) &&
    isNullableString(value["message"]) &&
    (value["severity"] === "info" ||
      value["severity"] === "warning" ||
      value["severity"] === "error") &&
    isNullableJsonObject(value["payload"]) &&
    typeof value["createdAt"] === "string"
  );
}

function isPortalArtifact(value: unknown): value is PortalArtifact {
  if (!isJsonObject(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["artifactKind"] === "string" &&
    typeof value["title"] === "string" &&
    isNullableString(value["contentText"]) &&
    isNullableJsonObject(value["contentJson"]) &&
    isModuleId(value["sourceModuleId"]) &&
    typeof value["sourceRunId"] === "string" &&
    isNullableString(value["parentArtifactId"]) &&
    isNullableJsonObject(value["provenance"]) &&
    typeof value["createdAt"] === "string" &&
    typeof value["updatedAt"] === "string"
  );
}

function isPortalModuleRunDetail(
  value: unknown,
): value is PortalModuleRunDetail {
  if (!isJsonObject(value)) return false;
  return (
    isPortalAgentRunApiModuleRun(value["run"]) &&
    Array.isArray(value["events"]) &&
    value["events"].every(isPortalRunEvent) &&
    Array.isArray(value["artifacts"]) &&
    value["artifacts"].every(isPortalArtifact)
  );
}

function isPortalAgentRunApiPlanStep(
  value: unknown,
): value is PortalAgentRunApiPlanStep {
  if (!isJsonObject(value)) return false;
  return (
    isModuleId(value["moduleId"]) &&
    typeof value["title"] === "string" &&
    typeof value["action"] === "string" &&
    isJsonObject(value["input"]) &&
    typeof value["requiresApproval"] === "boolean"
  );
}

function isPortalAgentRunApiResponse(
  value: unknown,
): value is PortalAgentRunApiResponse {
  if (!isJsonObject(value)) return false;
  const connection = value["connection"];
  const agentMessage = value["agentMessage"];
  const pipelineRun = value["pipelineRun"];
  const plan = value["plan"];

  return (
    isAgentRunStatus(value["status"]) &&
    isJsonObject(connection) &&
    isConnectionStatus(connection["status"]) &&
    isJsonObject(agentMessage) &&
    typeof agentMessage["content"] === "string" &&
    isJsonObject(pipelineRun) &&
    typeof pipelineRun["id"] === "string" &&
    typeof pipelineRun["title"] === "string" &&
    isPipelineStatus(pipelineRun["status"]) &&
    isNullableJsonObject(pipelineRun["metadata"]) &&
    typeof pipelineRun["updatedAt"] === "string" &&
    Array.isArray(value["moduleRuns"]) &&
    value["moduleRuns"].every(isPortalAgentRunApiModuleRun) &&
    isJsonObject(plan) &&
    typeof plan["summary"] === "string" &&
    Array.isArray(plan["steps"]) &&
    plan["steps"].every(isPortalAgentRunApiPlanStep) &&
    Array.isArray(plan["warnings"]) &&
    plan["warnings"].every((warning) => typeof warning === "string")
  );
}

function isPortalInteractionStatus(
  value: unknown,
): value is PortalInteractionStatus {
  return (
    value === "waiting_for_user" ||
    value === "waiting_for_approval" ||
    value === "waiting_for_data" ||
    value === "blocked" ||
    value === "resumable" ||
    value === "resumed"
  );
}

function isPortalInteractionKind(
  value: unknown,
): value is PortalToolInteraction["kind"] {
  return (
    value === "question" ||
    value === "approval" ||
    value === "data_request" ||
    value === "blocked"
  );
}

function isPortalInteractionOption(
  value: unknown,
): value is PortalInteractionOption {
  if (!isJsonObject(value)) return false;
  return typeof value["id"] === "string" && typeof value["label"] === "string";
}

function parsePortalToolInteraction(
  metadata: JsonObject | null,
): PortalToolInteraction | null {
  const value = metadata?.["interaction"];
  if (!isJsonObject(value)) return null;
  if (
    typeof value["interactionId"] !== "string" ||
    !isPortalInteractionStatus(value["status"]) ||
    !isPortalInteractionKind(value["kind"]) ||
    typeof value["title"] !== "string" ||
    typeof value["message"] !== "string" ||
    typeof value["requestedAt"] !== "string"
  ) {
    return null;
  }

  return {
    interactionId: value["interactionId"],
    status: value["status"],
    kind: value["kind"],
    title: value["title"],
    message: value["message"],
    prompt: typeof value["prompt"] === "string" ? value["prompt"] : null,
    options: Array.isArray(value["options"])
      ? value["options"].filter(isPortalInteractionOption)
      : [],
    artifactIds: Array.isArray(value["artifactIds"])
      ? value["artifactIds"].filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    resumeHandle:
      typeof value["resumeHandle"] === "string" ? value["resumeHandle"] : null,
    requestedAt: value["requestedAt"],
    metadata: isJsonObject(value["metadata"]) ? value["metadata"] : {},
  };
}

function isPortalToolInteractionApiResponse(
  value: unknown,
): value is PortalToolInteractionApiResponse {
  if (!isJsonObject(value)) return false;
  return (
    isPortalAgentRunApiModuleRun(value["run"]) &&
    isJsonObject(value["interaction"]) &&
    parsePortalToolInteraction({ interaction: value["interaction"] }) !== null
  );
}

function shortRunId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function portalStatusFromApiRun(run: PortalAgentRunApiModuleRun): PortalStatus {
  const interaction = parsePortalToolInteraction(run.metadata);
  if (run.status === "succeeded") return "complete";
  if (run.status === "failed" || run.status === "cancelled") return "blocked";
  if (interaction?.status === "blocked") return "blocked";
  if (interaction?.status === "resumed") return "running";
  if (interaction) return "waiting";
  if (run.status === "running") return "running";
  return "waiting";
}

function interactionStatusText(status: PortalInteractionStatus): string {
  if (status === "waiting_for_approval") return "Approval";
  if (status === "waiting_for_data") return "Needs data";
  if (status === "waiting_for_user") return "Needs reply";
  if (status === "blocked") return "Blocked";
  if (status === "resumable") return "Resume ready";
  return "Resumed";
}

function isFeedbackReadyInteraction(
  interaction: PortalToolInteraction,
): boolean {
  return (
    interaction.status === "waiting_for_user" ||
    interaction.status === "waiting_for_approval" ||
    interaction.status === "waiting_for_data" ||
    interaction.status === "blocked"
  );
}

function formatApiTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function portalRunSyncSourceLabel(source: PortalRunSyncSource): string {
  if (source === "submit") return "Submitted";
  if (source === "auto") return "Auto";
  return "Manual";
}

function toPortalStepFromApiRun(run: PortalAgentRunApiModuleRun): PortalStep {
  const label = modulePortalLabels[run.moduleId];
  const interaction = parsePortalToolInteraction(run.metadata);
  const requiresApproval = run.metadata?.["requiresApproval"] === true;
  const wasSkipped = run.metadata?.["adapterExecutionStatus"] === "skipped";
  const summary =
    run.summary ??
    interaction?.message ??
    metadataString(
      run.metadata,
      "action",
      requiresApproval
        ? `${label.label} needs approval before it can continue.`
        : wasSkipped
          ? `${label.label} needs adapter configuration before it can run.`
          : label.fallbackSummary,
    );

  return {
    id: `${label.id}-${run.id}`,
    moduleId: run.moduleId,
    label: label.label,
    adminModule: run.moduleId,
    status: portalStatusFromApiRun(run),
    summary,
    dataCount: run.outputJson
      ? `API result ${shortRunId(run.id)}`
      : label.fallbackData,
    updatedAt: formatApiTime(run.updatedAt),
    runId: run.id,
    externalRunId: run.externalRunId,
    interaction: interaction ?? undefined,
  };
}

function toPortalUiState(
  response: PortalAgentRunApiResponse,
): PortalRunUiState {
  const steps = response.moduleRuns.map(toPortalStepFromApiRun);
  const messages: PortalMessage[] = [
    ...portalMessages,
    {
      id: `api-${response.pipelineRun.id}`,
      speaker: "agent",
      text: response.agentMessage.content,
      meta: `API run ${shortRunId(response.pipelineRun.id)}`,
    },
  ];
  const dataRecords: PortalDataRecord[] = response.moduleRuns.map((run) => {
    const step = modulePortalLabels[run.moduleId];
    return {
      id: `api-data-${run.id}`,
      kind: run.outputJson ? "API result" : "Module run",
      title: run.title ?? step.label,
      step: step.label,
      stepId: `${step.id}-${run.id}`,
      runId: run.id,
      detail:
        run.summary ??
        metadataString(run.metadata, "action", step.fallbackSummary),
      updatedAt: formatApiTime(run.updatedAt),
    };
  });
  const sources: PortalSource[] = response.moduleRuns.map((run) => {
    const step = modulePortalLabels[run.moduleId];
    return {
      id: `api-source-${run.id}`,
      label: run.externalRunId,
      type: run.moduleId,
      step: step.label,
      freshness: `Updated ${formatApiTime(run.updatedAt)}`,
      summary:
        run.summary ??
        metadataString(run.metadata, "action", step.fallbackSummary),
      runId: run.id,
      evidenceTitle: run.title ?? step.label,
      evidenceDetail: metadataString(
        run.metadata,
        "adapterReadinessHint",
        "Open details to inspect stored events and artifacts.",
      ),
    };
  });
  const completedCount = steps.filter(
    (step) => step.status === "complete",
  ).length;
  const readiness = [
    ["Pipeline", response.pipelineRun.status],
    ["Connection", response.connection.status],
    ["Completed steps", `${completedCount} / ${steps.length}`],
    ["Agent status", response.status.replace("_", " ")],
  ] as const;
  const mappedResultItems: PortalResultItem[] = response.moduleRuns
    .filter((run) => run.moduleId === "rag_to_agent" || run.outputJson)
    .sort((first, second) => {
      if (first.moduleId === second.moduleId) return 0;
      if (first.moduleId === "rag_to_agent") return -1;
      if (second.moduleId === "rag_to_agent") return 1;
      return 0;
    })
    .map((run) => {
      const step = modulePortalLabels[run.moduleId];
      return {
        id: `api-result-${run.id}`,
        kind: run.moduleId === "rag_to_agent" ? "agent_config" : "handoff",
        title: run.title ?? step.label,
        moduleId: run.moduleId,
        runId: run.id,
        status: run.status,
        summary:
          run.summary ??
          metadataString(run.metadata, "action", step.fallbackSummary),
        detail: run.outputJson
          ? JSON.stringify(run.outputJson, null, 2)
          : metadataString(
              run.metadata,
              "adapterReadinessHint",
              "Open details to inspect final run artifacts.",
            ),
      };
    });
  const resultItems =
    mappedResultItems.length > 0
      ? mappedResultItems
      : [
          {
            id: `api-result-${response.pipelineRun.id}`,
            kind: "handoff" as const,
            title: response.pipelineRun.title,
            status: response.pipelineRun.status,
            summary: response.agentMessage.content,
            detail: response.plan.summary,
          },
        ];
  return {
    response,
    steps,
    messages,
    dataRecords,
    sources,
    readiness,
    resultItems,
  };
}

export function AgentPortalInterface() {
  const initialToken = useMemo(readInitialDemoToken, []);
  const initialAdminToken = useMemo(readInitialDemoAdminToken, []);
  const [token, setToken] = useState(initialToken);
  const [authorizedPortalToken, setAuthorizedPortalToken] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [portalAccessState, setPortalAccessState] = useState<PortalAccessState>(
    initialToken ? "checking" : "idle",
  );
  const [portalAccessStatusText, setPortalAccessStatusText] = useState(
    initialToken ? "Checking Portal token" : "Enter Portal token",
  );
  const [portalAccessVersionLabel, setPortalAccessVersionLabel] =
    useState("draft-0.3");
  const [adminToken, setAdminToken] = useState(initialAdminToken);
  const [isAdminGateOpen, setIsAdminGateOpen] = useState(false);
  const [activeView, setActiveView] = useState<PortalView>("chat");
  const [activeStep, setActiveStep] = useState(portalSteps[2].id);
  const [draft, setDraft] = useState("");
  const [portalRunState, setPortalRunState] =
    useState<PortalRunSubmitState>("local");
  const [portalRunStatusText, setPortalRunStatusText] =
    useState("Local demo runtime");
  const [latestPortalRun, setLatestPortalRun] =
    useState<PortalRunUiState | null>(null);
  const [portalRunSyncSnapshot, setPortalRunSyncSnapshot] =
    useState<PortalRunSyncSnapshot | null>(null);
  const [isPortalAutoRefreshEnabled, setIsPortalAutoRefreshEnabled] =
    useState(true);
  const [portalActionStates, setPortalActionStates] = useState<
    Record<string, PortalActionState>
  >({});
  const [portalActionStatusText, setPortalActionStatusText] = useState(
    "Feedback actions are local until API run data is available",
  );
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(
    {},
  );
  const [selectedInteractionOptions, setSelectedInteractionOptions] = useState<
    Record<string, string>
  >({});
  const [selectedDataRecordId, setSelectedDataRecordId] = useState<
    string | null
  >(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedResultItemId, setSelectedResultItemId] = useState<
    string | null
  >(null);
  const [portalDetailStates, setPortalDetailStates] = useState<
    Record<string, PortalDetailState>
  >({});
  const [portalRunDetails, setPortalRunDetails] = useState<
    Record<string, PortalModuleRunDetail>
  >({});
  const [selectedArtifactByRunId, setSelectedArtifactByRunId] = useState<
    Record<string, string>
  >({});
  const [portalArtifactDetails, setPortalArtifactDetails] = useState<
    Record<string, PortalArtifact>
  >({});
  const [portalDetailStatusText, setPortalDetailStatusText] = useState(
    "Open a data record to inspect stored module artifacts",
  );
  const [portalSourceStatusText, setPortalSourceStatusText] = useState(
    "Open a source to inspect evidence and provenance",
  );
  const [portalResultStatusText, setPortalResultStatusText] = useState(
    "Open a result item to inspect handoff details",
  );
  const portalActionInFlightRef = useRef<Set<string>>(new Set());
  const portalDetailCacheGenerationRef = useRef(0);

  const displayedSteps = latestPortalRun?.steps ?? portalSteps;
  const displayedMessages = latestPortalRun?.messages ?? portalMessages;
  const displayedDataRecords = latestPortalRun?.dataRecords ?? dataRecords;
  const displayedSources = latestPortalRun?.sources ?? portalSources;
  const displayedReadiness = latestPortalRun?.readiness ?? readiness;
  const displayedResultItems = latestPortalRun?.resultItems ?? resultItems;
  const isPortalRunInProgress = latestPortalRun
    ? isPortalPipelineInProgress(latestPortalRun.response.pipelineRun.status)
    : false;
  const canAutoRefreshPortalRun =
    isUnlocked &&
    Boolean(latestPortalRun) &&
    isPortalRunInProgress &&
    portalRunState === "saved";
  const isPortalAutoRefreshAvailable =
    Boolean(latestPortalRun) && isPortalRunInProgress;
  const isPortalAutoRefreshActive =
    isPortalAutoRefreshEnabled && canAutoRefreshPortalRun;
  const isPortalAutoRefreshPaused =
    isPortalAutoRefreshEnabled &&
    isPortalAutoRefreshAvailable &&
    !canAutoRefreshPortalRun;
  const portalAutoRefreshButtonLabel = portalAutoRefreshLabel({
    isAvailable: isPortalAutoRefreshAvailable,
    isEnabled: isPortalAutoRefreshEnabled,
    isActive: isPortalAutoRefreshActive,
    isPaused: isPortalAutoRefreshPaused,
  });

  function beginPortalAction(stepId: string): boolean {
    if (portalActionInFlightRef.current.has(stepId)) return false;
    portalActionInFlightRef.current.add(stepId);
    setPortalActionStates((current) => ({
      ...current,
      [stepId]: "submitting",
    }));
    return true;
  }

  function finishPortalAction(
    stepId: string,
    state: Exclude<PortalActionState, "submitting">,
  ): void {
    portalActionInFlightRef.current.delete(stepId);
    setPortalActionStates((current) => ({ ...current, [stepId]: state }));
  }

  const activeStepRecord = useMemo(
    () =>
      displayedSteps.find((step) => step.id === activeStep) ??
      displayedSteps[0] ??
      portalSteps[2],
    [activeStep, displayedSteps],
  );

  const filteredData = useMemo(() => {
    const selectedStep = displayedSteps.find((step) => step.id === activeStep);
    return displayedDataRecords.filter((record) =>
      record.stepId
        ? record.stepId === activeStep
        : selectedStep
          ? record.step === selectedStep.label
          : false,
    );
  }, [activeStep, displayedDataRecords, displayedSteps]);

  function unlockLocalDemoPortal(tokenValue: string): void {
    setIsUnlocked(true);
    setAuthorizedPortalToken(tokenValue);
    setPortalAccessState("offline");
    setPortalAccessStatusText("API offline - local demo Portal unlocked");
    setLatestPortalRun(null);
    setPortalRunSyncSnapshot(null);
    setPortalRunState("local");
    setPortalRunStatusText("Local demo runtime");
  }

  async function isPortalApiUnavailable(): Promise<boolean> {
    try {
      const healthResponse = await fetch("/api/healthz", {
        headers: { Accept: "application/json" },
      });
      const contentType = healthResponse.headers.get("content-type") ?? "";
      return !healthResponse.ok || !contentType.includes("application/json");
    } catch {
      return true;
    }
  }

  async function fallBackToLocalDemoIfApiUnavailable(
    cleanToken: string,
  ): Promise<boolean> {
    if (cleanToken.length < 6) return false;
    if (!(await isPortalApiUnavailable())) return false;
    unlockLocalDemoPortal(cleanToken);
    return true;
  }

  function lockPortalAfterRuntimeAccessDenied(): void {
    setIsUnlocked(false);
    setAuthorizedPortalToken("");
    setPortalAccessState("invalid_token");
    setPortalAccessStatusText(
      "Portal access was rejected by the runtime API. Re-enter a valid token.",
    );
    setPortalRunState("failed");
    setPortalRunStatusText("Portal access rejected by runtime API");
    setPortalActionStatusText("Portal access rejected by runtime API");
    setPortalDetailStatusText("Portal access rejected by runtime API");
    setPortalSourceStatusText("Portal access rejected by runtime API");
    setPortalResultStatusText("Portal access rejected by runtime API");
  }

  function resetPortalDetailCachesAfterRefresh(): void {
    portalDetailCacheGenerationRef.current += 1;
    setPortalDetailStates({});
    setPortalRunDetails({});
    setSelectedArtifactByRunId({});
    setPortalArtifactDetails({});
    setPortalDetailStatusText(
      "Run refreshed - open a data record to reload module artifacts",
    );
    setPortalSourceStatusText(
      "Run refreshed - open a source to reload evidence",
    );
    setPortalResultStatusText(
      "Run refreshed - open a result item to reload handoff details",
    );
  }

  async function verifyPortalToken(tokenInput: string): Promise<void> {
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setIsUnlocked(false);
      setAuthorizedPortalToken("");
      setPortalAccessState("missing_token");
      setPortalAccessStatusText("Enter a Portal token to continue");
      return;
    }

    setPortalAccessState("checking");
    setPortalAccessStatusText("Checking Portal token");

    let response: Response;
    try {
      response = await fetch("/api/portal-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleanToken }),
      });
    } catch {
      if (cleanToken.length >= 6) {
        unlockLocalDemoPortal(cleanToken);
        return;
      }
      setIsUnlocked(false);
      setAuthorizedPortalToken("");
      setPortalAccessState("failed");
      setPortalAccessStatusText("Portal access API unavailable");
      return;
    }

    if (!response.ok) {
      if (await fallBackToLocalDemoIfApiUnavailable(cleanToken)) return;
      setIsUnlocked(false);
      setAuthorizedPortalToken("");
      setPortalAccessState("failed");
      setPortalAccessStatusText(
        `Portal access API returned ${response.status}; access remains locked`,
      );
      return;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (await fallBackToLocalDemoIfApiUnavailable(cleanToken)) return;
      setIsUnlocked(false);
      setAuthorizedPortalToken("");
      setPortalAccessState("failed");
      setPortalAccessStatusText("Portal access API returned invalid JSON");
      return;
    }

    if (!isPortalAccessVerificationResponse(data)) {
      if (await fallBackToLocalDemoIfApiUnavailable(cleanToken)) return;
      setIsUnlocked(false);
      setAuthorizedPortalToken("");
      setPortalAccessState("failed");
      setPortalAccessStatusText(
        "Portal access API returned an unexpected payload",
      );
      return;
    }

    setPortalAccessVersionLabel(data.versionLabel);
    setPortalAccessState(data.status);
    if (data.authorized) {
      setIsUnlocked(true);
      setAuthorizedPortalToken(cleanToken);
      setPortalAccessStatusText(
        `Published Agent ${data.versionLabel} unlocked`,
      );
      return;
    }

    setIsUnlocked(false);
    setAuthorizedPortalToken("");
    if (data.status === "not_published") {
      setPortalAccessStatusText(
        `Agent is ${data.publishStatus}; Portal is not open yet`,
      );
      return;
    }
    if (data.status === "invalid_token") {
      setPortalAccessStatusText("Token was checked by API and rejected");
      return;
    }
    setPortalAccessStatusText("Enter a Portal token to continue");
  }

  useEffect(() => {
    if (initialToken) void verifyPortalToken(initialToken);
    // Query-token preview is a one-time mount shortcut for local demos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isPortalAutoRefreshEnabled || !canAutoRefreshPortalRun) return;

    const intervalId = window.setInterval(() => {
      void refreshPortalRun("auto");
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [canAutoRefreshPortalRun, isPortalAutoRefreshEnabled, latestPortalRun]);

  async function submitToken(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await verifyPortalToken(token);
  }

  function submitAdminToken(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const cleanToken = adminToken.trim();
    if (!cleanToken) {
      setIsAdminGateOpen(false);
      return;
    }
    if (cleanToken.length >= 6) {
      window.location.assign(
        previewUrl(
          "ai-os/AgentFirstInterface",
          `?adminToken=${encodeURIComponent(cleanToken)}`,
        ),
      );
    }
  }

  async function submitPortalPrompt(): Promise<void> {
    if (portalRunState === "submitting" || portalRunState === "refreshing") {
      return;
    }
    const prompt = draft.trim();
    if (!prompt) return;

    setDraft("");
    setPortalRunSyncSnapshot(null);
    portalActionInFlightRef.current.clear();
    setPortalActionStates({});
    setFeedbackDrafts({});
    setSelectedInteractionOptions({});
    setSelectedDataRecordId(null);
    setSelectedSourceId(null);
    setSelectedResultItemId(null);
    portalDetailCacheGenerationRef.current += 1;
    setPortalDetailStates({});
    setPortalRunDetails({});
    setSelectedArtifactByRunId({});
    setPortalArtifactDetails({});
    setPortalActionStatusText(
      "Feedback actions are local until API run data is available",
    );
    setPortalDetailStatusText(
      "Open a data record to inspect stored module artifacts",
    );
    setPortalSourceStatusText(
      "Open a source to inspect evidence and provenance",
    );
    setPortalResultStatusText("Open a result item to inspect handoff details");
    setPortalRunState("submitting");
    setPortalRunStatusText("Submitting to Agent Run API");
    setActiveView("steps");

    try {
      const response = await fetch("/api/agent-runs", {
        method: "POST",
        headers: portalRuntimeHeaders(authorizedPortalToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          message: prompt,
          executionMode: "execute_ready",
          metadata: { source: "agent-portal" },
        }),
      });

      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          setLatestPortalRun(null);
          setActiveStep(portalSteps[2].id);
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        setLatestPortalRun(null);
        setActiveStep(portalSteps[2].id);
        setPortalRunState("failed");
        setPortalRunStatusText("Agent Run API failed - showing local demo");
        return;
      }

      const data = (await response.json()) as unknown;
      if (!isPortalAgentRunApiResponse(data)) {
        setLatestPortalRun(null);
        setActiveStep(portalSteps[2].id);
        setPortalRunState("failed");
        setPortalRunStatusText(
          "Agent Run API returned an unexpected response - showing local demo",
        );
        return;
      }

      const uiState = toPortalUiState(data);
      setLatestPortalRun(uiState);
      setActiveStep(uiState.steps[0]?.id ?? portalSteps[0].id);
      setPortalRunState("saved");
      setPortalRunStatusText(`Saved run ${shortRunId(data.pipelineRun.id)}`);
      setPortalRunSyncSnapshot({
        source: "submit",
        checkedAt: new Date().toISOString(),
      });
    } catch {
      setLatestPortalRun(null);
      setActiveStep(portalSteps[2].id);
      setPortalRunState("offline");
      setPortalRunStatusText("API offline - showing local demo");
    }
  }

  async function refreshPortalRun(
    source: Exclude<PortalRunSyncSource, "submit"> = "manual",
  ): Promise<void> {
    if (
      !latestPortalRun ||
      portalRunState === "submitting" ||
      portalRunState === "refreshing"
    ) {
      return;
    }

    const pipelineRunId = latestPortalRun.response.pipelineRun.id;
    setPortalRunState("refreshing");
    setPortalRunStatusText(`Refreshing run ${shortRunId(pipelineRunId)}`);

    try {
      const response = await fetch(
        `/api/agent-runs/${encodeURIComponent(pipelineRunId)}`,
        {
          headers: portalRuntimeHeaders(authorizedPortalToken),
        },
      );

      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        setPortalRunState("failed");
        setPortalRunStatusText(
          `Refresh failed for run ${shortRunId(pipelineRunId)}`,
        );
        return;
      }

      let data: unknown;
      try {
        data = (await response.json()) as unknown;
      } catch {
        setPortalRunState("failed");
        setPortalRunStatusText(
          `Refresh returned an unexpected response for ${shortRunId(
            pipelineRunId,
          )}`,
        );
        return;
      }

      if (!isPortalAgentRunApiResponse(data)) {
        setPortalRunState("failed");
        setPortalRunStatusText(
          `Refresh returned an unexpected response for ${shortRunId(
            pipelineRunId,
          )}`,
        );
        return;
      }

      const uiState = toPortalUiState(data);
      setLatestPortalRun(uiState);
      resetPortalDetailCachesAfterRefresh();
      setActiveStep((current) =>
        uiState.steps.some((step) => step.id === current)
          ? current
          : (uiState.steps[0]?.id ?? portalSteps[0].id),
      );
      setPortalRunState("saved");
      setPortalRunStatusText(`Refreshed run ${shortRunId(data.pipelineRun.id)}`);
      setPortalRunSyncSnapshot({
        source,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      setPortalRunState("offline");
      setPortalRunStatusText(
        `Refresh unavailable for run ${shortRunId(
          pipelineRunId,
        )} - keeping current view`,
      );
    }
  }

  function updatePortalRunFromModuleRun(run: PortalAgentRunApiModuleRun): void {
    setLatestPortalRun((current) => {
      if (!current) return current;
      const response: PortalAgentRunApiResponse = {
        ...current.response,
        moduleRuns: current.response.moduleRuns.map((item) =>
          item.id === run.id ? run : item,
        ),
      };
      return toPortalUiState(response);
    });
  }

  function handleFeedbackDraftChange(stepId: string, value: string): void {
    setFeedbackDrafts((current) => ({ ...current, [stepId]: value }));
  }

  function handleSelectedInteractionOptionChange(
    stepId: string,
    value: string,
  ): void {
    setSelectedInteractionOptions((current) => ({
      ...current,
      [stepId]: value,
    }));
  }

  async function submitStepFeedback(
    step: PortalStep,
    approved?: boolean,
  ): Promise<void> {
    const interaction = step.interaction;
    if (!interaction || !beginPortalAction(step.id)) return;

    if (!latestPortalRun || !step.runId) {
      finishPortalAction(step.id, "succeeded");
      setPortalActionStatusText(
        "Local demo feedback captured - no API run is connected",
      );
      return;
    }

    const responseText = feedbackDrafts[step.id]?.trim();
    const selectedOptionId = selectedInteractionOptions[step.id];
    setPortalActionStatusText(`Submitting feedback for ${step.label}`);

    try {
      const response = await fetch(
        `/api/module-runs/${encodeURIComponent(step.runId)}/feedback`,
        {
          method: "POST",
          headers: portalRuntimeHeaders(authorizedPortalToken, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            responseText: responseText || undefined,
            selectedOptionId,
            approved,
            artifactIds: [],
            resumeHandle: interaction.resumeHandle ?? undefined,
            metadata: {
              source: "agent-portal",
              interactionKind: interaction.kind,
            },
          }),
        },
      );

      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          finishPortalAction(step.id, "failed");
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        throw new Error(`Feedback API returned ${response.status}`);
      }
      const data = (await response.json()) as unknown;
      if (!isPortalToolInteractionApiResponse(data)) {
        throw new Error("Feedback API returned unexpected shape");
      }

      updatePortalRunFromModuleRun(data.run);
      finishPortalAction(step.id, "succeeded");
      setPortalActionStatusText(
        `Feedback saved for ${step.label}; resume is ready when available`,
      );
    } catch {
      finishPortalAction(step.id, "failed");
      setPortalActionStatusText(`Feedback API failed for ${step.label}`);
    }
  }

  async function resumeStepRun(step: PortalStep): Promise<void> {
    if (
      !step.interaction ||
      step.interaction.status !== "resumable" ||
      !beginPortalAction(step.id)
    ) {
      return;
    }

    if (!latestPortalRun || !step.runId) {
      finishPortalAction(step.id, "succeeded");
      setPortalActionStatusText(
        "Local demo resume requested - no API run is connected",
      );
      return;
    }

    setPortalActionStatusText(`Resuming ${step.label}`);

    try {
      const response = await fetch(
        `/api/module-runs/${encodeURIComponent(step.runId)}/resume`,
        {
          method: "POST",
          headers: portalRuntimeHeaders(authorizedPortalToken),
        },
      );
      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          finishPortalAction(step.id, "failed");
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        throw new Error(`Resume API returned ${response.status}`);
      }
      const data = (await response.json()) as unknown;
      if (!isPortalToolInteractionApiResponse(data)) {
        throw new Error("Resume API returned unexpected shape");
      }

      updatePortalRunFromModuleRun(data.run);
      finishPortalAction(step.id, "succeeded");
      setPortalActionStatusText(`Resume submitted for ${step.label}`);
    } catch {
      finishPortalAction(step.id, "failed");
      setPortalActionStatusText(`Resume API failed for ${step.label}`);
    }
  }

  async function openDataRecord(record: PortalDataRecord): Promise<void> {
    setSelectedDataRecordId(record.id);

    if (!record.runId) {
      setPortalDetailStatusText(
        "Local demo record - no API module run is connected",
      );
      return;
    }

    const runId = record.runId;
    if (portalRunDetails[runId]) {
      setPortalDetailStates((current) => ({ ...current, [runId]: "ready" }));
      setPortalDetailStatusText(`Loaded details for ${record.title}`);
      return;
    }

    setPortalDetailStates((current) => ({ ...current, [runId]: "loading" }));
    setPortalDetailStatusText(`Loading details for ${record.title}`);
    const requestGeneration = portalDetailCacheGenerationRef.current;

    try {
      const response = await fetch(
        `/api/module-runs/${encodeURIComponent(runId)}`,
        {
          headers: portalRuntimeHeaders(authorizedPortalToken),
        },
      );
      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          setPortalDetailStates((current) => ({
            ...current,
            [runId]: "failed",
          }));
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        if (requestGeneration !== portalDetailCacheGenerationRef.current) {
          return;
        }
        throw new Error(`Module run detail API returned ${response.status}`);
      }
      const data = (await response.json()) as unknown;
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      if (!isPortalModuleRunDetail(data)) {
        throw new Error("Module run detail API returned unexpected shape");
      }

      setPortalRunDetails((current) => ({ ...current, [runId]: data }));
      setPortalDetailStates((current) => ({
        ...current,
        [runId]:
          data.artifacts.length > 0 || data.events.length > 0
            ? "ready"
            : "empty",
      }));
      setPortalDetailStatusText(`Loaded details for ${record.title}`);
    } catch {
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      setPortalDetailStates((current) => ({ ...current, [runId]: "failed" }));
      setPortalDetailStatusText(`Detail API failed for ${record.title}`);
    }
  }

  async function openSource(source: PortalSource): Promise<void> {
    setSelectedSourceId(source.id);

    if (!source.runId) {
      setPortalSourceStatusText(
        "Local demo source - no API module run is connected",
      );
      return;
    }

    const runId = source.runId;
    if (portalRunDetails[runId]) {
      setPortalDetailStates((current) => ({ ...current, [runId]: "ready" }));
      setPortalSourceStatusText(`Loaded evidence for ${source.label}`);
      return;
    }

    setPortalDetailStates((current) => ({ ...current, [runId]: "loading" }));
    setPortalSourceStatusText(`Loading evidence for ${source.label}`);
    const requestGeneration = portalDetailCacheGenerationRef.current;

    try {
      const response = await fetch(
        `/api/module-runs/${encodeURIComponent(runId)}`,
        {
          headers: portalRuntimeHeaders(authorizedPortalToken),
        },
      );
      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          setPortalDetailStates((current) => ({
            ...current,
            [runId]: "failed",
          }));
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        if (requestGeneration !== portalDetailCacheGenerationRef.current) {
          return;
        }
        throw new Error(`Module run detail API returned ${response.status}`);
      }
      const data = (await response.json()) as unknown;
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      if (!isPortalModuleRunDetail(data)) {
        throw new Error("Module run detail API returned unexpected shape");
      }

      setPortalRunDetails((current) => ({ ...current, [runId]: data }));
      setPortalDetailStates((current) => ({
        ...current,
        [runId]:
          data.artifacts.length > 0 || data.events.length > 0
            ? "ready"
            : "empty",
      }));
      setPortalSourceStatusText(`Loaded evidence for ${source.label}`);
    } catch {
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      setPortalDetailStates((current) => ({ ...current, [runId]: "failed" }));
      setPortalSourceStatusText(`Evidence API failed for ${source.label}`);
    }
  }

  async function openResultItem(item: PortalResultItem): Promise<void> {
    setSelectedResultItemId(item.id);

    if (!item.runId) {
      setPortalResultStatusText(
        "Local demo result - no API module run is connected",
      );
      return;
    }

    const runId = item.runId;
    if (portalRunDetails[runId]) {
      setPortalDetailStates((current) => ({ ...current, [runId]: "ready" }));
      setPortalResultStatusText(`Loaded result details for ${item.title}`);
      return;
    }

    setPortalDetailStates((current) => ({ ...current, [runId]: "loading" }));
    setPortalResultStatusText(`Loading result details for ${item.title}`);
    const requestGeneration = portalDetailCacheGenerationRef.current;

    try {
      const response = await fetch(
        `/api/module-runs/${encodeURIComponent(runId)}`,
        {
          headers: portalRuntimeHeaders(authorizedPortalToken),
        },
      );
      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          setPortalDetailStates((current) => ({
            ...current,
            [runId]: "failed",
          }));
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        if (requestGeneration !== portalDetailCacheGenerationRef.current) {
          return;
        }
        throw new Error(`Module run detail API returned ${response.status}`);
      }
      const data = (await response.json()) as unknown;
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      if (!isPortalModuleRunDetail(data)) {
        throw new Error("Module run detail API returned unexpected shape");
      }

      setPortalRunDetails((current) => ({ ...current, [runId]: data }));
      setPortalDetailStates((current) => ({
        ...current,
        [runId]:
          data.artifacts.length > 0 || data.events.length > 0
            ? "ready"
            : "empty",
      }));
      setPortalResultStatusText(`Loaded result details for ${item.title}`);
    } catch {
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      setPortalDetailStates((current) => ({ ...current, [runId]: "failed" }));
      setPortalResultStatusText(`Result detail API failed for ${item.title}`);
    }
  }

  async function openArtifact(
    runId: string,
    artifact: PortalArtifact,
    statusTarget: "data" | "source" | "result" = "data",
  ): Promise<void> {
    setSelectedArtifactByRunId((current) => ({
      ...current,
      [runId]: artifact.id,
    }));
    if (portalArtifactDetails[artifact.id]) return;
    const requestGeneration = portalDetailCacheGenerationRef.current;

    try {
      const response = await fetch(
        `/api/artifacts/${encodeURIComponent(artifact.id)}`,
        {
          headers: portalRuntimeHeaders(authorizedPortalToken),
        },
      );
      if (!response.ok) {
        if (isPortalRuntimeAccessDenied(response)) {
          lockPortalAfterRuntimeAccessDenied();
          return;
        }
        if (requestGeneration !== portalDetailCacheGenerationRef.current) {
          return;
        }
        throw new Error(`Artifact API returned ${response.status}`);
      }
      const data = (await response.json()) as unknown;
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      if (!isPortalArtifact(data))
        throw new Error("Artifact API returned unexpected shape");
      setPortalArtifactDetails((current) => ({
        ...current,
        [artifact.id]: data,
      }));
    } catch {
      if (requestGeneration !== portalDetailCacheGenerationRef.current) {
        return;
      }
      if (statusTarget === "result") {
        setPortalResultStatusText(`Artifact API failed for ${artifact.title}`);
        return;
      }
      if (statusTarget === "source") {
        setPortalSourceStatusText(`Artifact API failed for ${artifact.title}`);
        return;
      }
      setPortalDetailStatusText(`Artifact API failed for ${artifact.title}`);
    }
  }

  if (!isUnlocked) {
    return (
      <div className="portal-lock-screen">
        <style>{styles}</style>
        <form className="portal-token-panel" onSubmit={submitToken}>
          <div className="portal-token-mark">
            <LockKeyhole size={22} />
          </div>
          <span className="portal-kicker">Published workspace</span>
          <h1>Agent Portal</h1>
          <p>Enter your access token to open the published agent workspace.</p>
          <label htmlFor="portal-access-token">Access token</label>
          <div className="portal-token-input">
            <KeyRound size={17} />
            <input
              id="portal-access-token"
              aria-label="Access token"
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="portal-token"
            />
          </div>
          <button
            type="submit"
            disabled={!token.trim() || portalAccessState === "checking"}
          >
            <ShieldCheck size={16} />
            {portalAccessState === "checking" ? "Checking" : "Enter Portal"}
          </button>
          <em>{portalAccessStatusText}</em>
        </form>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <style>{styles}</style>
      <aside className="portal-nav" aria-label="Portal navigation">
        <div className="portal-brand">
          <Bot size={22} />
          <span>AI</span>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "active" : ""}
              onClick={() => setActiveView(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="portal-main">
        <section className="portal-workspace">
          <header className="portal-topbar">
            <div>
              <span className="portal-kicker">End-user Agent Portal</span>
              <h1>Onboarding Knowledge Agent</h1>
            </div>
            <div className="portal-topbar-actions">
              <button
                type="button"
                className="portal-mode-switch"
                onClick={() => setIsAdminGateOpen(true)}
              >
                <Settings2 size={15} />
                Admin Console
              </button>
              <div className="portal-status-pill">
                <ShieldCheck size={15} />
                {portalAccessStateLabel(portalAccessState)}
              </div>
              <div className="portal-run-pill">
                <Clock3 size={15} />
                {portalAccessVersionLabel}
              </div>
              <div className={`portal-run-pill ${portalRunState}`}>
                <Radio size={15} />
                {portalRunStateLabel(portalRunState)}
              </div>
              {latestPortalRun && portalRunSyncSnapshot && (
                <div className="portal-run-pill">
                  <Clock3 size={15} />
                  {`${portalRunSyncSourceLabel(
                    portalRunSyncSnapshot.source,
                  )} ${formatApiTime(portalRunSyncSnapshot.checkedAt)}`}
                </div>
              )}
              <button
                type="button"
                className={`portal-refresh-button${
                  isPortalAutoRefreshActive ? " active" : ""
                }${isPortalAutoRefreshPaused ? " paused" : ""}`}
                disabled={!isPortalAutoRefreshAvailable}
                aria-pressed={isPortalAutoRefreshEnabled}
                title={portalAutoRefreshButtonLabel}
                onClick={() =>
                  setIsPortalAutoRefreshEnabled((current) => !current)
                }
              >
                <RefreshCw size={15} />
                {portalAutoRefreshButtonLabel}
              </button>
              <button
                type="button"
                className="portal-refresh-button"
                disabled={
                  !latestPortalRun ||
                  portalRunState === "submitting" ||
                  portalRunState === "refreshing"
                }
                onClick={() => void refreshPortalRun()}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </header>

          {activeView === "chat" && (
            <ChatView
              draft={draft}
              messages={displayedMessages}
              runState={portalRunState}
              runStatusText={portalRunStatusText}
              onDraftChange={setDraft}
              onOpenView={setActiveView}
              onSubmit={submitPortalPrompt}
            />
          )}
          {activeView === "steps" && (
            <StepsView
              activeStep={activeStep}
              steps={displayedSteps}
              latestPortalRun={latestPortalRun}
              runState={portalRunState}
              runStatusText={portalRunStatusText}
              portalActionStates={portalActionStates}
              feedbackDrafts={feedbackDrafts}
              selectedInteractionOptions={selectedInteractionOptions}
              portalActionStatusText={portalActionStatusText}
              onSelectStep={setActiveStep}
              onFeedbackDraftChange={handleFeedbackDraftChange}
              onSelectedInteractionOptionChange={
                handleSelectedInteractionOptionChange
              }
              onSubmitStepFeedback={submitStepFeedback}
              onResumeStepRun={resumeStepRun}
            />
          )}
          {activeView === "data" && (
            <DataView
              activeStep={activeStep}
              records={
                filteredData.length > 0 ? filteredData : displayedDataRecords
              }
              steps={displayedSteps}
              selectedRecordId={selectedDataRecordId}
              detailStates={portalDetailStates}
              runDetails={portalRunDetails}
              selectedArtifactByRunId={selectedArtifactByRunId}
              artifactDetails={portalArtifactDetails}
              detailStatusText={portalDetailStatusText}
              onSelectStep={setActiveStep}
              onOpenRecord={openDataRecord}
              onOpenArtifact={openArtifact}
            />
          )}
          {activeView === "sources" && (
            <SourcesView
              sources={displayedSources}
              selectedSourceId={selectedSourceId}
              detailStates={portalDetailStates}
              runDetails={portalRunDetails}
              selectedArtifactByRunId={selectedArtifactByRunId}
              artifactDetails={portalArtifactDetails}
              sourceStatusText={portalSourceStatusText}
              onOpenSource={openSource}
              onOpenArtifact={(runId, artifact) =>
                openArtifact(runId, artifact, "source")
              }
            />
          )}
          {activeView === "result" && (
            <ResultView
              readiness={displayedReadiness}
              latestPortalRun={latestPortalRun}
              runStatusText={portalRunStatusText}
              resultItems={displayedResultItems}
              selectedResultItemId={selectedResultItemId}
              detailStates={portalDetailStates}
              runDetails={portalRunDetails}
              selectedArtifactByRunId={selectedArtifactByRunId}
              artifactDetails={portalArtifactDetails}
              resultStatusText={portalResultStatusText}
              onOpenResultItem={openResultItem}
              onOpenArtifact={(runId, artifact) =>
                openArtifact(runId, artifact, "result")
              }
            />
          )}
        </section>

        <aside className="portal-context" aria-label="Current run context">
          <div className="portal-context-block">
            <span className="portal-kicker">Current step</span>
            <h2>{activeStepRecord.label}</h2>
            <p>{activeStepRecord.summary}</p>
            <div className={`portal-status-badge ${activeStepRecord.status}`}>
              {statusIcon(activeStepRecord.status)}
              {statusText(activeStepRecord.status)}
            </div>
            <PortalInteractionPanel
              step={activeStepRecord}
              panelId="context"
              actionState={portalActionStates[activeStepRecord.id] ?? "idle"}
              draft={feedbackDrafts[activeStepRecord.id] ?? ""}
              selectedOptionId={selectedInteractionOptions[activeStepRecord.id]}
              onDraftChange={(value) =>
                handleFeedbackDraftChange(activeStepRecord.id, value)
              }
              onSelectedOptionChange={(value) =>
                handleSelectedInteractionOptionChange(
                  activeStepRecord.id,
                  value,
                )
              }
              onSubmitFeedback={(approved) =>
                void submitStepFeedback(activeStepRecord, approved)
              }
              onResume={() => void resumeStepRun(activeStepRecord)}
            />
          </div>
          <div className="portal-context-block">
            <span className="portal-kicker">Pipeline</span>
            <div className="portal-mini-steps">
              {displayedSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className={step.id === activeStep ? "active" : ""}
                  onClick={() => {
                    setActiveStep(step.id);
                    setActiveView("steps");
                  }}
                >
                  <span className="portal-step-dot" aria-hidden="true" />
                  <span className="portal-step-label">{step.label}</span>
                  <em>{statusText(step.status)}</em>
                </button>
              ))}
            </div>
          </div>
          <div className="portal-context-block">
            <span className="portal-kicker">Visible data</span>
            <strong>{displayedDataRecords.length} records</strong>
            <p>{portalRunStatusText}</p>
          </div>
        </aside>
      </main>

      {isAdminGateOpen && (
        <div
          className="portal-admin-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-admin-title"
        >
          <form className="portal-admin-panel" onSubmit={submitAdminToken}>
            <div className="portal-token-mark">
              <Settings2 size={22} />
            </div>
            <span className="portal-kicker">Admin access</span>
            <h2 id="portal-admin-title">Enter admin token</h2>
            <p>
              Admin Console is for operators. Submit an admin token to continue,
              or return to the Portal.
            </p>
            <label htmlFor="portal-admin-token">Admin token</label>
            <div className="portal-token-input">
              <KeyRound size={17} />
              <input
                id="portal-admin-token"
                aria-label="Admin token"
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="admin-token"
              />
            </div>
            <div className="portal-admin-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setIsAdminGateOpen(false)}
              >
                Back to Portal
              </button>
              <button type="submit">
                <ShieldCheck size={16} />
                Enter Admin
              </button>
            </div>
            <em>
              Demo preview only. No token keeps you in the frontstage Portal.
            </em>
          </form>
        </div>
      )}
    </div>
  );
}

function ChatView({
  draft,
  messages,
  runState,
  runStatusText,
  onDraftChange,
  onOpenView,
  onSubmit,
}: {
  draft: string;
  messages: PortalMessage[];
  runState: PortalRunSubmitState;
  runStatusText: string;
  onDraftChange: (value: string) => void;
  onOpenView: (view: PortalView) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="portal-view portal-chat-view" aria-label="Agent chat">
      <div className="portal-message-list">
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.speaker === "user"
                ? "portal-message user"
                : "portal-message agent"
            }
          >
            <span>{message.meta}</span>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      <div className="portal-chat-actions">
        <button type="button" onClick={() => onOpenView("steps")}>
          <ListChecks size={16} />
          View Steps
        </button>
        <button type="button" onClick={() => onOpenView("data")}>
          <Database size={16} />
          Inspect Data
        </button>
        <button type="button" onClick={() => onOpenView("sources")}>
          <FileSearch size={16} />
          Check Sources
        </button>
      </div>
      <div className="portal-composer">
        <textarea
          aria-label="Portal chat prompt"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Ask this published agent..."
          rows={3}
        />
        <button
          type="button"
          disabled={
            !draft.trim() ||
            runState === "submitting" ||
            runState === "refreshing"
          }
          onClick={onSubmit}
        >
          <Send size={16} />
          Send
        </button>
        <div className="portal-composer-status">
          <span>{portalRunStateLabel(runState)}</span>
          <em>{runStatusText}</em>
        </div>
      </div>
    </section>
  );
}

function StepsView({
  activeStep,
  steps,
  latestPortalRun,
  runState,
  runStatusText,
  portalActionStates,
  feedbackDrafts,
  selectedInteractionOptions,
  portalActionStatusText,
  onSelectStep,
  onFeedbackDraftChange,
  onSelectedInteractionOptionChange,
  onSubmitStepFeedback,
  onResumeStepRun,
}: {
  activeStep: string;
  steps: PortalStep[];
  latestPortalRun: PortalRunUiState | null;
  runState: PortalRunSubmitState;
  runStatusText: string;
  portalActionStates: Record<string, PortalActionState>;
  feedbackDrafts: Record<string, string>;
  selectedInteractionOptions: Record<string, string>;
  portalActionStatusText: string;
  onSelectStep: (step: string) => void;
  onFeedbackDraftChange: (stepId: string, value: string) => void;
  onSelectedInteractionOptionChange: (stepId: string, value: string) => void;
  onSubmitStepFeedback: (step: PortalStep, approved?: boolean) => Promise<void>;
  onResumeStepRun: (step: PortalStep) => Promise<void>;
}) {
  return (
    <section className="portal-view" aria-label="Pipeline steps">
      <div className="portal-section-heading">
        <span className="portal-kicker">Transparent run</span>
        <h2>Steps</h2>
      </div>
      <div className="portal-api-plan-panel">
        {latestPortalRun ? (
          <>
            <strong>
              Pipeline {shortRunId(latestPortalRun.response.pipelineRun.id)}
            </strong>
            <p>{latestPortalRun.response.plan.summary}</p>
            {latestPortalRun.response.plan.warnings.length > 0 && (
              <div
                className="portal-warning-row"
                aria-label="Agent plan warnings"
              >
                {latestPortalRun.response.plan.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <strong>{portalRunStateLabel(runState)}</strong>
            <p>{runStatusText}</p>
          </>
        )}
        <p className="portal-action-status-text">{portalActionStatusText}</p>
      </div>
      <div className="portal-step-grid">
        {steps.map((step) => (
          <article
            key={step.id}
            className={
              step.id === activeStep
                ? "portal-step-card active"
                : "portal-step-card"
            }
          >
            <button
              type="button"
              className="portal-step-card-select"
              onClick={() => onSelectStep(step.id)}
            >
              <span className={`portal-status-badge ${step.status}`}>
                {statusIcon(step.status)}
                {statusText(step.status)}
              </span>
              <strong>{step.label}</strong>
              <p>{step.summary}</p>
              <em>{step.adminModule}</em>
              <b>{step.dataCount}</b>
            </button>
            <PortalInteractionPanel
              step={step}
              panelId="steps"
              actionState={portalActionStates[step.id] ?? "idle"}
              draft={feedbackDrafts[step.id] ?? ""}
              selectedOptionId={selectedInteractionOptions[step.id]}
              onDraftChange={(value) => onFeedbackDraftChange(step.id, value)}
              onSelectedOptionChange={(value) =>
                onSelectedInteractionOptionChange(step.id, value)
              }
              onSubmitFeedback={(approved) =>
                void onSubmitStepFeedback(step, approved)
              }
              onResume={() => void onResumeStepRun(step)}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function PortalInteractionPanel({
  step,
  panelId,
  actionState,
  draft,
  selectedOptionId,
  onDraftChange,
  onSelectedOptionChange,
  onSubmitFeedback,
  onResume,
}: {
  step: PortalStep;
  panelId: string;
  actionState: PortalActionState;
  draft: string;
  selectedOptionId: string | undefined;
  onDraftChange: (value: string) => void;
  onSelectedOptionChange: (value: string) => void;
  onSubmitFeedback: (approved?: boolean) => void;
  onResume: () => void;
}) {
  const interaction = step.interaction;
  if (!interaction) return null;
  const isBusy = actionState === "submitting";
  const canSubmitFeedback = isFeedbackReadyInteraction(interaction);
  const canResume = interaction.status === "resumable";
  const feedbackInputId = `portal-feedback-${panelId}-${step.id}`;

  return (
    <div className="portal-interaction-panel">
      <div className="portal-interaction-heading">
        <span>{interactionStatusText(interaction.status)}</span>
        <strong>{interaction.title}</strong>
      </div>
      <p>{interaction.message}</p>
      {interaction.prompt && <em>{interaction.prompt}</em>}
      {interaction.options.length > 0 && (
        <div className="portal-option-row" aria-label={`${step.label} options`}>
          {interaction.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={selectedOptionId === option.id ? "active" : ""}
              aria-pressed={selectedOptionId === option.id}
              onClick={(event) => {
                event.stopPropagation();
                onSelectedOptionChange(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {canSubmitFeedback && (
        <label className="portal-feedback-field" htmlFor={feedbackInputId}>
          <span>Reply for {step.label}</span>
          <textarea
            id={feedbackInputId}
            value={draft}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Reply for this step..."
            rows={2}
          />
        </label>
      )}
      <div className="portal-interaction-actions">
        {interaction.kind === "approval" && canSubmitFeedback && (
          <button
            type="button"
            disabled={isBusy}
            onClick={(event) => {
              event.stopPropagation();
              onSubmitFeedback(true);
            }}
          >
            Approve
          </button>
        )}
        {canSubmitFeedback && (
          <button
            type="button"
            disabled={isBusy}
            onClick={(event) => {
              event.stopPropagation();
              onSubmitFeedback(false);
            }}
          >
            Send feedback
          </button>
        )}
        {canResume && (
          <button
            type="button"
            disabled={isBusy}
            onClick={(event) => {
              event.stopPropagation();
              onResume();
            }}
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}

function DataView({
  activeStep,
  records,
  steps,
  selectedRecordId,
  detailStates,
  runDetails,
  selectedArtifactByRunId,
  artifactDetails,
  detailStatusText,
  onSelectStep,
  onOpenRecord,
  onOpenArtifact,
}: {
  activeStep: string;
  records: PortalDataRecord[];
  steps: PortalStep[];
  selectedRecordId: string | null;
  detailStates: Record<string, PortalDetailState>;
  runDetails: Record<string, PortalModuleRunDetail>;
  selectedArtifactByRunId: Record<string, string>;
  artifactDetails: Record<string, PortalArtifact>;
  detailStatusText: string;
  onSelectStep: (step: string) => void;
  onOpenRecord: (record: PortalDataRecord) => Promise<void>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  const selectedRecord =
    records.find((record) => record.id === selectedRecordId) ?? null;
  const selectedRunId = selectedRecord?.runId;
  const selectedRunDetail = selectedRunId
    ? (runDetails[selectedRunId] ?? null)
    : null;

  return (
    <section className="portal-view" aria-label="Portal data">
      <div className="portal-section-heading">
        <span className="portal-kicker">Database records</span>
        <h2>Data</h2>
      </div>
      <div className="portal-filter-row" aria-label="Data filters">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={step.id === activeStep ? "active" : ""}
            onClick={() => onSelectStep(step.id)}
          >
            {step.label}
          </button>
        ))}
      </div>
      <div className="portal-record-list">
        {records.map((record) => (
          <article
            key={record.id}
            className={
              selectedRecordId === record.id
                ? "portal-record-row active"
                : "portal-record-row"
            }
          >
            <div>
              <span>{record.kind}</span>
              <button
                type="button"
                aria-label={`View details for ${record.title}`}
                onClick={() => void onOpenRecord(record)}
              >
                View details
              </button>
            </div>
            <strong>{record.title}</strong>
            <p>{record.detail}</p>
            <em>
              {record.step} · {record.updatedAt}
            </em>
          </article>
        ))}
      </div>
      <p className="portal-action-status-text">{detailStatusText}</p>
      <PortalDataDetailDrawer
        record={selectedRecord}
        detail={selectedRunDetail}
        detailState={
          selectedRunId ? (detailStates[selectedRunId] ?? "idle") : "idle"
        }
        selectedArtifactId={
          selectedRunId ? selectedArtifactByRunId[selectedRunId] : undefined
        }
        artifactDetails={artifactDetails}
        onOpenArtifact={onOpenArtifact}
      />
    </section>
  );
}

function PortalDataDetailDrawer({
  record,
  detail,
  detailState,
  selectedArtifactId,
  artifactDetails,
  onOpenArtifact,
}: {
  record: PortalDataRecord | null;
  detail: PortalModuleRunDetail | null;
  detailState: PortalDetailState;
  selectedArtifactId: string | undefined;
  artifactDetails: Record<string, PortalArtifact>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  if (!record) {
    return (
      <aside className="portal-detail-drawer">
        <p>Select a record to inspect stored data.</p>
      </aside>
    );
  }

  if (!record.runId) {
    return (
      <aside className="portal-detail-drawer">
        <span className="portal-kicker">Local demo</span>
        <strong>{record.title}</strong>
        <p>{record.detail}</p>
        <em>
          {record.step} · {record.updatedAt}
        </em>
      </aside>
    );
  }

  const runId = record.runId;

  if (detailState === "loading") {
    return (
      <aside className="portal-detail-drawer">
        <p>Loading record details...</p>
      </aside>
    );
  }

  if (detailState === "failed") {
    return (
      <aside className="portal-detail-drawer">
        <p>Detail API failed for this record.</p>
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="portal-detail-drawer">
        <p>Open this record to load module details.</p>
      </aside>
    );
  }

  const selectedArtifact = selectedArtifactId
    ? (artifactDetails[selectedArtifactId] ??
      detail.artifacts.find((artifact) => artifact.id === selectedArtifactId))
    : null;
  const artifactPreview =
    selectedArtifact?.contentText ??
    (selectedArtifact
      ? JSON.stringify(
          selectedArtifact.contentJson ?? selectedArtifact.provenance ?? {},
          null,
          2,
        )
      : null);

  return (
    <aside className="portal-detail-drawer">
      <span className="portal-kicker">Module run detail</span>
      <strong>{detail.run.title ?? record.title}</strong>
      <p>{detail.run.summary ?? record.detail}</p>
      <div className="portal-detail-columns">
        <div>
          <em>Events</em>
          {detail.events.length === 0 ? (
            <p>No events stored yet.</p>
          ) : (
            detail.events.map((event) => (
              <span key={event.id}>
                {event.severity}: {event.title ?? event.eventType}
              </span>
            ))
          )}
        </div>
        <div>
          <em>Artifacts</em>
          {detail.artifacts.length === 0 ? (
            <p>No artifacts stored yet.</p>
          ) : (
            detail.artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={selectedArtifactId === artifact.id ? "active" : ""}
                onClick={() => void onOpenArtifact(runId, artifact)}
              >
                {artifact.title}
              </button>
            ))
          )}
        </div>
      </div>
      {detailState === "empty" && (
        <p>No detail records were stored for this module run yet.</p>
      )}
      {artifactPreview && (
        <pre className="portal-artifact-preview">{artifactPreview}</pre>
      )}
    </aside>
  );
}

function SourcesView({
  sources,
  selectedSourceId,
  detailStates,
  runDetails,
  selectedArtifactByRunId,
  artifactDetails,
  sourceStatusText,
  onOpenSource,
  onOpenArtifact,
}: {
  sources: PortalSource[];
  selectedSourceId: string | null;
  detailStates: Record<string, PortalDetailState>;
  runDetails: Record<string, PortalModuleRunDetail>;
  selectedArtifactByRunId: Record<string, string>;
  artifactDetails: Record<string, PortalArtifact>;
  sourceStatusText: string;
  onOpenSource: (source: PortalSource) => Promise<void>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedRunId = selectedSource?.runId;
  const selectedRunDetail = selectedRunId
    ? (runDetails[selectedRunId] ?? null)
    : null;

  return (
    <section className="portal-view" aria-label="Portal sources">
      <div className="portal-section-heading">
        <span className="portal-kicker">Evidence</span>
        <h2>Sources</h2>
      </div>
      <div className="portal-source-grid">
        {sources.map((source) => (
          <article
            key={source.id}
            className={
              selectedSourceId === source.id
                ? "portal-source-card active"
                : "portal-source-card"
            }
          >
            <div>
              <Link2 size={16} />
              <span>{source.type}</span>
            </div>
            <strong>{source.label}</strong>
            <p>{source.summary}</p>
            <em>
              {source.step} · {source.freshness}
            </em>
            <button
              type="button"
              aria-label={`Inspect evidence for ${source.label}`}
              onClick={() => void onOpenSource(source)}
            >
              Inspect evidence
            </button>
          </article>
        ))}
      </div>
      <p className="portal-action-status-text">{sourceStatusText}</p>
      <PortalSourceEvidenceDrawer
        source={selectedSource}
        detail={selectedRunDetail}
        detailState={
          selectedRunId ? (detailStates[selectedRunId] ?? "idle") : "idle"
        }
        selectedArtifactId={
          selectedRunId ? selectedArtifactByRunId[selectedRunId] : undefined
        }
        artifactDetails={artifactDetails}
        onOpenArtifact={onOpenArtifact}
      />
    </section>
  );
}

function PortalSourceEvidenceDrawer({
  source,
  detail,
  detailState,
  selectedArtifactId,
  artifactDetails,
  onOpenArtifact,
}: {
  source: PortalSource | null;
  detail: PortalModuleRunDetail | null;
  detailState: PortalDetailState;
  selectedArtifactId: string | undefined;
  artifactDetails: Record<string, PortalArtifact>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  if (!source) {
    return (
      <aside className="portal-source-drawer">
        <p>Select a source to inspect evidence.</p>
      </aside>
    );
  }

  if (!source.runId) {
    return (
      <aside className="portal-source-drawer">
        <span className="portal-kicker">Local evidence</span>
        <strong>{source.evidenceTitle}</strong>
        <p>{source.evidenceDetail}</p>
        <em>
          {source.step} · {source.freshness}
        </em>
      </aside>
    );
  }

  const runId = source.runId;

  if (detailState === "loading") {
    return (
      <aside className="portal-source-drawer">
        <p>Loading source evidence...</p>
      </aside>
    );
  }

  if (detailState === "failed") {
    return (
      <aside className="portal-source-drawer">
        <p>Evidence API failed for this source.</p>
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="portal-source-drawer">
        <p>Open this source to load evidence.</p>
      </aside>
    );
  }

  const selectedArtifact = selectedArtifactId
    ? (artifactDetails[selectedArtifactId] ??
      detail.artifacts.find((artifact) => artifact.id === selectedArtifactId))
    : null;
  const artifactPreview =
    selectedArtifact?.contentText ??
    (selectedArtifact
      ? JSON.stringify(
          selectedArtifact.contentJson ?? selectedArtifact.provenance ?? {},
          null,
          2,
        )
      : null);

  return (
    <aside className="portal-source-drawer">
      <span className="portal-kicker">API evidence</span>
      <strong>{source.evidenceTitle}</strong>
      <p>{detail.run.summary ?? source.evidenceDetail}</p>
      <div className="portal-source-evidence-grid">
        <div>
          <em>Provenance events</em>
          {detail.events.length === 0 ? (
            <p>No events stored yet.</p>
          ) : (
            detail.events.map((event) => (
              <span key={event.id}>
                {event.severity}: {event.title ?? event.eventType}
              </span>
            ))
          )}
        </div>
        <div>
          <em>Evidence artifacts</em>
          {detail.artifacts.length === 0 ? (
            <p>No artifacts stored yet.</p>
          ) : (
            detail.artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={selectedArtifactId === artifact.id ? "active" : ""}
                onClick={() => void onOpenArtifact(runId, artifact)}
              >
                {artifact.title}
              </button>
            ))
          )}
        </div>
      </div>
      {detailState === "empty" && (
        <p>No evidence records were stored for this module run yet.</p>
      )}
      {artifactPreview && (
        <pre className="portal-artifact-preview">{artifactPreview}</pre>
      )}
    </aside>
  );
}

function ResultView({
  readiness,
  latestPortalRun,
  runStatusText,
  resultItems,
  selectedResultItemId,
  detailStates,
  runDetails,
  selectedArtifactByRunId,
  artifactDetails,
  resultStatusText,
  onOpenResultItem,
  onOpenArtifact,
}: {
  readiness: ReadonlyArray<readonly [string, string]>;
  latestPortalRun: PortalRunUiState | null;
  runStatusText: string;
  resultItems: PortalResultItem[];
  selectedResultItemId: string | null;
  detailStates: Record<string, PortalDetailState>;
  runDetails: Record<string, PortalModuleRunDetail>;
  selectedArtifactByRunId: Record<string, string>;
  artifactDetails: Record<string, PortalArtifact>;
  resultStatusText: string;
  onOpenResultItem: (item: PortalResultItem) => Promise<void>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  const selectedResultItem =
    resultItems.find((item) => item.id === selectedResultItemId) ?? null;
  const selectedRunId = selectedResultItem?.runId;
  const selectedRunDetail = selectedRunId
    ? (runDetails[selectedRunId] ?? null)
    : null;

  return (
    <section className="portal-view" aria-label="Portal result">
      <div className="portal-section-heading">
        <span className="portal-kicker">Final output</span>
        <h2>Result</h2>
      </div>
      <div className="portal-result-panel">
        <div className="portal-result-summary">
          <FileText size={22} />
          <span>
            {latestPortalRun
              ? `API run ${shortRunId(latestPortalRun.response.pipelineRun.id)}`
              : "Draft agent output"}
          </span>
          <h3>
            {latestPortalRun?.response.pipelineRun.title ??
              "Onboarding Knowledge Agent"}
          </h3>
          <p>
            {latestPortalRun?.response.agentMessage.content ?? runStatusText}
          </p>
        </div>
        <div className="portal-readiness-grid">
          {readiness.map(([label, value]) => (
            <span key={label}>
              <strong>{label}</strong>
              <em>{value}</em>
            </span>
          ))}
        </div>
      </div>
      <div className="portal-result-handoff-grid">
        {resultItems.map((item) => (
          <article
            key={item.id}
            className={
              selectedResultItemId === item.id
                ? "portal-result-card active"
                : "portal-result-card"
            }
          >
            <span>{item.kind.replace("_", " ")}</span>
            <strong>{item.title}</strong>
            <p>{item.summary}</p>
            <em>{item.status}</em>
            <button
              type="button"
              aria-label={`Inspect result handoff for ${item.title}`}
              onClick={() => void onOpenResultItem(item)}
            >
              Inspect result
            </button>
          </article>
        ))}
      </div>
      <p className="portal-action-status-text">{resultStatusText}</p>
      <PortalResultDetailDrawer
        item={selectedResultItem}
        detail={selectedRunDetail}
        detailState={
          selectedRunId ? (detailStates[selectedRunId] ?? "idle") : "idle"
        }
        selectedArtifactId={
          selectedRunId ? selectedArtifactByRunId[selectedRunId] : undefined
        }
        artifactDetails={artifactDetails}
        onOpenArtifact={onOpenArtifact}
      />
    </section>
  );
}

function PortalResultDetailDrawer({
  item,
  detail,
  detailState,
  selectedArtifactId,
  artifactDetails,
  onOpenArtifact,
}: {
  item: PortalResultItem | null;
  detail: PortalModuleRunDetail | null;
  detailState: PortalDetailState;
  selectedArtifactId: string | undefined;
  artifactDetails: Record<string, PortalArtifact>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  if (!item) {
    return (
      <aside className="portal-result-drawer">
        <p>Select a result item to inspect handoff details.</p>
      </aside>
    );
  }

  if (!item.runId) {
    return (
      <aside className="portal-result-drawer">
        <span className="portal-kicker">Local handoff</span>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
        <em>{item.status}</em>
      </aside>
    );
  }

  const runId = item.runId;

  if (detailState === "loading") {
    return (
      <aside className="portal-result-drawer">
        <p>Loading result details...</p>
      </aside>
    );
  }

  if (detailState === "failed") {
    return (
      <aside className="portal-result-drawer">
        <p>Result detail API failed for this item.</p>
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="portal-result-drawer">
        <p>Open this result item to load handoff artifacts.</p>
      </aside>
    );
  }

  const selectedArtifact = selectedArtifactId
    ? (artifactDetails[selectedArtifactId] ??
      detail.artifacts.find((artifact) => artifact.id === selectedArtifactId))
    : null;
  const artifactPreview =
    selectedArtifact?.contentText ??
    (selectedArtifact
      ? JSON.stringify(
          selectedArtifact.contentJson ?? selectedArtifact.provenance ?? {},
          null,
          2,
        )
      : item.detail);

  return (
    <aside className="portal-result-drawer">
      <span className="portal-kicker">API handoff</span>
      <strong>{detail.run.title ?? item.title}</strong>
      <p>{detail.run.summary ?? item.summary}</p>
      <div className="portal-result-detail-grid">
        <div>
          <em>Handoff events</em>
          {detail.events.length === 0 ? (
            <p>No events stored yet.</p>
          ) : (
            detail.events.map((event) => (
              <span key={event.id}>
                {event.severity}: {event.title ?? event.eventType}
              </span>
            ))
          )}
        </div>
        <div>
          <em>Result artifacts</em>
          {detail.artifacts.length === 0 ? (
            <p>No artifacts stored yet.</p>
          ) : (
            detail.artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={selectedArtifactId === artifact.id ? "active" : ""}
                onClick={() => void onOpenArtifact(runId, artifact)}
              >
                {artifact.title}
              </button>
            ))
          )}
        </div>
      </div>
      {detailState === "empty" && (
        <p>No handoff records were stored for this module run yet.</p>
      )}
      {artifactPreview && (
        <pre className="portal-artifact-preview">{artifactPreview}</pre>
      )}
    </aside>
  );
}

const styles = `
  :root {
    color-scheme: dark;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
  }

  .portal-lock-screen,
  .portal-shell {
    min-height: 100vh;
    background: #090d13;
    color: #edf3fb;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
  }

  .portal-lock-screen {
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .portal-token-panel {
    width: min(440px, 100%);
    border: 1px solid #243244;
    border-radius: 8px;
    background: #101721;
    display: grid;
    gap: 14px;
    padding: 24px;
    box-shadow: 0 20px 60px #00000055;
  }

  .portal-admin-gate {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: #05080dcc;
    display: grid;
    place-items: center;
    padding: 18px;
  }

  .portal-admin-panel {
    width: min(460px, 100%);
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #101721;
    display: grid;
    gap: 13px;
    padding: 22px;
    box-shadow: 0 24px 70px #00000077;
  }

  .portal-token-mark {
    width: 42px;
    height: 42px;
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #10233a;
    color: #67b7ff;
    display: grid;
    place-items: center;
  }

  .portal-kicker {
    color: #8d9bad;
    font-size: 11px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .portal-token-panel h1,
  .portal-admin-panel h2,
  .portal-topbar h1,
  .portal-section-heading h2,
  .portal-context h2,
  .portal-result-summary h3 {
    margin: 0;
    letter-spacing: 0;
  }

  .portal-token-panel h1 {
    font-size: 30px;
  }

  .portal-admin-panel h2 {
    font-size: 24px;
  }

  .portal-token-panel p,
  .portal-token-panel em,
  .portal-admin-panel p,
  .portal-admin-panel em,
  .portal-context p,
  .portal-message p,
  .portal-step-card p,
  .portal-interaction-panel p,
  .portal-record-row p,
  .portal-detail-drawer p,
  .portal-source-card p,
  .portal-source-drawer p,
  .portal-result-summary p,
  .portal-result-card p,
  .portal-result-drawer p {
    color: #a5b1c2;
    line-height: 1.55;
    font-size: 13px;
    font-style: normal;
    margin: 0;
  }

  .portal-token-panel label {
    color: #8d9bad;
    font-size: 12px;
    font-weight: 800;
  }

  .portal-admin-panel label {
    color: #8d9bad;
    font-size: 12px;
    font-weight: 800;
  }

  .portal-token-input {
    min-height: 42px;
    border: 1px solid #2a394d;
    border-radius: 8px;
    background: #0b1118;
    display: grid;
    grid-template-columns: 38px 1fr;
    align-items: center;
    color: #8d9bad;
    overflow: hidden;
  }

  .portal-token-input svg {
    justify-self: center;
  }

  .portal-token-input input {
    width: 100%;
    min-width: 0;
    height: 42px;
    border: 0;
    background: transparent;
    color: #edf3fb;
    outline: 0;
    font: inherit;
  }

  .portal-token-panel button,
  .portal-admin-panel button,
  .portal-nav button,
  .portal-chat-actions button,
  .portal-composer button,
  .portal-mini-steps button,
  .portal-step-card-select,
  .portal-interaction-panel button,
  .portal-interaction-panel textarea,
  .portal-filter-row button,
  .portal-record-row button,
  .portal-detail-columns button,
  .portal-source-card button,
  .portal-source-evidence-grid button,
  .portal-result-card button,
  .portal-result-detail-grid button {
    font: inherit;
  }

  .portal-token-panel button {
    min-height: 42px;
    border: 0;
    border-radius: 8px;
    background: #2f7de1;
    color: #ffffff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 850;
  }

  .portal-admin-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .portal-admin-panel button {
    min-height: 40px;
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #2f7de1;
    color: #ffffff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 12px;
    font-weight: 850;
  }

  .portal-admin-panel button.secondary {
    background: #0b1118;
    border-color: #263445;
    color: #aeb8c6;
  }

  .portal-token-panel button:disabled,
  .portal-composer button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .portal-shell {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr);
  }

  .portal-nav {
    border-right: 1px solid #1e2936;
    background: #0b1118;
    padding: 14px 10px;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 24px;
  }

  .portal-brand {
    width: 48px;
    height: 48px;
    border: 1px solid #263445;
    border-radius: 8px;
    display: grid;
    place-items: center;
    color: #67b7ff;
    justify-self: center;
  }

  .portal-brand span {
    font-size: 10px;
    color: #ff8a3d;
    font-weight: 900;
  }

  .portal-nav nav {
    display: grid;
    align-content: start;
    gap: 8px;
  }

  .portal-nav button {
    min-height: 58px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #8d9bad;
    cursor: pointer;
    display: grid;
    place-items: center;
    gap: 5px;
    padding: 8px 4px;
  }

  .portal-nav button span {
    font-size: 11px;
    font-weight: 750;
  }

  .portal-nav button.active {
    background: #122033;
    border-color: #31506f;
    color: #ffffff;
  }

  .portal-main {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) 360px;
  }

  .portal-workspace {
    min-width: 0;
    display: grid;
    grid-template-rows: auto 1fr;
    border-right: 1px solid #1e2936;
  }

  .portal-topbar {
    min-height: 72px;
    border-bottom: 1px solid #1e2936;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 18px;
  }

  .portal-topbar h1 {
    font-size: 20px;
    margin-top: 3px;
  }

  .portal-topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .portal-mode-switch {
    min-height: 30px;
    border: 1px solid #31506f;
    border-radius: 999px;
    background: #10233a;
    color: #d8e8ff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 850;
    white-space: nowrap;
  }

  .portal-refresh-button {
    min-height: 30px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    color: #d8e8ff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 850;
    white-space: nowrap;
  }

  .portal-refresh-button.active {
    border-color: #4f9cff;
    background: #10233a;
    color: #edf3fb;
  }

  .portal-refresh-button.paused {
    border-color: #66552b;
    background: #211c12;
    color: #f2d68a;
  }

  .portal-refresh-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .portal-status-pill,
  .portal-status-badge {
    width: fit-content;
    min-height: 28px;
    border: 1px solid #263445;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    color: #aeb8c6;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .portal-status-pill {
    border-color: #1d6b45;
    background: #0e2419;
    color: #35d07f;
  }

  .portal-status-badge.complete {
    border-color: #1d6b45;
    background: #0e2419;
    color: #35d07f;
  }

  .portal-status-badge.running {
    border-color: #31506f;
    background: #10233a;
    color: #67b7ff;
  }

  .portal-status-badge.waiting {
    border-color: #6d4a1f;
    background: #24180e;
    color: #f59e42;
  }

  .portal-status-badge.blocked {
    border-color: #793339;
    background: #2a1115;
    color: #ff7b86;
  }

  .portal-run-pill {
    width: fit-content;
    min-height: 30px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    color: #aeb8c6;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 850;
    white-space: nowrap;
  }

  .portal-run-pill.saved {
    border-color: #1d6b45;
    background: #0e2419;
    color: #35d07f;
  }

  .portal-run-pill.offline,
  .portal-run-pill.failed {
    border-color: #793339;
    background: #2a1115;
    color: #ff7b86;
  }

  .portal-run-pill.submitting,
  .portal-run-pill.refreshing {
    border-color: #31506f;
    background: #10233a;
    color: #67b7ff;
  }

  .portal-view {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 14px;
    padding: 18px;
  }

  .portal-chat-view {
    grid-template-rows: 1fr auto auto;
    min-height: 0;
  }

  .portal-message-list,
  .portal-record-list,
  .portal-source-grid,
  .portal-step-grid,
  .portal-readiness-grid,
  .portal-mini-steps {
    display: grid;
    gap: 10px;
  }

  .portal-message {
    width: min(760px, 100%);
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    display: grid;
    gap: 7px;
    padding: 13px;
  }

  .portal-message.user {
    justify-self: end;
    background: #122033;
    border-color: #31506f;
  }

  .portal-message span,
  .portal-record-row span,
  .portal-source-card span {
    color: #8d9bad;
    font-size: 11px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .portal-chat-actions,
  .portal-filter-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .portal-chat-actions button,
  .portal-filter-row button {
    min-height: 34px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    color: #aeb8c6;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 11px;
    font-weight: 800;
  }

  .portal-filter-row button.active {
    background: #10233a;
    border-color: #31506f;
    color: #edf3fb;
  }

  .portal-composer {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    padding: 10px;
  }

  .portal-composer-status {
    grid-column: 1 / -1;
    min-height: 26px;
    border-top: 1px solid #1e2936;
    display: flex;
    align-items: center;
    gap: 9px;
    padding-top: 8px;
    color: #8d9bad;
    font-size: 12px;
    line-height: 1.35;
  }

  .portal-composer-status span {
    color: #edf3fb;
    font-weight: 850;
    white-space: nowrap;
  }

  .portal-composer-status em {
    font-style: normal;
  }

  .portal-composer textarea {
    min-width: 0;
    resize: none;
    border: 0;
    outline: 0;
    background: transparent;
    color: #edf3fb;
    font: inherit;
    line-height: 1.45;
  }

  .portal-composer button {
    min-width: 92px;
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #2f7de1;
    color: #ffffff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    font-weight: 850;
  }

  .portal-section-heading {
    display: grid;
    gap: 4px;
  }

  .portal-section-heading h2 {
    font-size: 22px;
  }

  .portal-step-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .portal-api-plan-panel {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0b1118;
    display: grid;
    gap: 7px;
    padding: 12px;
  }

  .portal-api-plan-panel strong {
    color: #edf3fb;
    font-size: 13px;
  }

  .portal-api-plan-panel p {
    color: #a5b1c2;
    line-height: 1.5;
    font-size: 13px;
    margin: 0;
  }

  .portal-warning-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .portal-warning-row span {
    border: 1px solid #6d4a1f;
    border-radius: 8px;
    background: #24180e;
    color: #f59e42;
    padding: 5px 8px;
    font-size: 12px;
    font-weight: 750;
  }

  .portal-step-card,
  .portal-record-row,
  .portal-source-card,
  .portal-result-panel,
  .portal-result-card,
  .portal-context-block {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
  }

  .portal-step-card {
    min-height: 190px;
    color: #edf3fb;
    display: grid;
    align-content: start;
    gap: 9px;
    padding: 13px;
    text-align: left;
  }

  .portal-step-card-select {
    width: 100%;
    min-width: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    display: grid;
    align-content: start;
    gap: 9px;
    padding: 0;
    text-align: left;
  }

  .portal-step-card.active {
    border-color: #4f9cff;
    background: #122033;
  }

  .portal-step-card-select strong {
    font-size: 17px;
  }

  .portal-step-card-select em,
  .portal-step-card-select b,
  .portal-record-row em,
  .portal-source-card em,
  .portal-readiness-grid em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    font-weight: 650;
  }

  .portal-step-card-select b {
    color: #edf3fb;
  }

  .portal-interaction-panel {
    min-width: 0;
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #0b1118;
    display: grid;
    gap: 8px;
    padding: 10px;
  }

  .portal-interaction-heading {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .portal-interaction-heading span {
    width: fit-content;
    border: 1px solid #6d4a1f;
    border-radius: 999px;
    background: #24180e;
    color: #f59e42;
    padding: 3px 7px;
    font-size: 11px;
    font-weight: 850;
  }

  .portal-interaction-heading strong {
    color: #edf3fb;
    font-size: 13px;
    line-height: 1.35;
  }

  .portal-interaction-panel em {
    color: #d8e8ff;
    font-size: 12px;
    font-style: normal;
    line-height: 1.45;
  }

  .portal-option-row,
  .portal-interaction-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .portal-option-row button,
  .portal-interaction-actions button {
    min-height: 30px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    color: #aeb8c6;
    cursor: pointer;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 800;
  }

  .portal-option-row button.active {
    border-color: #4f9cff;
    background: #10233a;
    color: #edf3fb;
  }

  .portal-feedback-field {
    display: grid;
    gap: 5px;
  }

  .portal-feedback-field span {
    color: #8d9bad;
    font-size: 11px;
    font-weight: 850;
  }

  .portal-feedback-field textarea {
    width: 100%;
    min-width: 0;
    resize: vertical;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #090d13;
    color: #edf3fb;
    outline: 0;
    padding: 8px;
    line-height: 1.4;
  }

  .portal-interaction-actions button {
    background: #2f7de1;
    border-color: #31506f;
    color: #ffffff;
  }

  .portal-interaction-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .portal-action-status-text {
    color: #8d9bad;
    font-size: 12px;
    line-height: 1.4;
    margin: 0;
  }

  .portal-record-row {
    display: grid;
    gap: 7px;
    padding: 13px;
  }

  .portal-record-row.active {
    border-color: #4f9cff;
    background: #122033;
  }

  .portal-record-row div {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .portal-record-row button {
    min-height: 30px;
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #10233a;
    color: #d8e8ff;
    cursor: pointer;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .portal-detail-drawer {
    min-width: 0;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0b1118;
    display: grid;
    gap: 10px;
    padding: 13px;
  }

  .portal-detail-drawer strong {
    color: #edf3fb;
    line-height: 1.35;
  }

  .portal-detail-drawer em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    font-weight: 650;
  }

  .portal-detail-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .portal-detail-columns div {
    min-width: 0;
    border: 1px solid #1e2936;
    border-radius: 8px;
    display: grid;
    align-content: start;
    gap: 7px;
    padding: 10px;
  }

  .portal-detail-columns span {
    color: #aeb8c6;
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .portal-detail-columns button {
    min-width: 0;
    min-height: 30px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    color: #aeb8c6;
    cursor: pointer;
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 800;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .portal-detail-columns button.active {
    border-color: #4f9cff;
    background: #10233a;
    color: #edf3fb;
  }

  .portal-artifact-preview {
    max-height: 220px;
    min-width: 0;
    overflow: auto;
    border: 1px solid #1e2936;
    border-radius: 8px;
    background: #090d13;
    color: #d8e8ff;
    font-size: 12px;
    line-height: 1.45;
    margin: 0;
    padding: 10px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .portal-source-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .portal-source-card {
    min-height: 170px;
    display: grid;
    align-content: start;
    gap: 9px;
    padding: 13px;
  }

  .portal-source-card.active {
    border-color: #4f9cff;
    background: #122033;
  }

  .portal-source-card div {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #67b7ff;
  }

  .portal-source-card button {
    width: fit-content;
    min-height: 30px;
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #10233a;
    color: #d8e8ff;
    cursor: pointer;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .portal-source-drawer {
    min-width: 0;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0b1118;
    display: grid;
    gap: 10px;
    padding: 13px;
  }

  .portal-source-drawer strong {
    color: #edf3fb;
    line-height: 1.35;
  }

  .portal-source-drawer em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    font-weight: 650;
  }

  .portal-source-evidence-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .portal-source-evidence-grid div {
    min-width: 0;
    border: 1px solid #1e2936;
    border-radius: 8px;
    display: grid;
    align-content: start;
    gap: 7px;
    padding: 10px;
  }

  .portal-source-evidence-grid span {
    color: #aeb8c6;
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .portal-source-evidence-grid button {
    min-width: 0;
    min-height: 30px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    color: #aeb8c6;
    cursor: pointer;
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 800;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .portal-source-evidence-grid button.active {
    border-color: #4f9cff;
    background: #10233a;
    color: #edf3fb;
  }

  .portal-result-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.85fr);
    gap: 12px;
    padding: 14px;
  }

  .portal-result-summary {
    display: grid;
    align-content: start;
    gap: 9px;
  }

  .portal-result-summary svg {
    color: #67b7ff;
  }

  .portal-result-summary h3 {
    font-size: 24px;
  }

  .portal-result-handoff-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .portal-result-card {
    min-width: 0;
    min-height: 168px;
    display: grid;
    align-content: start;
    gap: 9px;
    padding: 13px;
  }

  .portal-result-card.active {
    border-color: #4f9cff;
    background: #122033;
  }

  .portal-result-card span {
    color: #8d9bad;
    font-size: 11px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .portal-result-card strong {
    color: #edf3fb;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .portal-result-card em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    font-weight: 650;
    overflow-wrap: anywhere;
  }

  .portal-result-card button {
    width: fit-content;
    min-height: 30px;
    border: 1px solid #31506f;
    border-radius: 8px;
    background: #10233a;
    color: #d8e8ff;
    cursor: pointer;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .portal-result-drawer {
    min-width: 0;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0b1118;
    display: grid;
    gap: 10px;
    padding: 13px;
  }

  .portal-result-drawer strong {
    color: #edf3fb;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .portal-result-drawer em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    font-weight: 650;
  }

  .portal-result-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .portal-result-detail-grid div {
    min-width: 0;
    border: 1px solid #1e2936;
    border-radius: 8px;
    display: grid;
    align-content: start;
    gap: 7px;
    padding: 10px;
  }

  .portal-result-detail-grid span {
    color: #aeb8c6;
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .portal-result-detail-grid button {
    min-width: 0;
    min-height: 30px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
    color: #aeb8c6;
    cursor: pointer;
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 800;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .portal-result-detail-grid button.active {
    border-color: #4f9cff;
    background: #10233a;
    color: #edf3fb;
  }

  .portal-readiness-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .portal-readiness-grid span {
    min-height: 82px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0b1118;
    display: grid;
    align-content: center;
    gap: 6px;
    padding: 12px;
  }

  .portal-context {
    min-width: 0;
    background: #0d1219;
    display: grid;
    align-content: start;
    gap: 12px;
    padding: 14px;
  }

  .portal-context-block {
    display: grid;
    gap: 10px;
    padding: 13px;
  }

  .portal-context-block h2 {
    font-size: 20px;
  }

  .portal-context-block strong {
    font-size: 28px;
    color: #edf3fb;
  }

  .portal-mini-steps button {
    min-height: 46px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0b1118;
    color: #edf3fb;
    cursor: pointer;
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    padding: 0 10px;
    text-align: left;
  }

  .portal-mini-steps button.active {
    border-color: #4f9cff;
    background: #10233a;
  }

  .portal-mini-steps .portal-step-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #4f9cff;
  }

  .portal-mini-steps .portal-step-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 800;
  }

  .portal-mini-steps em {
    color: #8d9bad;
    font-size: 11px;
    font-style: normal;
    font-weight: 750;
  }

  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid #67b7ff;
    outline-offset: 2px;
  }

  @media (max-width: 1100px) {
    .portal-main {
      grid-template-columns: minmax(0, 1fr) 320px;
    }

    .portal-step-grid,
    .portal-source-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .portal-shell {
      grid-template-columns: 1fr;
    }

    .portal-nav {
      position: sticky;
      bottom: 0;
      z-index: 20;
      order: 2;
      border-right: 0;
      border-top: 1px solid #1e2936;
      padding: 8px;
      grid-template-rows: 1fr;
    }

    .portal-brand {
      display: none;
    }

    .portal-nav nav {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
    }

    .portal-nav button {
      min-height: 48px;
      padding: 6px 2px;
    }

    .portal-nav button span {
      font-size: 10px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .portal-main {
      grid-template-columns: 1fr;
      grid-row: 1;
    }

    .portal-workspace {
      border-right: 0;
    }

    .portal-topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .portal-topbar-actions {
      justify-content: flex-start;
    }

    .portal-view {
      padding: 12px;
    }

    .portal-context {
      border-top: 1px solid #1e2936;
    }

    .portal-step-grid,
    .portal-source-grid,
    .portal-result-panel,
    .portal-result-handoff-grid,
    .portal-readiness-grid,
    .portal-detail-columns,
    .portal-source-evidence-grid,
    .portal-result-detail-grid {
      grid-template-columns: 1fr;
    }

    .portal-chat-actions {
      display: grid;
      grid-template-columns: 1fr;
    }

    .portal-composer {
      grid-template-columns: 1fr;
    }

    .portal-admin-actions {
      grid-template-columns: 1fr;
    }

    .portal-composer button {
      min-height: 38px;
    }
  }
`;

export default AgentPortalInterface;
