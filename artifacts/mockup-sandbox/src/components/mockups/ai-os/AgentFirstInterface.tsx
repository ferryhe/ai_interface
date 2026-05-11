import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileText,
  Globe2,
  Layers3,
  ListChecks,
  MessageSquareText,
  Paperclip,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";

type AppView = "agent" | "modules" | "progress" | "data" | "publish" | "configure";
type ModuleId = "web_listening" | "doc_to_md" | "md_to_rag" | "rag_to_agent";
type RunStatus = "running" | "waiting" | "succeeded" | "queued";
type RuntimeExecutionMode = "plan_only" | "execute_ready";
type RuntimeRunStatus =
  | "succeeded"
  | "running"
  | "resumable"
  | "approval_required"
  | "waiting_for_user"
  | "waiting_for_data"
  | "blocked"
  | "skipped"
  | "queued";
type RuntimeActionState = "idle" | "submitting" | "succeeded" | "failed";
type AgentProvider = "openai";
type AgentEndpoint = "responses" | "agents_sdk";
type AgentReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
type MemoryPromotionMode = "manual" | "agent_suggested";
type AgentConnectionStatus = "configured" | "missing_key" | "offline";
type PublishStatus = "draft" | "published" | "paused";
type PublishSaveState = "local" | "saving" | "saved" | "offline" | "failed";
type GeneralSkillId =
  | "web_search"
  | "browser"
  | "github"
  | "notion"
  | "lark"
  | "file_tools";

interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  status: RunStatus;
  records: number;
  result: string;
  color: string;
}

interface RunStep {
  id: string;
  moduleId: ModuleId;
  title: string;
  detail: string;
  status: RunStatus;
  time: string;
}

interface RuntimeModuleRun {
  id: string;
  moduleId: ModuleId;
  title: string;
  status: RuntimeRunStatus;
  adapterId: string;
  adapterKind: "cli" | "http";
  externalRunId: string;
  interaction?: {
    kind: "question" | "approval" | "data_request" | "blocked";
    title: string;
    message: string;
    resumeHandle: string;
    status: "waiting" | "resumable" | "resumed" | "blocked";
  };
  event: string;
  resultRecordIds: string[];
  missingRequiredEnv: string[];
  updatedAt: string;
}

type JsonObject = Record<string, unknown>;
type AgentRunSubmitState = "local" | "submitting" | "saved" | "offline" | "failed";
type ToolInteractionApiStatus =
  | "waiting_for_user"
  | "waiting_for_approval"
  | "waiting_for_data"
  | "blocked"
  | "resumable"
  | "resumed";

interface AgentRunApiModuleRun {
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

interface AgentRunApiPlanStep {
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
}

interface AgentRunApiResponse {
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
  moduleRuns: AgentRunApiModuleRun[];
  plan: {
    summary: string;
    steps: AgentRunApiPlanStep[];
    warnings: string[];
  };
}

interface ToolInteractionApi {
  interactionId: string;
  status: ToolInteractionApiStatus;
  kind: "question" | "approval" | "data_request" | "blocked";
  title: string;
  message: string;
  prompt: string | null;
  resumeHandle: string | null;
  requestedAt: string;
  metadata: JsonObject;
}

interface ToolInteractionApiResponse {
  run: AgentRunApiModuleRun;
  interaction: ToolInteractionApi;
}

interface AgentRunUiState {
  response: AgentRunApiResponse;
  runtimeRuns: RuntimeModuleRun[];
}

interface DataRecord {
  id: string;
  kind: string;
  title: string;
  moduleId: ModuleId;
  summary: string;
  updatedAt: string;
}

interface CapabilityGuide {
  summary: string;
  trigger: string;
  action: string;
  output: string;
  boundary: string;
}

interface BusinessSkillSetting {
  moduleId: ModuleId;
  enabled: boolean;
  approvalRequired: boolean;
  canUseNetwork: boolean;
  canWriteDatabase: boolean;
}

interface GeneralSkillSetting {
  skillId: GeneralSkillId;
  name: string;
  description: string;
  enabled: boolean;
  installed: boolean;
  installOnDemand: boolean;
  requiresApproval: boolean;
  canUseNetwork: boolean;
}

interface AgentMemorySettings {
  shortTermEnabled: boolean;
  longTermEnabled: boolean;
  promotionMode: MemoryPromotionMode;
  ragCollection: string;
  retentionDays: number;
}

interface AgentSafetySettings {
  requireApprovalForExternalActions: boolean;
  requireApprovalForPublishing: boolean;
  allowSelfLearning: boolean;
  maxToolSteps: number;
}

interface AgentConfigDraft {
  provider: AgentProvider;
  endpoint: AgentEndpoint;
  modelId: string;
  reasoningEffort: AgentReasoningEffort;
  systemPrompt: string;
  businessSkillSettings: BusinessSkillSetting[];
  generalSkillSettings: GeneralSkillSetting[];
  memorySettings: AgentMemorySettings;
  safetySettings: AgentSafetySettings;
}

interface PublishSettingsApi {
  status: PublishStatus;
  portalAccessMode: "token";
  portalTokenLast4: string | null;
  portalTokenUpdatedAt: string | null;
  publishedAt: string | null;
  versionLabel: string;
}

interface AgentConfigApi extends AgentConfigDraft {
  publishSettings?: unknown;
}

interface AgentConfigApiResponse {
  config: AgentConfigApi;
  connection: {
    status: Exclude<AgentConnectionStatus, "offline">;
    checkedAt?: string;
  };
}

interface AgentConnectionApiResponse {
  status: Exclude<AgentConnectionStatus, "offline">;
  checkedAt: string;
}

const modules: ModuleDefinition[] = [
  {
    id: "web_listening",
    name: "web_listening",
    description: "Monitor URLs, create page snapshots, extract text, and detect changes.",
    status: "succeeded",
    records: 18,
    result: "18 snapshots / 3 changes",
    color: "#4f9cff",
  },
  {
    id: "doc_to_md",
    name: "doc_to_md",
    description: "Convert source documents into Markdown with warnings and assets.",
    status: "succeeded",
    records: 6,
    result: "6 markdown docs",
    color: "#35d07f",
  },
  {
    id: "md_to_rag",
    name: "md_to_rag",
    description: "Chunk Markdown, prepare embedding metadata, and build RAG index records.",
    status: "running",
    records: 124,
    result: "96 / 124 chunks indexed",
    color: "#a78bfa",
  },
  {
    id: "rag_to_agent",
    name: "rag_to_agent",
    description: "Generate agent configs, prompts, tools, and validation results.",
    status: "waiting",
    records: 2,
    result: "waiting for RAG index",
    color: "#f97316",
  },
];

const moduleGuides: Record<ModuleId, CapabilityGuide> = {
  web_listening: {
    summary: "Watches source URLs and turns web changes into database records the Agent can reason about.",
    trigger: "Use when a source website, docs page, changelog, or competitor page needs monitoring.",
    action: "The Agent asks the module to fetch pages, snapshot HTML, extract readable text, and compare changes.",
    output: "Snapshots, extracted text, detected change events, and provenance appear in Modules, Progress, and Data.",
    boundary: "This is the only business skill that normally needs network access.",
  },
  doc_to_md: {
    summary: "Converts uploaded or collected documents into clean Markdown that downstream modules can consume.",
    trigger: "Use when PDFs, Word docs, exports, or raw source documents need to become structured text.",
    action: "The Agent sends source document references to the module and stores Markdown plus warnings/assets.",
    output: "Markdown documents, conversion warnings, asset references, and source metadata are stored as artifacts.",
    boundary: "It should not decide knowledge structure; it only prepares readable Markdown.",
  },
  md_to_rag: {
    summary: "Builds retrieval memory from Markdown by chunking text and preparing embedding/index metadata.",
    trigger: "Use after Markdown exists and the Agent needs searchable long-term knowledge.",
    action: "The Agent asks for chunks, token counts, embedding payload metadata, and index status records.",
    output: "RAG chunks, token counts, embedding metadata, and index progress become visible in Data.",
    boundary: "It prepares memory records; model-facing answers still come from the Agent runtime.",
  },
  rag_to_agent: {
    summary: "Turns validated RAG memory into a publishable agent configuration with prompts and tool bindings.",
    trigger: "Use when the knowledge base is ready and you want a publishable or testable agent.",
    action: "The Agent asks for prompts, tool definitions, validation checks, and final handoff state.",
    output: "Generated agent configs, prompts, tool bindings, and validation results appear before Publish.",
    boundary: "Keep approval on for this skill because it can shape what the final agent is allowed to do.",
  },
};

const generalSkillGuides: Record<GeneralSkillId, CapabilityGuide> = {
  web_search: {
    summary: "Lets the Agent look up fresh public information when project memory may be stale.",
    trigger: "Use for latest docs, pricing, release notes, laws, APIs, news, or anything time-sensitive.",
    action: "The Agent searches, reads selected sources, cites what it used, then folds the result into the plan.",
    output: "Search findings show in chat summaries and can be saved into memory when relevant.",
    boundary: "Requires network and approval because it leaves the local project context.",
  },
  browser: {
    summary: "Lets the Agent open local previews and inspect actual UI state instead of guessing from code.",
    trigger: "Use for smoke tests, visual checks, clicking through flows, and reading browser console issues.",
    action: "The Agent opens the page, navigates, clicks controls, checks DOM/console, and reports what rendered.",
    output: "Verified page state, screenshots when useful, and console findings are reported back in the thread.",
    boundary: "Approval stays useful for external sites or any action that changes third-party state.",
  },
  github: {
    summary: "Lets the Agent inspect repository work, pull requests, checks, reviews, and issues.",
    trigger: "Use when PR state, CI failures, review comments, or remote branch status matters.",
    action: "The Agent reads PR metadata, checks, comments, and can push confirmed-safe fixes from this repo.",
    output: "PR summaries, check status, review decisions, commits, and links are shown in the conversation.",
    boundary: "Writes, merges, or destructive Git operations should remain approval-gated.",
  },
  notion: {
    summary: "Lets the Agent use workspace knowledge and capture decisions into structured documents.",
    trigger: "Use when plans, meeting notes, specs, decisions, or knowledge pages should live in Notion.",
    action: "The Agent reads selected pages or writes structured summaries when you approve the destination.",
    output: "Notion pages, implementation specs, and linked knowledge records become part of the handoff.",
    boundary: "Workspace reads/writes should be explicit because they may contain private team context.",
  },
  lark: {
    summary: "Lets the Agent interact with Lark messages, docs, tasks, calendars, approvals, and Base records.",
    trigger: "Use for team workflows: send updates, create docs, query tasks, prepare meetings, or sync tables.",
    action: "The Agent routes to the right Lark capability and asks before sending or changing shared state.",
    output: "Messages, docs, tasks, calendar results, or Base records are linked back to the Agent thread.",
    boundary: "External communication and sensitive-data transmission must stay approval-gated.",
  },
  file_tools: {
    summary: "Lets the Agent read and prepare files inside the approved project workspace.",
    trigger: "Use for local code, docs, fixtures, generated plans, and files that belong to this project.",
    action: "The Agent reads relevant files, edits scoped files when requested, and keeps Git changes isolated.",
    output: "Changed files, diffs, verification results, commits, and PR links are reported in the run summary.",
    boundary: "It should stay inside `ai_interface`; sibling repositories remain off-limits unless requested.",
  },
};

const configureGuides = {
  provider:
    "Controls which AI runtime the console talks to. V1 checks environment-based API key status and never stores plaintext keys in the browser.",
  model:
    "Controls the model, reasoning effort, and system prompt that shape planning quality, tool choice, and response style.",
  memory:
    "Controls short-term thread memory and long-term Postgres memory so module outputs can become reusable context.",
  safety:
    "Controls approval points, self-learning behavior, publishing gates, and how many tool steps the Agent may take.",
  runtime:
    "Summarizes the current runtime contract: provider, active skills, memory mode, and safety posture.",
};

const businessSwitchGuides = [
  {
    label: "Enabled",
    detail: "Whether the Agent is allowed to call this business module.",
  },
  {
    label: "Approval",
    detail: "When on, the Agent asks before running sensitive or finalizing actions.",
  },
  {
    label: "Network",
    detail: "Whether this module may reach external URLs or services.",
  },
  {
    label: "DB write",
    detail: "Whether this module may persist results, events, and artifacts into Postgres memory.",
  },
];

const generalSwitchGuides = [
  {
    label: "Enabled",
    detail: "The Agent can use this general skill without first proposing installation.",
  },
  {
    label: "On demand",
    detail: "The Agent may suggest installing or enabling it during a conversation.",
  },
  {
    label: "Approval",
    detail: "The Agent must ask before actions with external, shared, or sensitive effects.",
  },
  {
    label: "Network",
    detail: "The skill may connect to external services or public web sources.",
  },
];

const defaultAgentConfig: AgentConfigDraft = {
  provider: "openai",
  endpoint: "responses",
  modelId: "gpt-5.5",
  reasoningEffort: "medium",
  systemPrompt:
    "You are the Agent Module OS orchestrator. Plan carefully, call registered modules through approved tools, store canonical results in Postgres memory, and explain progress with links to module results.",
  businessSkillSettings: modules.map((module) => ({
    moduleId: module.id,
    enabled: true,
    approvalRequired: module.id === "rag_to_agent",
    canUseNetwork: module.id === "web_listening",
    canWriteDatabase: true,
  })),
  generalSkillSettings: [
    {
      skillId: "web_search",
      name: "Web Search",
      description: "Search current web sources when fresh outside context is needed.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "browser",
      name: "Browser",
      description: "Open, inspect, and smoke-test local or remote web pages.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "github",
      name: "GitHub",
      description: "Read PRs, issues, reviews, and check status when approved.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "notion",
      name: "Notion",
      description: "Capture decisions and read team knowledge when connected.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "lark",
      name: "Lark",
      description: "Use Lark messages, docs, calendar, tasks, and approvals.",
      enabled: false,
      installed: false,
      installOnDemand: true,
      requiresApproval: true,
      canUseNetwork: true,
    },
    {
      skillId: "file_tools",
      name: "File Tools",
      description: "Read and prepare local workspace files inside project boundaries.",
      enabled: true,
      installed: true,
      installOnDemand: false,
      requiresApproval: false,
      canUseNetwork: false,
    },
  ],
  memorySettings: {
    shortTermEnabled: true,
    longTermEnabled: true,
    promotionMode: "agent_suggested",
    ragCollection: "agent-module-os",
    retentionDays: 90,
  },
  safetySettings: {
    requireApprovalForExternalActions: true,
    requireApprovalForPublishing: true,
    allowSelfLearning: true,
    maxToolSteps: 12,
  },
};

const defaultPublishSettings: PublishSettingsApi = {
  status: "draft",
  portalAccessMode: "token",
  portalTokenLast4: null,
  portalTokenUpdatedAt: null,
  publishedAt: null,
  versionLabel: "draft-0.3",
};

const runSteps: RunStep[] = [
  {
    id: "listen",
    moduleId: "web_listening",
    title: "Watched source docs",
    detail: "Created canonical snapshots and extracted text for changed pages.",
    status: "succeeded",
    time: "09:31",
  },
  {
    id: "convert",
    moduleId: "doc_to_md",
    title: "Converted documents",
    detail: "Stored Markdown, conversion warnings, and source provenance.",
    status: "succeeded",
    time: "09:35",
  },
  {
    id: "index",
    moduleId: "md_to_rag",
    title: "Building RAG memory",
    detail: "Chunk metadata and embedding records are being written to Postgres.",
    status: "running",
    time: "09:39",
  },
  {
    id: "agent",
    moduleId: "rag_to_agent",
    title: "Generate publishable agent",
    detail: "Queued until the index passes validation.",
    status: "waiting",
    time: "Next",
  },
];

const mockRuntimeRuns: RuntimeModuleRun[] = [
  {
    id: "run-web-listening-018",
    moduleId: "web_listening",
    title: "Watched source docs",
    status: "succeeded",
    adapterId: "web_listening.cli.v1",
    adapterKind: "cli",
    externalRunId: "web-listening-ext-018",
    event: "Snapshots stored and change events linked to memory.",
    resultRecordIds: ["snap_018"],
    missingRequiredEnv: [],
    updatedAt: "09:31",
  },
  {
    id: "run-doc-to-md-006",
    moduleId: "doc_to_md",
    title: "Converted source documents",
    status: "resumable",
    adapterId: "doc_to_md.http.v1",
    adapterKind: "http",
    externalRunId: "doc-resume-001",
    interaction: {
      kind: "question",
      title: "Conversion warning needs confirmation",
      message: "OCR found a low-confidence table in onboarding.pdf. Confirm whether to keep the extracted table.",
      resumeHandle: "doc_to_md:doc-resume-001:resume",
      status: "resumable",
    },
    event: "Markdown stored with one conversion warning ready for feedback.",
    resultRecordIds: ["md_006"],
    missingRequiredEnv: [],
    updatedAt: "09:35",
  },
  {
    id: "run-md-to-rag-096",
    moduleId: "md_to_rag",
    title: "Prepared RAG chunks",
    status: "skipped",
    adapterId: "md_to_rag.cli.v1",
    adapterKind: "cli",
    externalRunId: "rag-index-096",
    event: "Execution skipped until the local C-Ross adapter path is configured.",
    resultRecordIds: ["chunk_096"],
    missingRequiredEnv: ["CROSS2_CLI_PATH"],
    updatedAt: "09:41",
  },
  {
    id: "run-rag-to-agent-002",
    moduleId: "rag_to_agent",
    title: "Generated agent configuration",
    status: "approval_required",
    adapterId: "rag_to_agent.http.v1",
    adapterKind: "http",
    externalRunId: "agent-config-002",
    interaction: {
      kind: "approval",
      title: "Approve generated agent config",
      message: "Review the generated prompt, tool bindings, and publish gate before the final agent handoff.",
      resumeHandle: "rag_to_agent:agent-config-002:approval",
      status: "waiting",
    },
    event: "Draft agent config is waiting for approval before publish handoff.",
    resultRecordIds: ["agent_cfg_002"],
    missingRequiredEnv: [],
    updatedAt: "09:42",
  },
];

const dataRecords: DataRecord[] = [
  {
    id: "snap_018",
    kind: "web_snapshot",
    title: "docs.example.com/getting-started",
    moduleId: "web_listening",
    summary: "HTML snapshot, extracted body text, detected nav change.",
    updatedAt: "09:31",
  },
  {
    id: "md_006",
    kind: "markdown_document",
    title: "onboarding.md",
    moduleId: "doc_to_md",
    summary: "4,821 words, 1 OCR warning, 3 embedded assets.",
    updatedAt: "09:35",
  },
  {
    id: "chunk_096",
    kind: "rag_chunk",
    title: "Chunk 96 / onboarding",
    moduleId: "md_to_rag",
    summary: "812 tokens, embedding metadata ready, parent md_006.",
    updatedAt: "09:41",
  },
  {
    id: "agent_cfg_002",
    kind: "agent_config",
    title: "Onboarding Guide",
    moduleId: "rag_to_agent",
    summary: "Draft prompt, search tool binding, validation pending.",
    updatedAt: "09:42",
  },
];

const navItems: Array<{ id: AppView; label: string; icon: ReactNode }> = [
  { id: "agent", label: "Agent", icon: <Bot size={18} /> },
  { id: "modules", label: "Modules", icon: <Boxes size={18} /> },
  { id: "progress", label: "Progress", icon: <ListChecks size={18} /> },
  { id: "data", label: "Data", icon: <Database size={18} /> },
  { id: "configure", label: "Configure", icon: <Settings2 size={18} /> },
  { id: "publish", label: "Publish", icon: <UploadCloud size={18} /> },
];

function previewUrl(componentPath: string, search = ""): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${basePath}/preview/${componentPath}${search}`;
}

function statusLabel(status: RunStatus): string {
  if (status === "succeeded") return "Succeeded";
  if (status === "running") return "Running";
  if (status === "waiting") return "Waiting";
  return "Queued";
}

function statusClass(status: RunStatus): string {
  return `status-dot ${status}`;
}

function runtimeStatusLabel(status: RuntimeRunStatus): string {
  if (status === "approval_required") return "Approval";
  if (status === "waiting_for_user") return "Needs reply";
  if (status === "waiting_for_data") return "Needs data";
  if (status === "blocked") return "Blocked";
  if (status === "resumable") return "Resume ready";
  if (status === "skipped") return "Config needed";
  if (status === "succeeded") return "Succeeded";
  if (status === "running") return "Running";
  return "Queued";
}

function runtimeStatusClass(status: RuntimeRunStatus): string {
  return `runtime-status ${status}`;
}

function moduleById(moduleId: ModuleId): ModuleDefinition {
  return modules.find((item) => item.id === moduleId) ?? modules[0]!;
}

function stringFromMetadata(
  metadata: JsonObject | null,
  key: string,
  fallback: string,
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

function stringArrayFromMetadata(
  metadata: JsonObject | null,
  key: string,
): string[] {
  const value = metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isInteractionKind(value: unknown): value is ToolInteractionApi["kind"] {
  return (
    value === "question" ||
    value === "approval" ||
    value === "data_request" ||
    value === "blocked"
  );
}

function isInteractionStatus(value: unknown): value is ToolInteractionApiStatus {
  return (
    value === "waiting_for_user" ||
    value === "waiting_for_approval" ||
    value === "waiting_for_data" ||
    value === "blocked" ||
    value === "resumable" ||
    value === "resumed"
  );
}

function parseToolInteraction(metadata: JsonObject | null): ToolInteractionApi | null {
  const value = metadata?.["interaction"];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const interaction = value as JsonObject;
  if (
    typeof interaction["interactionId"] !== "string" ||
    !isInteractionStatus(interaction["status"]) ||
    !isInteractionKind(interaction["kind"]) ||
    typeof interaction["title"] !== "string" ||
    typeof interaction["message"] !== "string" ||
    typeof interaction["requestedAt"] !== "string"
  ) {
    return null;
  }

  return {
    interactionId: interaction["interactionId"],
    status: interaction["status"],
    kind: interaction["kind"],
    title: interaction["title"],
    message: interaction["message"],
    prompt: typeof interaction["prompt"] === "string" ? interaction["prompt"] : null,
    resumeHandle:
      typeof interaction["resumeHandle"] === "string"
        ? interaction["resumeHandle"]
        : null,
    requestedAt: interaction["requestedAt"],
    metadata:
      interaction["metadata"] &&
      typeof interaction["metadata"] === "object" &&
      !Array.isArray(interaction["metadata"])
        ? (interaction["metadata"] as JsonObject)
        : {},
  };
}

function runtimeStatusFromApiRun(run: AgentRunApiModuleRun): RuntimeRunStatus {
  const interaction = parseToolInteraction(run.metadata);
  if (run.status === "succeeded") return "succeeded";
  if (run.status === "failed" || run.status === "cancelled") return "skipped";
  if (interaction?.status === "resumable") return "resumable";
  if (interaction?.status === "resumed") return "running";
  if (interaction?.status === "waiting_for_approval") return "approval_required";
  if (interaction?.status === "waiting_for_data") return "waiting_for_data";
  if (interaction?.status === "waiting_for_user") return "waiting_for_user";
  if (interaction?.status === "blocked") return "blocked";
  if (run.status === "running") return "running";
  if (run.metadata?.["adapterExecutionStatus"] === "skipped") return "skipped";
  if (run.metadata?.["requiresApproval"] === true) return "approval_required";
  return "queued";
}

function runtimeInteractionStatusFromApi(
  status: ToolInteractionApiStatus,
): NonNullable<RuntimeModuleRun["interaction"]>["status"] {
  if (status === "resumable") return "resumable";
  if (status === "resumed") return "resumed";
  if (status === "blocked") return "blocked";
  return "waiting";
}

function toRuntimeRunFromApiModuleRun(run: AgentRunApiModuleRun): RuntimeModuleRun {
  const interaction = parseToolInteraction(run.metadata);

  return {
    id: run.id,
    moduleId: run.moduleId,
    title: run.title ?? moduleById(run.moduleId).name,
    status: runtimeStatusFromApiRun(run),
    adapterId: stringFromMetadata(run.metadata, "adapterId", `${run.moduleId}.adapter`),
    adapterKind:
      stringFromMetadata(run.metadata, "adapterKind", "http") === "cli"
        ? "cli"
        : "http",
    externalRunId: run.externalRunId,
    interaction: interaction
      ? {
          kind: interaction.kind,
          title: interaction.title,
          message: interaction.message,
          resumeHandle: interaction.resumeHandle ?? `${run.externalRunId}:resume`,
          status: runtimeInteractionStatusFromApi(interaction.status),
        }
      : undefined,
    event:
      run.summary ??
      stringFromMetadata(run.metadata, "action", "Agent runtime planned this module run."),
    resultRecordIds: run.outputJson ? [run.id] : [],
    missingRequiredEnv: stringArrayFromMetadata(run.metadata, "adapterMissingRequiredEnv"),
    updatedAt: new Date(run.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function toRuntimeRunsFromAgentRun(response: AgentRunApiResponse): RuntimeModuleRun[] {
  return response.moduleRuns.map(toRuntimeRunFromApiModuleRun);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isPublishSettingsApi(value: unknown): value is PublishSettingsApi {
  if (!isRecord(value)) return false;

  return (
    (value["status"] === "draft" ||
      value["status"] === "published" ||
      value["status"] === "paused") &&
    value["portalAccessMode"] === "token" &&
    typeof value["versionLabel"] === "string"
  );
}

function toPublishSettingsApi(value: unknown): PublishSettingsApi {
  if (!isPublishSettingsApi(value)) return { ...defaultPublishSettings };

  return {
    status: value.status,
    portalAccessMode: value.portalAccessMode,
    portalTokenLast4: nullableString(value.portalTokenLast4),
    portalTokenUpdatedAt: nullableString(value.portalTokenUpdatedAt),
    publishedAt: nullableString(value.publishedAt),
    versionLabel: value.versionLabel,
  };
}

function toConfigDraft(config: AgentConfigDraft): AgentConfigDraft {
  return {
    provider: config.provider,
    endpoint: config.endpoint,
    modelId: config.modelId,
    reasoningEffort: config.reasoningEffort,
    systemPrompt: config.systemPrompt,
    businessSkillSettings: config.businessSkillSettings.map((skill) => ({ ...skill })),
    generalSkillSettings: config.generalSkillSettings.map((skill) => ({ ...skill })),
    memorySettings: { ...config.memorySettings },
    safetySettings: { ...config.safetySettings },
  };
}

function connectionLabel(status: AgentConnectionStatus): string {
  if (status === "configured") return "API key detected";
  if (status === "missing_key") return "OPENAI_API_KEY missing";
  return "API offline";
}

function agentRunStateLabel(state: AgentRunSubmitState): string {
  if (state === "submitting") return "Submitting";
  if (state === "saved") return "API saved";
  if (state === "offline") return "API offline";
  if (state === "failed") return "API failed";
  return "Local mock";
}

export function AgentFirstInterface() {
  const [activeView, setActiveView] = useState<AppView>("agent");
  const [selectedModuleId, setSelectedModuleId] = useState<ModuleId>("md_to_rag");
  const [command, setCommand] = useState("");
  const [planMode, setPlanMode] = useState(true);
  const [executionMode, setExecutionMode] =
    useState<RuntimeExecutionMode>("execute_ready");
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [selectedRecordKind, setSelectedRecordKind] = useState("all");
  const [agentConfig, setAgentConfig] = useState<AgentConfigDraft>(() =>
    toConfigDraft(defaultAgentConfig),
  );
  const [publishSettings, setPublishSettings] = useState<PublishSettingsApi>(() => ({
    ...defaultPublishSettings,
  }));
  const [publishTokenDraft, setPublishTokenDraft] = useState("");
  const [publishSaveState, setPublishSaveState] =
    useState<PublishSaveState>("local");
  const [publishStatusText, setPublishStatusText] = useState(
    "Local publish settings",
  );
  const [connectionStatus, setConnectionStatus] =
    useState<AgentConnectionStatus>("offline");
  const [configStatus, setConfigStatus] = useState("Local draft");
  const [isConfigBusy, setIsConfigBusy] = useState(false);
  const [agentRunState, setAgentRunState] =
    useState<AgentRunSubmitState>("local");
  const [agentRunStatusText, setAgentRunStatusText] =
    useState("Local mock runtime");
  const [latestAgentRun, setLatestAgentRun] =
    useState<AgentRunUiState | null>(null);
  const [runtimeActionStates, setRuntimeActionStates] =
    useState<Record<string, RuntimeActionState>>({});
  const [runtimeActionStatusText, setRuntimeActionStatusText] =
    useState("Runtime actions are local until API run data is available");

  const selectedModule = moduleById(selectedModuleId);
  const displayedRuntimeRuns = latestAgentRun?.runtimeRuns ?? mockRuntimeRuns;
  const filteredRecords = useMemo(
    () =>
      selectedRecordKind === "all"
        ? dataRecords
        : dataRecords.filter((record) => record.kind === selectedRecordKind),
    [selectedRecordKind],
  );

  function openModules(moduleId?: ModuleId): void {
    if (moduleId) {
      setSelectedModuleId(moduleId);
    }
    setActiveView("modules");
  }

  function updateRuntimeRun(updatedRun: RuntimeModuleRun): void {
    setLatestAgentRun((current) =>
      current
        ? {
            ...current,
            runtimeRuns: current.runtimeRuns.map((run) =>
              run.id === updatedRun.id ? updatedRun : run,
            ),
          }
        : current,
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAgentConfig(): Promise<void> {
      try {
        const response = await fetch("/api/agent-config");
        if (!response.ok) {
          throw new Error(`Config API returned ${response.status}`);
        }

        const data = (await response.json()) as AgentConfigApiResponse;
        if (cancelled) return;

        setAgentConfig(toConfigDraft(data.config));
        setPublishSettings(toPublishSettingsApi(data.config.publishSettings));
        setPublishTokenDraft("");
        setConnectionStatus(data.connection.status);
        setConfigStatus("Loaded from API");
        setPublishSaveState("saved");
        setPublishStatusText("Loaded publish settings from API");
      } catch {
        if (cancelled) return;
        setConnectionStatus("offline");
        setConfigStatus("API offline - local draft");
        setPublishSaveState("offline");
        setPublishStatusText("API offline - local publish settings");
      }
    }

    void loadAgentConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateConfig(patch: Partial<AgentConfigDraft>): void {
    setAgentConfig((current) => ({ ...current, ...patch }));
    setConfigStatus("Unsaved local draft");
  }

  function updateBusinessSkill(
    moduleId: ModuleId,
    patch: Partial<BusinessSkillSetting>,
  ): void {
    setAgentConfig((current) => ({
      ...current,
      businessSkillSettings: current.businessSkillSettings.map((skill) =>
        skill.moduleId === moduleId ? { ...skill, ...patch } : skill,
      ),
    }));
    setConfigStatus("Unsaved local draft");
  }

  function updateGeneralSkill(
    skillId: GeneralSkillId,
    patch: Partial<GeneralSkillSetting>,
  ): void {
    setAgentConfig((current) => ({
      ...current,
      generalSkillSettings: current.generalSkillSettings.map((skill) =>
        skill.skillId === skillId ? { ...skill, ...patch } : skill,
      ),
    }));
    setConfigStatus("Unsaved local draft");
  }

  function updateMemorySettings(patch: Partial<AgentMemorySettings>): void {
    setAgentConfig((current) => ({
      ...current,
      memorySettings: { ...current.memorySettings, ...patch },
    }));
    setConfigStatus("Unsaved local draft");
  }

  function updateSafetySettings(patch: Partial<AgentSafetySettings>): void {
    setAgentConfig((current) => ({
      ...current,
      safetySettings: { ...current.safetySettings, ...patch },
    }));
    setConfigStatus("Unsaved local draft");
  }

  async function saveAgentConfig(): Promise<void> {
    setIsConfigBusy(true);
    try {
      const response = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentConfig),
      });
      if (!response.ok) {
        throw new Error(`Config API returned ${response.status}`);
      }

      const data = (await response.json()) as AgentConfigApiResponse;
      setAgentConfig(toConfigDraft(data.config));
      setConnectionStatus(data.connection.status);
      setConfigStatus("Saved to API");
    } catch {
      setConnectionStatus("offline");
      setConfigStatus("API offline - local draft only");
    } finally {
      setIsConfigBusy(false);
    }
  }

  function updatePublishVersionLabel(versionLabel: string): void {
    setPublishSettings((current) => ({ ...current, versionLabel }));
    setPublishSaveState("local");
    setPublishStatusText("Unsaved local publish settings");
  }

  async function savePublishSettings(nextStatus: PublishStatus): Promise<void> {
    if (publishSaveState === "saving") return;

    const versionLabel = publishSettings.versionLabel.trim() || "draft-0.3";
    const token = publishTokenDraft.trim();

    setPublishSaveState("saving");
    setPublishStatusText("Saving publish settings");

    try {
      const publishSettingsPayload: {
        status: PublishStatus;
        portalAccessMode: "token";
        setPortalToken?: string;
        versionLabel: string;
      } = {
        status: nextStatus,
        portalAccessMode: "token",
        versionLabel,
      };
      if (token) {
        publishSettingsPayload.setPortalToken = token;
      }

      const response = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishSettings: publishSettingsPayload,
        }),
      });
      if (!response.ok) {
        throw new Error(`Config API returned ${response.status}`);
      }

      const data = (await response.json()) as AgentConfigApiResponse;
      const nextSettings = toPublishSettingsApi(data.config.publishSettings);
      setPublishSettings(nextSettings);
      setAgentConfig(toConfigDraft(data.config));
      setConnectionStatus(data.connection.status);
      setPublishTokenDraft("");
      setPublishSaveState("saved");
      setPublishStatusText("Saved publish settings to API");
    } catch {
      const now = new Date().toISOString();
      setPublishSettings((current) => ({
        ...current,
        status: nextStatus,
        versionLabel,
        portalTokenLast4: token ? token.slice(-4) : current.portalTokenLast4,
        portalTokenUpdatedAt: token ? now : current.portalTokenUpdatedAt,
        publishedAt:
          nextStatus === "published" && current.status !== "published"
            ? now
            : current.publishedAt,
      }));
      setConnectionStatus("offline");
      setPublishSaveState("offline");
      setPublishStatusText("API offline - local publish settings only");
    }
  }

  async function testAgentConnection(): Promise<void> {
    setIsConfigBusy(true);
    try {
      const response = await fetch("/api/agent-config/test-connection", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Config API returned ${response.status}`);
      }

      const data = (await response.json()) as AgentConnectionApiResponse;
      setConnectionStatus(data.status);
      setConfigStatus(connectionLabel(data.status));
    } catch {
      setConnectionStatus("offline");
      setConfigStatus("API offline - cannot test key");
    } finally {
      setIsConfigBusy(false);
    }
  }

  async function submitCommand(): Promise<void> {
    if (agentRunState === "submitting") return;

    const trimmed = command.trim();
    if (!trimmed) return;

    setQueuedPrompt(trimmed);
    setCommand("");
    setAgentRunState("submitting");
    setAgentRunStatusText("Submitting to Agent Run API");
    setRuntimeActionStates({});
    setRuntimeActionStatusText("Waiting for API run data");
    setActiveView("progress");

    try {
      const response = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          executionMode,
          metadata: { source: "mockup-sandbox" },
        }),
      });

      if (!response.ok) {
        setLatestAgentRun(null);
        setAgentRunState("failed");
        setAgentRunStatusText("Agent run API failed - showing local mock");
        setRuntimeActionStatusText("Runtime actions are local until API run data is available");
        return;
      }

      const data = (await response.json()) as AgentRunApiResponse;
      setLatestAgentRun({
        response: data,
        runtimeRuns: toRuntimeRunsFromAgentRun(data),
      });
      setConnectionStatus(data.connection.status);
      setAgentRunState("saved");
      setAgentRunStatusText(`Saved run ${data.pipelineRun.id.slice(0, 8)}`);
      setRuntimeActionStatusText("Runtime actions are connected to API run data");
    } catch {
      setLatestAgentRun(null);
      setAgentRunState("offline");
      setAgentRunStatusText("API offline - showing local mock");
      setRuntimeActionStatusText("Runtime actions are local until API run data is available");
      setConnectionStatus("offline");
    }
  }

  async function resumeRuntimeRun(run: RuntimeModuleRun): Promise<void> {
    if (!latestAgentRun) {
      openModules(run.moduleId);
      return;
    }

    setRuntimeActionStates((current) => ({ ...current, [run.id]: "submitting" }));
    setRuntimeActionStatusText(`Resuming ${run.moduleId}`);

    try {
      const response = await fetch(`/api/module-runs/${encodeURIComponent(run.id)}/resume`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Resume API returned ${response.status}`);
      }

      const data = (await response.json()) as ToolInteractionApiResponse;
      updateRuntimeRun(toRuntimeRunFromApiModuleRun(data.run));
      setRuntimeActionStates((current) => ({ ...current, [run.id]: "succeeded" }));
      setRuntimeActionStatusText(`Resume submitted for ${run.moduleId}`);
    } catch {
      setRuntimeActionStates((current) => ({ ...current, [run.id]: "failed" }));
      setRuntimeActionStatusText(`Resume API failed for ${run.moduleId}`);
    }
  }

  return (
    <div className="agent-os-shell">
      <aside className="side-rail" aria-label="Main navigation">
        <div className="brand-mark">
          <Sparkles size={17} />
          <span>AI</span>
        </div>
        <nav className="rail-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "rail-button active" : "rail-button"}
              onClick={() => setActiveView(item.id)}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <Bot size={17} />
            <span>Agent Module OS</span>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-mode-switch"
              onClick={() =>
                window.location.assign(
                  previewUrl("ai-os/AgentPortalInterface", "?token=portal-demo-token"),
                )
              }
            >
              <UploadCloud size={14} />
              View Portal
            </button>
            <span className="topbar-pill">
              <ShieldCheck size={14} />
              Postgres memory
            </span>
            <span className="topbar-pill live">
              <Activity size={14} />
              1 run active
            </span>
          </div>
        </header>

        <main className="view-frame">
          {activeView === "agent" && (
            <AgentView
              queuedPrompt={queuedPrompt}
              selectedModule={selectedModule}
              executionMode={executionMode}
              runtimeRuns={displayedRuntimeRuns}
              agentRunState={agentRunState}
              agentRunStatusText={agentRunStatusText}
              latestAgentRun={latestAgentRun}
              onSetExecutionMode={setExecutionMode}
              onOpenModules={openModules}
              onOpenProgress={() => setActiveView("progress")}
              onOpenData={() => setActiveView("data")}
            />
          )}
          {activeView === "modules" && (
            <ModulesView
              selectedModule={selectedModule}
              selectedModuleId={selectedModuleId}
              runtimeRuns={displayedRuntimeRuns}
              runtimeActionStates={runtimeActionStates}
              runtimeActionStatusText={runtimeActionStatusText}
              onSelectModule={setSelectedModuleId}
              onOpenData={() => setActiveView("data")}
              onResumeRuntimeRun={resumeRuntimeRun}
            />
          )}
          {activeView === "progress" && (
            <ProgressView
              queuedPrompt={queuedPrompt}
              executionMode={executionMode}
              runtimeRuns={displayedRuntimeRuns}
              agentRunState={agentRunState}
              agentRunStatusText={agentRunStatusText}
              runtimeActionStates={runtimeActionStates}
              runtimeActionStatusText={runtimeActionStatusText}
              latestAgentRun={latestAgentRun}
              onOpenConfigure={() => setActiveView("configure")}
              onOpenData={() => setActiveView("data")}
              onOpenModules={openModules}
              onResumeRuntimeRun={resumeRuntimeRun}
            />
          )}
          {activeView === "data" && (
            <DataView
              records={filteredRecords}
              selectedRecordKind={selectedRecordKind}
              onSelectRecordKind={setSelectedRecordKind}
            />
          )}
          {activeView === "configure" && (
            <ConfigureView
              config={agentConfig}
              connectionStatus={connectionStatus}
              statusText={configStatus}
              isBusy={isConfigBusy}
              onUpdateConfig={updateConfig}
              onUpdateBusinessSkill={updateBusinessSkill}
              onUpdateGeneralSkill={updateGeneralSkill}
              onUpdateMemory={updateMemorySettings}
              onUpdateSafety={updateSafetySettings}
              onSave={saveAgentConfig}
              onTestConnection={testAgentConnection}
            />
          )}
          {activeView === "publish" && (
            <PublishView
              publishSettings={publishSettings}
              publishTokenDraft={publishTokenDraft}
              publishSaveState={publishSaveState}
              publishStatusText={publishStatusText}
              onUpdateVersionLabel={updatePublishVersionLabel}
              onUpdateTokenDraft={setPublishTokenDraft}
              onSavePublishSettings={savePublishSettings}
            />
          )}
        </main>

        <Composer
          value={command}
          planMode={planMode}
          onChange={setCommand}
          onTogglePlanMode={() => setPlanMode((value) => !value)}
          onSubmit={submitCommand}
          onOpenConfigure={() => setActiveView("configure")}
          isSubmitting={agentRunState === "submitting"}
        />

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "mobile-nav-button active" : "mobile-nav-button"}
              onClick={() => setActiveView(item.id)}
              aria-label={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <style>{styles}</style>
    </div>
  );
}

function AgentView({
  queuedPrompt,
  selectedModule,
  executionMode,
  runtimeRuns,
  agentRunState,
  agentRunStatusText,
  latestAgentRun,
  onSetExecutionMode,
  onOpenModules,
  onOpenProgress,
  onOpenData,
}: {
  queuedPrompt: string | null;
  selectedModule: ModuleDefinition;
  executionMode: RuntimeExecutionMode;
  runtimeRuns: RuntimeModuleRun[];
  agentRunState: AgentRunSubmitState;
  agentRunStatusText: string;
  latestAgentRun: AgentRunUiState | null;
  onSetExecutionMode: (mode: RuntimeExecutionMode) => void;
  onOpenModules: (moduleId?: ModuleId) => void;
  onOpenProgress: () => void;
  onOpenData: () => void;
}) {
  const resumeReadyCount = runtimeRuns.filter((run) => run.status === "resumable").length;
  const approvalCount = runtimeRuns.filter((run) => run.status === "approval_required").length;
  const configNeededCount = runtimeRuns.filter((run) => run.status === "skipped").length;
  const succeededCount = runtimeRuns.filter((run) => run.status === "succeeded").length;

  return (
    <section className="agent-layout">
      <div className="chat-panel">
        <div className="panel-heading">
          <span>
            <MessageSquareText size={16} />
            Agent
          </span>
          <span className="soft-label">
            {executionMode === "execute_ready" ? "Execute ready" : "Plan only"}
          </span>
        </div>

        <div className="chat-stream">
          <ChatBubble role="user">
            Build an onboarding knowledge agent from the watched docs and keep every module result in the database.
          </ChatBubble>
          <ChatBubble role="agent">
            I will run the four-module chain and store snapshots, Markdown, chunks, and agent config records in Postgres.
          </ChatBubble>

          <RunCard
            title="Pipeline: docs to publishable agent"
            detail={`${succeededCount} succeeded / ${resumeReadyCount} resume ready / ${approvalCount} approval / ${configNeededCount} config`}
            status={executionMode === "execute_ready" ? "running" : "queued"}
            actions={
              <>
                <button type="button" className="small-action" onClick={onOpenProgress}>
                  Progress
                </button>
                <button type="button" className="small-action" onClick={onOpenData}>
                  Data
                </button>
                <button type="button" className="small-action" onClick={() => onOpenModules()}>
                  Modules
                </button>
              </>
            }
          />

          {queuedPrompt && (
            <ChatBubble role="user">
              {queuedPrompt}
            </ChatBubble>
          )}

          {latestAgentRun && (
            <ChatBubble role="agent">
              {latestAgentRun.response.agentMessage.content}
            </ChatBubble>
          )}
        </div>

        <RuntimeControl
          executionMode={executionMode}
          resumeReadyCount={resumeReadyCount}
          approvalCount={approvalCount}
          configNeededCount={configNeededCount}
          agentRunState={agentRunState}
          agentRunStatusText={agentRunStatusText}
          onSetExecutionMode={onSetExecutionMode}
        />
      </div>

      <div className="workspace-panel">
        <div className="panel-heading">
          <span>
            <Layers3 size={16} />
            Live workspace
          </span>
          <span className="soft-label">API ingest v1</span>
        </div>
        <div className="workspace-preview">
          <div className="preview-bar">
            <span />
            <span />
            <span />
            <strong>module memory</strong>
          </div>
          <div className="memory-map">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={module.id === selectedModule.id ? "memory-node active" : "memory-node"}
              >
                <i style={{ background: module.color }} />
                <strong>{module.name}</strong>
                <span>{module.result}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="agent-summary-grid">
          <Metric label="Runs" value="4" />
          <Metric label="Records" value="150" />
          <Metric label="Artifacts" value="12" />
        </div>
      </div>
    </section>
  );
}

function RuntimeControl({
  executionMode,
  resumeReadyCount,
  approvalCount,
  configNeededCount,
  agentRunState,
  agentRunStatusText,
  onSetExecutionMode,
}: {
  executionMode: RuntimeExecutionMode;
  resumeReadyCount: number;
  approvalCount: number;
  configNeededCount: number;
  agentRunState: AgentRunSubmitState;
  agentRunStatusText: string;
  onSetExecutionMode: (mode: RuntimeExecutionMode) => void;
}) {
  return (
    <div className="runtime-control">
      <div className="panel-heading">
        <span>
          <Activity size={16} />
          Runtime
        </span>
        <span className={`agent-run-state ${agentRunState}`}>
          {agentRunStateLabel(agentRunState)}
        </span>
      </div>
      <p className="agent-run-status-text">{agentRunStatusText}</p>
      <div className="runtime-mode-group" aria-label="Runtime execution mode">
        <button
          type="button"
          className={
            executionMode === "plan_only"
              ? "runtime-mode-button active"
              : "runtime-mode-button"
          }
          onClick={() => onSetExecutionMode("plan_only")}
        >
          Plan only
        </button>
        <button
          type="button"
          className={
            executionMode === "execute_ready"
              ? "runtime-mode-button active"
              : "runtime-mode-button"
          }
          onClick={() => onSetExecutionMode("execute_ready")}
        >
          Execute ready
        </button>
      </div>
      <div className="runtime-status-grid">
        <Metric label="Resume ready" value={String(resumeReadyCount)} />
        <Metric label="Approval" value={String(approvalCount)} />
        <Metric label="Config needed" value={String(configNeededCount)} />
      </div>
    </div>
  );
}

function ModulesView({
  selectedModule,
  selectedModuleId,
  runtimeRuns,
  runtimeActionStates,
  runtimeActionStatusText,
  onSelectModule,
  onOpenData,
  onResumeRuntimeRun,
}: {
  selectedModule: ModuleDefinition;
  selectedModuleId: ModuleId;
  runtimeRuns: RuntimeModuleRun[];
  runtimeActionStates: Record<string, RuntimeActionState>;
  runtimeActionStatusText: string;
  onSelectModule: (moduleId: ModuleId) => void;
  onOpenData: () => void;
  onResumeRuntimeRun: (run: RuntimeModuleRun) => void | Promise<void>;
}) {
  const selectedRuntimeRun = runtimeRuns.find((run) => run.moduleId === selectedModule.id);
  const selectedActionState = selectedRuntimeRun
    ? runtimeActionStates[selectedRuntimeRun.id] ?? "idle"
    : "idle";
  const supportsResume = selectedModule.id !== "md_to_rag";

  return (
    <section className="module-layout">
      <div className="module-list">
        <div className="panel-heading">
          <span>
            <Boxes size={16} />
            Modules
          </span>
          <span className="soft-label">4 registered</span>
        </div>
        {modules.map((module) => (
          <button
            key={module.id}
            type="button"
            className={module.id === selectedModuleId ? "module-row active" : "module-row"}
            onClick={() => onSelectModule(module.id)}
          >
            <i style={{ background: module.color }} />
            <span>
              <strong>{module.name}</strong>
              <em>{module.description}</em>
            </span>
            <b>{statusLabel(module.status)}</b>
          </button>
        ))}
      </div>

      <div className="module-detail">
        <div className="module-detail-header">
          <div>
            <h1>{selectedModule.name}</h1>
            <p>{selectedModule.description}</p>
          </div>
          <span className={statusClass(selectedModule.status)}>{statusLabel(selectedModule.status)}</span>
        </div>

        <div className="detail-grid">
          <Metric label="Stored records" value={String(selectedModule.records)} />
          <Metric label="Latest result" value={selectedModule.result} />
          <Metric label="Integration" value="API ingest" />
        </div>

        {selectedRuntimeRun && (
          <div className="runtime-panel">
            <div className="panel-heading">
              <span>
                <Activity size={16} />
                Runtime contract
              </span>
              <span className={runtimeStatusClass(selectedRuntimeRun.status)}>
                {runtimeStatusLabel(selectedRuntimeRun.status)}
              </span>
            </div>
            <div className="runtime-meta-grid">
              <Metric label="Adapter" value={selectedRuntimeRun.adapterId} />
              <Metric label="Kind" value={selectedRuntimeRun.adapterKind.toUpperCase()} />
              <Metric label="External run" value={selectedRuntimeRun.externalRunId} />
              <Metric
                label="Required env"
                value={
                  selectedRuntimeRun.missingRequiredEnv.length > 0
                    ? selectedRuntimeRun.missingRequiredEnv.join(", ")
                    : "Ready"
                }
              />
              <Metric label="Resume" value={supportsResume ? "Yes" : "No"} />
              <Metric label="Updated" value={selectedRuntimeRun.updatedAt} />
            </div>
            {selectedRuntimeRun.interaction && (
              <div className="runtime-interaction">
                <strong>{selectedRuntimeRun.interaction.title}</strong>
                <p>{selectedRuntimeRun.interaction.message}</p>
                <em>{selectedRuntimeRun.interaction.resumeHandle}</em>
              </div>
            )}
            <div className="runtime-action-row">
              <div className="runtime-chip-row">
                {selectedRuntimeRun.resultRecordIds.map((recordId) => (
                  <span key={recordId}>{recordId}</span>
                ))}
              </div>
              <div className="runtime-action-row">
                {selectedRuntimeRun.status === "resumable" && (
                  <button
                    type="button"
                    className="small-action"
                    disabled={selectedActionState === "submitting"}
                    onClick={() => void onResumeRuntimeRun(selectedRuntimeRun)}
                  >
                    {selectedActionState === "submitting" ? "Resuming" : "Resume now"}
                  </button>
                )}
                <button type="button" className="small-action" onClick={onOpenData}>
                  Open data
                </button>
              </div>
            </div>
            {(selectedActionState === "succeeded" || selectedActionState === "failed") && (
              <p className="runtime-action-feedback">{runtimeActionStatusText}</p>
            )}
          </div>
        )}

        <div className="result-panel">
          <div className="panel-heading">
            <span>
              <FileText size={16} />
              Result UI
            </span>
            <button type="button" className="small-action" onClick={onOpenData}>
              Open data
            </button>
          </div>
          <div className="result-lines">
            {dataRecords
              .filter((record) => record.moduleId === selectedModule.id)
              .map((record) => (
                <div key={record.id} className="result-line">
                  <strong>{record.title}</strong>
                  <span>{record.summary}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressView({
  queuedPrompt,
  executionMode,
  runtimeRuns,
  agentRunState,
  agentRunStatusText,
  runtimeActionStates,
  runtimeActionStatusText,
  latestAgentRun,
  onOpenConfigure,
  onOpenData,
  onOpenModules,
  onResumeRuntimeRun,
}: {
  queuedPrompt: string | null;
  executionMode: RuntimeExecutionMode;
  runtimeRuns: RuntimeModuleRun[];
  agentRunState: AgentRunSubmitState;
  agentRunStatusText: string;
  runtimeActionStates: Record<string, RuntimeActionState>;
  runtimeActionStatusText: string;
  latestAgentRun: AgentRunUiState | null;
  onOpenConfigure: () => void;
  onOpenData: () => void;
  onOpenModules: (moduleId?: ModuleId) => void;
  onResumeRuntimeRun: (run: RuntimeModuleRun) => void | Promise<void>;
}) {
  function runtimeAction(run: RuntimeModuleRun): ReactNode {
    const actionState = runtimeActionStates[run.id] ?? "idle";

    if (run.status === "resumable") {
      return (
        <button
          type="button"
          className="small-action"
          disabled={actionState === "submitting"}
          onClick={() => void onResumeRuntimeRun(run)}
        >
          {actionState === "submitting" ? "Resuming" : "Resume"}
        </button>
      );
    }
    if (
      run.status === "waiting_for_user" ||
      run.status === "waiting_for_data" ||
      run.status === "approval_required" ||
      run.status === "blocked"
    ) {
      return (
        <button type="button" className="small-action" onClick={() => onOpenModules(run.moduleId)}>
          Review
        </button>
      );
    }
    if (run.status === "skipped") {
      return (
        <button type="button" className="small-action" onClick={onOpenConfigure}>
          Configure
        </button>
      );
    }
    if (run.status === "succeeded") {
      return (
        <button type="button" className="small-action" onClick={onOpenData}>
          View data
        </button>
      );
    }
    return (
      <button type="button" className="small-action" onClick={() => onOpenModules(run.moduleId)}>
        View run
      </button>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Pipeline progress</h1>
          <p>Every module run posts events and artifacts back into the shared database memory.</p>
        </div>
        <div className="runtime-action-row">
          <span className="connection-pill">
            <Activity size={14} />
            {executionMode === "execute_ready" ? "Execute ready" : "Plan only"}
          </span>
          <span className={`agent-run-state ${agentRunState}`}>
            {agentRunStateLabel(agentRunState)}
          </span>
          <button type="button" className="primary-action" onClick={onOpenData}>
            <Database size={15} />
            Open memory
          </button>
        </div>
      </div>

      {queuedPrompt && (
        <div className="queued-card">
          <Clock3 size={16} />
          <span>
            <strong>Queued instruction</strong>
            <em>{queuedPrompt}</em>
          </span>
        </div>
      )}

      {latestAgentRun ? (
        <div className="api-plan-panel">
          <div className="api-plan-meta">
            <strong>Pipeline {latestAgentRun.response.pipelineRun.id.slice(0, 8)}</strong>
            <span>{latestAgentRun.response.plan.steps.length} plan steps</span>
            <span>{latestAgentRun.response.status.replace("_", " ")}</span>
            <span>{agentRunStatusText}</span>
          </div>
          <p>{latestAgentRun.response.plan.summary}</p>
          {latestAgentRun.response.plan.warnings.length > 0 && (
            <div className="warning-chip-row" aria-label="Agent plan warnings">
              {latestAgentRun.response.plan.warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="agent-run-status-text">{agentRunStatusText}</p>
      )}
      <p className="agent-run-status-text">{runtimeActionStatusText}</p>

      <div className="timeline">
        {runtimeRuns.map((run) => (
          <article key={run.id} className="timeline-card runtime-timeline-card">
            <span className={runtimeStatusClass(run.status)}>
              {runtimeStatusLabel(run.status)}
            </span>
            <div>
              <h2>{run.title}</h2>
              <p>{run.event}</p>
              <small>
                {run.updatedAt} / {run.moduleId} / {run.adapterId}
              </small>
              <div className="runtime-action-row">
                <span>{run.resultRecordIds.length} result record</span>
                {runtimeAction(run)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DataView({
  records,
  selectedRecordKind,
  onSelectRecordKind,
}: {
  records: DataRecord[];
  selectedRecordKind: string;
  onSelectRecordKind: (kind: string) => void;
}) {
  const kinds = ["all", ...Array.from(new Set(dataRecords.map((record) => record.kind)))];

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Database memory</h1>
          <p>Canonical display data from each module is queryable from one Postgres-backed surface.</p>
        </div>
        <div className="search-box">
          <Search size={14} />
          <span>Search records</span>
        </div>
      </div>

      <div className="filter-row">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={selectedRecordKind === kind ? "filter-chip active" : "filter-chip"}
            onClick={() => onSelectRecordKind(kind)}
          >
            {kind}
          </button>
        ))}
      </div>

      <div className="data-table">
        {records.map((record) => (
          <div key={record.id} className="data-row">
            <span>
              <strong>{record.title}</strong>
              <em>{record.kind} / {record.moduleId}</em>
            </span>
            <p>{record.summary}</p>
            <b>{record.updatedAt}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfigureView({
  config,
  connectionStatus,
  statusText,
  isBusy,
  onUpdateConfig,
  onUpdateBusinessSkill,
  onUpdateGeneralSkill,
  onUpdateMemory,
  onUpdateSafety,
  onSave,
  onTestConnection,
}: {
  config: AgentConfigDraft;
  connectionStatus: AgentConnectionStatus;
  statusText: string;
  isBusy: boolean;
  onUpdateConfig: (patch: Partial<AgentConfigDraft>) => void;
  onUpdateBusinessSkill: (
    moduleId: ModuleId,
    patch: Partial<BusinessSkillSetting>,
  ) => void;
  onUpdateGeneralSkill: (
    skillId: GeneralSkillId,
    patch: Partial<GeneralSkillSetting>,
  ) => void;
  onUpdateMemory: (patch: Partial<AgentMemorySettings>) => void;
  onUpdateSafety: (patch: Partial<AgentSafetySettings>) => void;
  onSave: () => void;
  onTestConnection: () => void;
}) {
  const enabledBusinessSkills = config.businessSkillSettings.filter(
    (skill) => skill.enabled,
  ).length;
  const enabledGeneralSkills = config.generalSkillSettings.filter(
    (skill) => skill.enabled || skill.installOnDemand,
  ).length;
  const memoryMode =
    config.memorySettings.shortTermEnabled && config.memorySettings.longTermEnabled
      ? "short + long"
      : config.memorySettings.longTermEnabled
        ? "long only"
        : "short only";

  return (
    <section className="configure-layout">
      <div className="configure-hero">
        <div>
          <h1>Configure Agent</h1>
          <p>Connect the AI runtime, choose model behavior, decide which skills the Agent may use, and see exactly what each capability produces.</p>
        </div>
        <div className={`connection-pill ${connectionStatus}`}>
          <Activity size={15} />
          <span>{connectionLabel(connectionStatus)}</span>
        </div>
      </div>

      <div className="capability-map" aria-label="Capability map">
        <span>
          <strong>Agent</strong>
          <em>Chat, plan, choose tools, and explain progress.</em>
        </span>
        <span>
          <strong>Business skills</strong>
          <em>Run your fixed module chain and store canonical outputs.</em>
        </span>
        <span>
          <strong>General skills</strong>
          <em>Install or enable common abilities when a conversation needs them.</em>
        </span>
        <span>
          <strong>Memory</strong>
          <em>Persist useful context into Postgres for later runs.</em>
        </span>
      </div>

      <div className="configure-grid">
        <article className="config-card">
          <div className="config-card-heading">
            <span>
              <Globe2 size={16} />
              Provider
            </span>
            <em>{statusText}</em>
          </div>
          <p className="config-explainer">{configureGuides.provider}</p>
          <div className="config-field">
            <span className="config-field-label" id="agent-provider-label">
              Provider
            </span>
            <div className="locked-value" aria-labelledby="agent-provider-label">OpenAI</div>
          </div>
          <div className="config-field">
            <span className="config-field-label" id="agent-endpoint-label">
              Endpoint
            </span>
            <div
              className="segmented-control"
              role="group"
              aria-labelledby="agent-endpoint-label"
            >
              {(["responses", "agents_sdk"] as AgentEndpoint[]).map((endpoint) => (
                <button
                  key={endpoint}
                  type="button"
                  className={config.endpoint === endpoint ? "segmented-button active" : "segmented-button"}
                  onClick={() => onUpdateConfig({ endpoint })}
                >
                  {endpoint === "responses" ? "Responses" : "Agents SDK"}
                </button>
              ))}
            </div>
          </div>
          <div className="config-actions">
            <button type="button" className="small-action" disabled={isBusy} onClick={onTestConnection}>
              Test
            </button>
            <button type="button" className="primary-action" disabled={isBusy} onClick={onSave}>
              Save
            </button>
          </div>
        </article>

        <article className="config-card">
          <div className="config-card-heading">
            <span>
              <Bot size={16} />
              Model
            </span>
            <em>{config.reasoningEffort} reasoning</em>
          </div>
          <p className="config-explainer">{configureGuides.model}</p>
          <div className="config-field">
            <label htmlFor="agent-model-select">Model</label>
            <select
              id="agent-model-select"
              value={config.modelId}
              onChange={(event) => onUpdateConfig({ modelId: event.target.value })}
            >
              <option value="gpt-5.5">gpt-5.5</option>
              <option value="gpt-5.4">gpt-5.4</option>
              <option value="gpt-5.4-mini">gpt-5.4-mini</option>
              <option value="gpt-5.2">gpt-5.2</option>
            </select>
          </div>
          <div className="config-field">
            <span className="config-field-label" id="agent-reasoning-label">
              Reasoning
            </span>
            <div
              className="segmented-control"
              role="group"
              aria-labelledby="agent-reasoning-label"
            >
              {(["low", "medium", "high", "xhigh"] as AgentReasoningEffort[]).map((effort) => (
                <button
                  key={effort}
                  type="button"
                  className={config.reasoningEffort === effort ? "segmented-button active" : "segmented-button"}
                  onClick={() => onUpdateConfig({ reasoningEffort: effort })}
                >
                  {effort}
                </button>
              ))}
            </div>
          </div>
          <div className="config-field">
            <label htmlFor="agent-system-prompt">System prompt</label>
            <textarea
              id="agent-system-prompt"
              value={config.systemPrompt}
              onChange={(event) => onUpdateConfig({ systemPrompt: event.target.value })}
              rows={4}
            />
          </div>
        </article>

        <article className="config-card config-card-wide">
          <div className="config-card-heading">
            <span>
              <Layers3 size={16} />
              Business Skills
            </span>
            <em>{enabledBusinessSkills} enabled</em>
          </div>
          <p className="config-explainer">
            These are your product modules. The Agent calls them to build the pipeline, and each module writes displayable results back into the database.
          </p>
          <SwitchLegend items={businessSwitchGuides} title="Switch guide" />
          <div className="skill-settings-grid">
            {config.businessSkillSettings.map((skill) => {
              const module = moduleById(skill.moduleId);
              const guide = moduleGuides[skill.moduleId];
              return (
                <div key={skill.moduleId} className="skill-setting-row">
                  <i style={{ background: module.color }} />
                  <span>
                    <strong>{module.name}</strong>
                    <em>{module.result}</em>
                  </span>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(event) =>
                        onUpdateBusinessSkill(skill.moduleId, { enabled: event.target.checked })
                      }
                    />
                    Enabled
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.approvalRequired}
                      onChange={(event) =>
                        onUpdateBusinessSkill(skill.moduleId, { approvalRequired: event.target.checked })
                      }
                    />
                    Approval
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.canUseNetwork}
                      onChange={(event) =>
                        onUpdateBusinessSkill(skill.moduleId, { canUseNetwork: event.target.checked })
                      }
                    />
                    Network
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.canWriteDatabase}
                      onChange={(event) =>
                        onUpdateBusinessSkill(skill.moduleId, { canWriteDatabase: event.target.checked })
                      }
                    />
                    DB write
                  </label>
                  <GuideDisclosure guide={guide} label={`${module.name} details`} />
                </div>
              );
            })}
          </div>
        </article>

        <article className="config-card config-card-wide">
          <div className="config-card-heading">
            <span>
              <WandSparkles size={16} />
              General Skills
            </span>
            <em>{enabledGeneralSkills} allowed</em>
          </div>
          <p className="config-explainer">
            These are common Agent abilities. Keep them available on demand so the Agent can ask to install or use one during a conversation, with approval before sensitive actions.
          </p>
          <SwitchLegend items={generalSwitchGuides} title="Switch guide" />
          <div className="skill-settings-grid">
            {config.generalSkillSettings.map((skill) => {
              const guide = generalSkillGuides[skill.skillId];
              return (
                <div key={skill.skillId} className="general-skill-row">
                  <span>
                    <strong>{skill.name}</strong>
                    <em>{skill.description}</em>
                  </span>
                  <b className={skill.installed ? "skill-state installed" : "skill-state"}>
                    {skill.installed ? "Installed" : "Available"}
                  </b>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(event) =>
                        onUpdateGeneralSkill(skill.skillId, { enabled: event.target.checked })
                      }
                    />
                    Enabled
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.installOnDemand}
                      onChange={(event) =>
                        onUpdateGeneralSkill(skill.skillId, {
                          installOnDemand: event.target.checked,
                        })
                      }
                    />
                    On demand
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.requiresApproval}
                      onChange={(event) =>
                        onUpdateGeneralSkill(skill.skillId, {
                          requiresApproval: event.target.checked,
                        })
                      }
                    />
                    Approval
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.canUseNetwork}
                      onChange={(event) =>
                        onUpdateGeneralSkill(skill.skillId, {
                          canUseNetwork: event.target.checked,
                        })
                      }
                    />
                    Network
                  </label>
                  <GuideDisclosure guide={guide} label={`${skill.name} details`} />
                </div>
              );
            })}
          </div>
        </article>

        <article className="config-card">
          <div className="config-card-heading">
            <span>
              <Database size={16} />
              Memory
            </span>
            <em>{memoryMode}</em>
          </div>
          <p className="config-explainer">{configureGuides.memory}</p>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.memorySettings.shortTermEnabled}
              onChange={(event) => onUpdateMemory({ shortTermEnabled: event.target.checked })}
            />
            Short-term thread memory
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.memorySettings.longTermEnabled}
              onChange={(event) => onUpdateMemory({ longTermEnabled: event.target.checked })}
            />
            Long-term Postgres memory
          </label>
          <div className="config-field">
            <label htmlFor="agent-memory-promotion">Promotion</label>
            <select
              id="agent-memory-promotion"
              value={config.memorySettings.promotionMode}
              onChange={(event) =>
                onUpdateMemory({ promotionMode: event.target.value as MemoryPromotionMode })
              }
            >
              <option value="agent_suggested">agent_suggested</option>
              <option value="manual">manual</option>
            </select>
          </div>
          <div className="config-two-column">
            <div className="config-field">
              <label htmlFor="agent-memory-collection">Collection</label>
              <input
                id="agent-memory-collection"
                value={config.memorySettings.ragCollection}
                onChange={(event) => onUpdateMemory({ ragCollection: event.target.value })}
              />
            </div>
            <div className="config-field">
              <label htmlFor="agent-memory-retention-days">Retention days</label>
              <input
                id="agent-memory-retention-days"
                type="number"
                min={1}
                max={3650}
                value={config.memorySettings.retentionDays}
                onChange={(event) =>
                  onUpdateMemory({ retentionDays: Number(event.target.value) || 1 })
                }
              />
            </div>
          </div>
        </article>

        <article className="config-card">
          <div className="config-card-heading">
            <span>
              <ShieldCheck size={16} />
              Safety
            </span>
            <em>{config.safetySettings.maxToolSteps} tool steps</em>
          </div>
          <p className="config-explainer">{configureGuides.safety}</p>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.safetySettings.requireApprovalForExternalActions}
              onChange={(event) =>
                onUpdateSafety({ requireApprovalForExternalActions: event.target.checked })
              }
            />
            Approve external actions
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.safetySettings.requireApprovalForPublishing}
              onChange={(event) =>
                onUpdateSafety({ requireApprovalForPublishing: event.target.checked })
              }
            />
            Approve publishing
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.safetySettings.allowSelfLearning}
              onChange={(event) => onUpdateSafety({ allowSelfLearning: event.target.checked })}
            />
            Allow self-learning
          </label>
          <div className="config-field">
            <label htmlFor="agent-max-tool-steps">Max tool steps</label>
            <input
              id="agent-max-tool-steps"
              type="number"
              min={1}
              max={64}
              value={config.safetySettings.maxToolSteps}
              onChange={(event) =>
                onUpdateSafety({ maxToolSteps: Number(event.target.value) || 1 })
              }
            />
          </div>
        </article>

        <article className="config-card runtime-card">
          <div className="config-card-heading">
            <span>
              <Sparkles size={16} />
              Runtime Preview
            </span>
            <em>{config.endpoint}</em>
          </div>
          <p className="config-explainer">{configureGuides.runtime}</p>
          <div className="runtime-lines">
            <span>
              <strong>Provider</strong>
              <em>{config.provider} / {config.modelId}</em>
            </span>
            <span>
              <strong>Skills</strong>
              <em>{enabledBusinessSkills} business / {enabledGeneralSkills} general</em>
            </span>
            <span>
              <strong>Memory</strong>
              <em>{memoryMode} into {config.memorySettings.ragCollection}</em>
            </span>
            <span>
              <strong>Safety</strong>
              <em>{config.safetySettings.allowSelfLearning ? "self-learning allowed" : "self-learning paused"}</em>
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}

function SwitchLegend({
  items,
  title,
}: {
  items: Array<{ label: string; detail: string }>;
  title: string;
}) {
  return (
    <details className="switch-legend">
      <summary>{title}</summary>
      <div>
        {items.map((item) => (
          <span key={item.label}>
            <strong>{item.label}</strong>
            <em>{item.detail}</em>
          </span>
        ))}
      </div>
    </details>
  );
}

function GuideDisclosure({
  guide,
  label,
}: {
  guide: CapabilityGuide;
  label: string;
}) {
  return (
    <details className="skill-help">
      <summary aria-label={label} title={label}>?</summary>
      <div className="skill-help-panel">
        <SkillDetailGrid guide={guide} />
      </div>
    </details>
  );
}

function SkillDetailGrid({ guide }: { guide: CapabilityGuide }) {
  return (
    <div className="skill-detail-grid">
      <span>
        <strong>Purpose</strong>
        <em>{guide.summary}</em>
      </span>
      <span>
        <strong>When used</strong>
        <em>{guide.trigger}</em>
      </span>
      <span>
        <strong>Agent action</strong>
        <em>{guide.action}</em>
      </span>
      <span>
        <strong>Result</strong>
        <em>{guide.output}</em>
      </span>
      <span>
        <strong>Boundary</strong>
        <em>{guide.boundary}</em>
      </span>
    </div>
  );
}

const portalVisibleViews = [
  ["Chat", "Ask the published Agent to run or continue work."],
  ["Steps", "See which module is running, blocked, or complete."],
  ["Data", "Inspect generated records and artifacts."],
  ["Sources", "Trace evidence back to source material."],
  ["Result", "Review final handoff, agent config, and readiness."],
];

function publishStatusLabel(status: PublishStatus): string {
  if (status === "published") return "Published";
  if (status === "paused") return "Paused";
  return "Draft";
}

function publishSaveStateLabel(state: PublishSaveState): string {
  if (state === "saving") return "Saving";
  if (state === "saved") return "API saved";
  if (state === "offline") return "API offline";
  if (state === "failed") return "Save failed";
  return "Local";
}

function PublishView({
  publishSettings,
  publishTokenDraft,
  publishSaveState,
  publishStatusText,
  onUpdateVersionLabel,
  onUpdateTokenDraft,
  onSavePublishSettings,
}: {
  publishSettings: PublishSettingsApi;
  publishTokenDraft: string;
  publishSaveState: PublishSaveState;
  publishStatusText: string;
  onUpdateVersionLabel: (versionLabel: string) => void;
  onUpdateTokenDraft: (token: string) => void;
  onSavePublishSettings: (status: PublishStatus) => void | Promise<void>;
}) {
  const isSaving = publishSaveState === "saving";

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Publish agent</h1>
          <p>The final agent becomes available after the RAG index and validation records are stored.</p>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={() =>
            window.location.assign(previewUrl("ai-os/AgentPortalInterface", "?token=portal-demo-token"))
          }
        >
          <UploadCloud size={15} />
          Open Portal preview
        </button>
      </div>

      <section className="publish-settings-panel" aria-label="Publish settings">
        <div className="publish-settings-header">
          <div>
            <span className={`publish-status-badge ${publishSettings.status}`}>
              {publishStatusLabel(publishSettings.status)}
            </span>
            <span className="publish-save-badge">
              {publishSaveStateLabel(publishSaveState)}
            </span>
          </div>
          <p>{publishStatusText}</p>
        </div>

        <div className="publish-form-grid">
          <label className="publish-field" htmlFor="publish-version-label">
            <span>Version label</span>
            <input
              id="publish-version-label"
              value={publishSettings.versionLabel}
              onChange={(event) => onUpdateVersionLabel(event.target.value)}
            />
          </label>
          <label className="publish-field" htmlFor="publish-portal-token">
            <span>Portal token</span>
            <input
              id="publish-portal-token"
              type="password"
              autoComplete="off"
              placeholder="Enter a new portal token"
              value={publishTokenDraft}
              onChange={(event) => onUpdateTokenDraft(event.target.value)}
            />
          </label>
          <div className="publish-token-meta">
            <strong>
              {publishSettings.portalTokenLast4
                ? `Token ending ****${publishSettings.portalTokenLast4}`
                : "No saved token yet"}
            </strong>
            <em>
              {publishSettings.portalTokenUpdatedAt
                ? `Updated ${new Date(publishSettings.portalTokenUpdatedAt).toLocaleString()}`
                : "Plaintext tokens are never returned by the API."}
            </em>
          </div>
        </div>

        <div className="publish-actions">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onSavePublishSettings("draft")}
          >
            Save draft
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={isSaving}
            onClick={() => void onSavePublishSettings("published")}
          >
            <UploadCloud size={15} />
            Publish
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onSavePublishSettings("paused")}
          >
            Pause
          </button>
        </div>
      </section>

      <div className="publish-grid">
        <PublishStep label="RAG index" value="96 / 124 chunks" status="running" />
        <PublishStep label="Agent config" value={publishSettings.versionLabel} status="waiting" />
        <PublishStep label="Validation" value="Queued" status="queued" />
        <PublishStep
          label="Endpoint"
          value={publishStatusLabel(publishSettings.status)}
          status={publishSettings.status === "published" ? "succeeded" : "waiting"}
        />
      </div>

      <div className="publish-access-grid">
        <section className="publish-access-card">
          <span className="publish-card-kicker">Portal access</span>
          <h2>Token unlocks the frontstage workspace</h2>
          <p>
            Published users enter with a portal token, then work inside Chat, Steps, Data, Sources, and
            Result.
          </p>
          <div className="publish-token-row">
            <code>portal-demo-token</code>
            <button
              type="button"
              onClick={() =>
                window.location.assign(previewUrl("ai-os/AgentPortalInterface", "?token=portal-demo-token"))
              }
            >
              View as user
            </button>
          </div>
          <em>Demo token only. Production token validation belongs on the server.</em>
        </section>

        <section className="publish-access-card">
          <span className="publish-card-kicker">Frontstage visible</span>
          <h2>Users keep progress and data visibility</h2>
          <div className="publish-portal-view-list">
            {portalVisibleViews.map(([label, detail]) => (
              <span key={label}>
                <strong>{label}</strong>
                <em>{detail}</em>
              </span>
            ))}
          </div>
        </section>

        <section className="publish-access-card">
          <span className="publish-card-kicker">Admin-only</span>
          <h2>Configure stays backstage</h2>
          <p>
            Provider, model, business skills, general skills, memory, safety, and publish gates remain admin
            controls.
          </p>
          <div className="publish-admin-boundary">
            <span>
              <ShieldCheck size={14} /> Configure runtime
            </span>
            <span>
              <Database size={14} /> Manage memory writes
            </span>
            <span>
              <Settings2 size={14} /> Control skill permissions
            </span>
          </div>
        </section>
      </div>
    </section>
  );
}

function Composer({
  value,
  planMode,
  onChange,
  onTogglePlanMode,
  onSubmit,
  onOpenConfigure,
  isSubmitting,
}: {
  value: string;
  planMode: boolean;
  onChange: (value: string) => void;
  onTogglePlanMode: () => void;
  onSubmit: () => void | Promise<void>;
  onOpenConfigure: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="composer-shell">
      <div className="composer">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            const nativeEvent = event.nativeEvent as KeyboardEvent & {
              isComposing?: boolean;
            };
            if (
              !isSubmitting &&
              event.key === "Enter" &&
              !event.shiftKey &&
              !nativeEvent.isComposing
            ) {
              event.preventDefault();
              void onSubmit();
            }
          }}
          placeholder="Ask Agent to run modules, store data, or inspect results..."
          rows={2}
          disabled={isSubmitting}
        />
        <div className="composer-actions">
          <button type="button" className="icon-action" aria-label="Attach file">
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            className={planMode ? "mode-action active" : "mode-action"}
            onClick={onTogglePlanMode}
          >
            <WandSparkles size={15} />
            Plan
          </button>
          <button
            type="button"
            className="icon-action"
            aria-label="Agent settings"
            onClick={onOpenConfigure}
          >
            <Settings2 size={16} />
          </button>
          <button
            type="button"
            className="send-action"
            aria-label="Send"
            disabled={isSubmitting || !value.trim()}
            onClick={() => void onSubmit()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, children }: { role: "user" | "agent"; children: ReactNode }) {
  return (
    <div className={role === "user" ? "chat-bubble user" : "chat-bubble agent"}>
      <span>{role === "user" ? "You" : "Agent"}</span>
      <p>{children}</p>
    </div>
  );
}

function RunCard({
  title,
  detail,
  status,
  actions,
}: {
  title: string;
  detail: string;
  status: RunStatus;
  actions: ReactNode;
}) {
  return (
    <div className="run-card">
      <span className={statusClass(status)}>{statusLabel(status)}</span>
      <h2>{title}</h2>
      <p>{detail}</p>
      <div className="run-actions">{actions}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PublishStep({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: RunStatus;
}) {
  const icon =
    status === "succeeded" ? (
      <CheckCircle2 size={16} />
    ) : status === "running" ? (
      <Activity size={16} />
    ) : (
      <CircleAlert size={16} />
    );

  return (
    <div className="publish-step">
      <span>{icon}</span>
      <strong>{label}</strong>
      <em>{value}</em>
    </div>
  );
}

const styles = `
  html,
  body,
  #root {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: #080b0f;
  }

  .agent-os-shell {
    position: fixed;
    inset: 0;
    display: flex;
    min-width: 0;
    background: #080b0f;
    color: #edf3fb;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .side-rail {
    width: 92px;
    border-right: 1px solid #1e2936;
    background: #0d1219;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 10px;
    gap: 18px;
    flex-shrink: 0;
  }

  .brand-mark {
    width: 48px;
    height: 40px;
    border: 1px solid #273446;
    border-radius: 8px;
    display: grid;
    place-items: center;
    gap: 2px;
    color: #f97316;
    font-weight: 900;
    font-size: 11px;
  }

  .rail-nav {
    display: grid;
    gap: 8px;
    width: 100%;
  }

  .rail-button,
  .mobile-nav-button,
  .icon-action,
  .mode-action,
  .send-action,
  .small-action,
  .primary-action,
  .module-row,
  .memory-node,
  .filter-chip,
  .segmented-button {
    font-family: inherit;
    cursor: pointer;
  }

  .rail-button {
    height: 60px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #8290a3;
    display: grid;
    place-items: center;
    gap: 4px;
    font-size: 10px;
  }

  .rail-button.active {
    border-color: #334258;
    background: #172130;
    color: #edf3fb;
  }

  .main-shell {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .topbar {
    height: 48px;
    border-bottom: 1px solid #1e2936;
    background: #0d1219;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px;
    flex-shrink: 0;
  }

  .topbar-title,
  .topbar-actions,
  .topbar-pill,
  .topbar-mode-switch,
  .panel-heading,
  .panel-heading span,
  .primary-action,
  .small-action,
  .queued-card,
  .publish-step {
    display: flex;
    align-items: center;
  }

  .topbar-title {
    gap: 8px;
    font-size: 13px;
    font-weight: 850;
  }

  .topbar-actions {
    gap: 8px;
  }

  .topbar-pill {
    height: 30px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #151d28;
    color: #9aa7b8;
    gap: 7px;
    padding: 0 10px;
    font-size: 12px;
  }

  .topbar-pill.live {
    color: #35d07f;
    border-color: #35d07f55;
    background: #0e2419;
  }

  .topbar-mode-switch {
    height: 30px;
    border: 1px solid #31506f;
    border-radius: 7px;
    background: #10233a;
    color: #d8e8ff;
    cursor: pointer;
    gap: 7px;
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .view-frame {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  .agent-layout,
  .module-layout {
    height: 100%;
    min-height: 0;
    display: grid;
    gap: 14px;
  }

  .agent-layout {
    grid-template-columns: minmax(320px, 0.92fr) minmax(360px, 1.08fr);
  }

  .module-layout {
    grid-template-columns: 390px minmax(0, 1fr);
  }

  .chat-panel,
  .workspace-panel,
  .module-list,
  .module-detail,
  .page-panel {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0f151e;
    min-width: 0;
    min-height: 0;
  }

  .chat-panel,
  .workspace-panel,
  .module-list,
  .module-detail,
  .page-panel {
    display: flex;
    flex-direction: column;
  }

  .panel-heading {
    min-height: 46px;
    padding: 0 14px;
    border-bottom: 1px solid #202c3b;
    justify-content: space-between;
    gap: 12px;
    color: #edf3fb;
    font-size: 13px;
    font-weight: 850;
    flex-shrink: 0;
  }

  .panel-heading span {
    gap: 8px;
  }

  .soft-label {
    color: #738195;
    font-size: 11px;
    font-weight: 650;
  }

  .agent-run-state {
    min-height: 26px;
    border: 1px solid #344456;
    border-radius: 999px;
    background: #151d28;
    color: #aeb8c6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 850;
    white-space: nowrap;
  }

  .agent-run-state.local {
    color: #9aa7b8;
  }

  .agent-run-state.submitting {
    color: #4f9cff;
    border-color: #4f9cff66;
    background: #10213a;
  }

  .agent-run-state.saved {
    color: #35d07f;
    border-color: #35d07f66;
    background: #0e2419;
  }

  .agent-run-state.offline {
    color: #f2c94c;
    border-color: #f2c94c55;
    background: #211d0d;
  }

  .agent-run-state.failed {
    color: #ff7a7a;
    border-color: #ff7a7a66;
    background: #2a1010;
  }

  .agent-run-status-text {
    margin: 0;
    color: #8d9bad;
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .chat-stream {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 14px;
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .chat-bubble {
    max-width: 820px;
    border: 1px solid #263445;
    border-radius: 8px;
    padding: 12px;
    background: #151d28;
  }

  .chat-bubble.user {
    justify-self: end;
    background: #1c2430;
  }

  .chat-bubble.agent {
    justify-self: start;
  }

  .chat-bubble span {
    display: block;
    color: #8d9bad;
    font-size: 11px;
    font-weight: 750;
    margin-bottom: 5px;
  }

  .chat-bubble p,
  .run-card p,
  .page-header p,
  .module-detail-header p,
  .timeline-card p,
  .data-row p {
    margin: 0;
    color: #9aa7b8;
    line-height: 1.55;
    font-size: 13px;
  }

  .run-card,
  .queued-card,
  .timeline-card,
  .result-panel,
  .metric,
  .publish-step,
  .data-row {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #121a25;
  }

  .run-card {
    padding: 13px;
  }

  .run-card h2,
  .timeline-card h2 {
    margin: 8px 0 6px;
    font-size: 15px;
    letter-spacing: 0;
  }

  .run-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .small-action,
  .primary-action {
    border: 1px solid #344456;
    border-radius: 7px;
    background: #182231;
    color: #edf3fb;
    gap: 7px;
    padding: 0 10px;
    height: 31px;
    font-size: 12px;
  }

  .primary-action {
    background: #f97316;
    border-color: #f97316;
    color: #fff;
    font-weight: 800;
  }

  .workspace-preview {
    margin: 14px;
    border: 1px solid #263445;
    border-radius: 8px;
    overflow: hidden;
    background: #090d12;
  }

  .preview-bar {
    height: 34px;
    border-bottom: 1px solid #202c3b;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 12px;
    color: #738195;
    font-size: 12px;
  }

  .preview-bar span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4e5b6d;
  }

  .preview-bar strong {
    margin-left: 8px;
    font-weight: 650;
  }

  .memory-map {
    padding: 14px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .memory-node {
    min-height: 94px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #111923;
    color: #edf3fb;
    display: grid;
    align-content: start;
    gap: 7px;
    text-align: left;
    padding: 12px;
  }

  .memory-node.active {
    border-color: #a78bfa;
    background: #181b31;
  }

  .memory-node i,
  .module-row i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .memory-node span {
    color: #8d9bad;
    font-size: 12px;
  }

  .agent-summary-grid,
  .detail-grid,
  .publish-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 0 14px 14px;
  }

  .metric {
    padding: 11px;
    display: grid;
    gap: 5px;
  }

  .metric span {
    color: #738195;
    font-size: 11px;
  }

  .metric strong {
    font-size: 16px;
    color: #edf3fb;
  }

  .module-list {
    overflow: hidden;
  }

  .module-row {
    min-height: 82px;
    border: 0;
    border-bottom: 1px solid #202c3b;
    background: transparent;
    color: #edf3fb;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    text-align: left;
  }

  .module-row.active {
    background: #172130;
  }

  .module-row span {
    display: grid;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .module-row strong,
  .module-row em,
  .result-line strong,
  .result-line span,
  .data-row strong,
  .data-row em {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .module-row strong {
    font-size: 13px;
  }

  .module-row em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    white-space: nowrap;
  }

  .module-row b {
    color: #8d9bad;
    font-size: 11px;
    font-weight: 700;
  }

  .module-detail {
    padding: 16px;
    gap: 14px;
    overflow: auto;
  }

  .module-detail-header,
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .module-detail-header h1,
  .page-header h1 {
    margin: 0 0 6px;
    font-size: 26px;
    line-height: 1.15;
    letter-spacing: 0;
  }

  .result-panel {
    overflow: hidden;
  }

  .result-lines {
    display: grid;
    gap: 8px;
    padding: 12px;
  }

  .result-line {
    border: 1px solid #263445;
    border-radius: 7px;
    background: #0d141d;
    display: grid;
    gap: 4px;
    padding: 10px;
  }

  .result-line span {
    color: #8d9bad;
    font-size: 12px;
    white-space: nowrap;
  }

  .page-panel {
    min-height: 100%;
    padding: 18px;
    gap: 14px;
  }

  .queued-card {
    padding: 12px;
    gap: 10px;
    color: #f2c94c;
  }

  .queued-card span {
    display: grid;
    gap: 3px;
  }

  .queued-card em {
    color: #aeb8c6;
    font-style: normal;
    font-size: 12px;
  }

  .api-plan-panel {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0d141d;
    display: grid;
    gap: 10px;
    padding: 12px;
  }

  .api-plan-panel p {
    margin: 0;
    color: #aeb8c6;
    font-size: 13px;
    line-height: 1.5;
  }

  .api-plan-meta,
  .warning-chip-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .api-plan-meta strong,
  .api-plan-meta span,
  .warning-chip-row span {
    min-height: 26px;
    border: 1px solid #344456;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 850;
  }

  .api-plan-meta strong {
    color: #edf3fb;
    background: #151d28;
  }

  .api-plan-meta span {
    color: #9aa7b8;
    background: #121a25;
  }

  .warning-chip-row span {
    color: #f2c94c;
    border-color: #f2c94c55;
    background: #211d0d;
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .timeline {
    display: grid;
    gap: 10px;
  }

  .timeline-card {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }

  .timeline-card small {
    display: block;
    margin-top: 8px;
    color: #738195;
  }

  .status-dot {
    width: fit-content;
    min-width: 74px;
    height: 26px;
    border: 1px solid #344456;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 9px;
    font-size: 11px;
    font-weight: 800;
    color: #9aa7b8;
    background: #151d28;
  }

  .status-dot.succeeded {
    color: #35d07f;
    border-color: #35d07f66;
    background: #0e2419;
  }

  .status-dot.running {
    color: #4f9cff;
    border-color: #4f9cff66;
    background: #10213a;
  }

  .status-dot.waiting,
  .status-dot.queued {
    color: #f2c94c;
    border-color: #f2c94c55;
    background: #211d0d;
  }

  .runtime-control {
    border-top: 1px solid #202c3b;
    display: grid;
    gap: 12px;
    padding: 14px;
  }

  .runtime-mode-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .runtime-mode-button {
    min-height: 34px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    color: #9aa7b8;
    font-size: 12px;
    font-weight: 850;
  }

  .runtime-mode-button.active {
    color: #edf3fb;
    border-color: #4f9cff66;
    background: #10213a;
  }

  .runtime-status-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .runtime-status {
    width: fit-content;
    min-width: 92px;
    min-height: 26px;
    border: 1px solid #344456;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    color: #9aa7b8;
    background: #151d28;
    font-size: 11px;
    font-weight: 850;
    text-align: center;
  }

  .runtime-status.succeeded {
    color: #35d07f;
    border-color: #35d07f66;
    background: #0e2419;
  }

  .runtime-status.running {
    color: #4f9cff;
    border-color: #4f9cff66;
    background: #10213a;
  }

  .runtime-status.resumable {
    color: #a78bfa;
    border-color: #a78bfa66;
    background: #181b31;
  }

  .runtime-status.approval_required {
    color: #f97316;
    border-color: #f9731666;
    background: #24170f;
  }

  .runtime-status.waiting_for_user,
  .runtime-status.waiting_for_data {
    color: #f2c94c;
    border-color: #f2c94c55;
    background: #211d0d;
  }

  .runtime-status.blocked {
    color: #ff6b6b;
    border-color: #ff6b6b66;
    background: #2a1215;
  }

  .runtime-status.skipped {
    color: #f2c94c;
    border-color: #f2c94c55;
    background: #211d0d;
  }

  .runtime-panel {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0f151e;
    display: grid;
    gap: 12px;
    padding: 14px;
  }

  .runtime-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .runtime-interaction {
    border: 1px solid #263445;
    border-radius: 7px;
    background: #0d141d;
    display: grid;
    gap: 6px;
    padding: 11px;
  }

  .runtime-interaction strong {
    color: #edf3fb;
    font-size: 13px;
  }

  .runtime-interaction p {
    margin: 0;
    color: #9aa7b8;
    line-height: 1.45;
    font-size: 12px;
  }

  .runtime-interaction em {
    color: #738195;
    font-size: 11px;
    font-style: normal;
    overflow-wrap: anywhere;
  }

  .runtime-action-feedback {
    margin: -2px 0 0;
    color: #8d9bad;
    font-size: 12px;
    font-weight: 750;
    overflow-wrap: anywhere;
  }

  .runtime-chip-row,
  .runtime-action-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .runtime-chip-row {
    flex: 1;
    min-width: 0;
  }

  .runtime-chip-row span {
    min-height: 28px;
    border: 1px solid #344456;
    border-radius: 999px;
    background: #121a25;
    color: #aeb8c6;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 800;
  }

  .runtime-action-row {
    justify-content: space-between;
  }

  .runtime-action-row > span:not(.connection-pill) {
    color: #8d9bad;
    font-size: 12px;
    font-weight: 750;
  }

  .runtime-timeline-card {
    grid-template-columns: 124px minmax(0, 1fr);
  }

  .search-box {
    height: 34px;
    border: 1px solid #263445;
    border-radius: 7px;
    color: #738195;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 11px;
    font-size: 12px;
    background: #151d28;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-chip {
    height: 30px;
    border: 1px solid #263445;
    border-radius: 999px;
    background: #151d28;
    color: #9aa7b8;
    padding: 0 10px;
    font-size: 12px;
  }

  .filter-chip.active {
    color: #edf3fb;
    border-color: #4f9cff;
    background: #10213a;
  }

  .data-table {
    display: grid;
    gap: 8px;
  }

  .data-row {
    display: grid;
    grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.2fr) auto;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }

  .data-row span {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .data-row em {
    color: #738195;
    font-size: 11px;
    font-style: normal;
    white-space: nowrap;
  }

  .data-row b {
    color: #738195;
    font-size: 12px;
  }

  .configure-layout {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .configure-hero {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0f151e;
    padding: 18px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .configure-hero h1 {
    margin: 0 0 6px;
    font-size: 26px;
    line-height: 1.15;
    letter-spacing: 0;
  }

  .configure-hero p {
    margin: 0;
    color: #9aa7b8;
    line-height: 1.55;
    font-size: 13px;
    max-width: 720px;
  }

  .connection-pill {
    min-height: 32px;
    border: 1px solid #344456;
    border-radius: 999px;
    background: #151d28;
    color: #9aa7b8;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 11px;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .connection-pill.configured {
    color: #35d07f;
    border-color: #35d07f66;
    background: #0e2419;
  }

  .connection-pill.missing_key {
    color: #f2c94c;
    border-color: #f2c94c55;
    background: #211d0d;
  }

  .capability-map {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .capability-map span {
    min-height: 74px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0f151e;
    display: grid;
    align-content: start;
    gap: 5px;
    padding: 12px;
  }

  .capability-map strong {
    color: #edf3fb;
    font-size: 13px;
  }

  .capability-map em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    line-height: 1.45;
  }

  .configure-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .config-card {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #0f151e;
    padding: 14px;
    display: grid;
    align-content: start;
    gap: 14px;
    min-width: 0;
  }

  .config-card-wide {
    grid-column: 1 / -1;
  }

  .config-card-heading,
  .config-card-heading span,
  .config-actions,
  .runtime-lines span {
    display: flex;
    align-items: center;
  }

  .config-card-heading {
    justify-content: space-between;
    gap: 12px;
    color: #edf3fb;
    font-size: 13px;
    font-weight: 850;
  }

  .config-card-heading span {
    gap: 8px;
  }

  .config-card-heading em {
    color: #738195;
    font-size: 11px;
    font-style: normal;
    font-weight: 700;
    text-align: right;
  }

  .config-explainer {
    margin: -4px 0 0;
    color: #9aa7b8;
    line-height: 1.55;
    font-size: 12px;
  }

  .switch-legend {
    width: fit-content;
    max-width: 100%;
  }

  .switch-legend summary {
    width: fit-content;
    min-height: 30px;
    border: 1px solid #263445;
    border-radius: 999px;
    background: #121a25;
    color: #aeb8c6;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: 0 11px;
    font-size: 12px;
    font-weight: 800;
    list-style: none;
  }

  .switch-legend summary::-webkit-details-marker,
  .skill-help summary::-webkit-details-marker {
    display: none;
  }

  .switch-legend[open] summary {
    color: #edf3fb;
    border-color: #4f9cff66;
    background: #10213a;
  }

  .switch-legend div {
    margin-top: 8px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .switch-legend span {
    min-height: 64px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #0d141d;
    display: grid;
    align-content: start;
    gap: 5px;
    padding: 9px;
  }

  .switch-legend strong {
    color: #edf3fb;
    font-size: 11px;
  }

  .switch-legend em {
    color: #8d9bad;
    font-size: 11px;
    font-style: normal;
    line-height: 1.45;
  }

  .config-field {
    display: grid;
    gap: 7px;
    min-width: 0;
  }

  .config-field label,
  .config-field-label {
    color: #8290a3;
    font-size: 11px;
    font-weight: 800;
  }

  .locked-value,
  .config-card select,
  .config-card input,
  .config-card textarea {
    width: 100%;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    color: #edf3fb;
    font: inherit;
    font-size: 13px;
  }

  .locked-value,
  .config-card select,
  .config-card input {
    height: 36px;
    padding: 0 10px;
  }

  .locked-value {
    display: flex;
    align-items: center;
    color: #9aa7b8;
  }

  .config-card textarea {
    min-height: 92px;
    resize: vertical;
    padding: 10px;
    line-height: 1.45;
  }

  .config-card input[type="checkbox"] {
    width: 15px;
    height: 15px;
    padding: 0;
    accent-color: #f97316;
    flex-shrink: 0;
  }

  .segmented-control {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .segmented-button {
    min-width: 84px;
    height: 32px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    color: #9aa7b8;
    font-size: 12px;
    font-weight: 800;
    flex: 1;
  }

  .segmented-button.active {
    color: #edf3fb;
    border-color: #4f9cff66;
    background: #10213a;
  }

  .config-actions {
    justify-content: flex-end;
    gap: 8px;
  }

  .primary-action:disabled,
  .small-action:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .skill-settings-grid {
    display: grid;
    gap: 8px;
  }

  .skill-setting-row {
    min-height: 66px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #121a25;
    display: grid;
    grid-template-columns: 10px minmax(170px, 1fr) repeat(4, minmax(86px, auto)) 34px;
    align-items: center;
    gap: 10px;
    padding: 10px;
  }

  .general-skill-row {
    min-height: 66px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #121a25;
    display: grid;
    grid-template-columns: minmax(210px, 1fr) 92px repeat(4, minmax(86px, auto)) 34px;
    align-items: center;
    gap: 10px;
    padding: 10px;
  }

  .skill-setting-row i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .skill-setting-row span,
  .general-skill-row span {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .skill-setting-row strong,
  .skill-setting-row em,
  .general-skill-row strong,
  .general-skill-row em {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .skill-setting-row strong,
  .general-skill-row strong {
    font-size: 13px;
  }

  .skill-setting-row em,
  .general-skill-row em {
    color: #8290a3;
    font-size: 11px;
    font-style: normal;
    white-space: nowrap;
  }

  .skill-state {
    width: fit-content;
    min-width: 78px;
    height: 26px;
    border: 1px solid #f2c94c55;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 9px;
    color: #f2c94c;
    background: #211d0d;
    font-size: 11px;
    font-weight: 800;
  }

  .skill-state.installed {
    color: #35d07f;
    border-color: #35d07f66;
    background: #0e2419;
  }

  .skill-help {
    position: relative;
    justify-self: end;
  }

  .skill-help summary {
    width: 28px;
    height: 28px;
    border: 1px solid #344456;
    border-radius: 999px;
    background: #0d141d;
    color: #aeb8c6;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 900;
    list-style: none;
    user-select: none;
  }

  .skill-help[open] summary {
    color: #edf3fb;
    border-color: #4f9cff66;
    background: #10213a;
  }

  .skill-help-panel {
    position: absolute;
    z-index: 30;
    top: 34px;
    right: 0;
    width: min(680px, calc(100vw - 150px));
    border: 1px solid #344456;
    border-radius: 8px;
    background: #0b1118;
    box-shadow: 0 18px 42px #00000066;
    padding: 10px;
  }

  .skill-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .skill-detail-grid span:last-child {
    grid-column: 1 / -1;
  }

  .skill-detail-grid span {
    min-height: 72px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #0d141d;
    display: grid;
    align-content: start;
    gap: 5px;
    padding: 9px;
  }

  .skill-detail-grid strong {
    color: #edf3fb;
    font-size: 11px;
  }

  .skill-detail-grid em {
    color: #8d9bad;
    font-size: 11px;
    font-style: normal;
    line-height: 1.45;
    white-space: normal;
  }

  .toggle-row {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #aeb8c6;
    font-size: 12px;
    font-weight: 700;
    min-width: 0;
  }

  .toggle-row.large {
    min-height: 38px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    padding: 0 10px;
  }

  .config-two-column {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px;
    gap: 10px;
  }

  .runtime-lines {
    display: grid;
    gap: 8px;
  }

  .runtime-lines span {
    min-height: 42px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 10px;
  }

  .runtime-lines strong {
    font-size: 12px;
  }

  .runtime-lines em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .publish-grid {
    padding: 0;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .publish-settings-panel {
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.44);
    display: grid;
    gap: 12px;
    margin-bottom: 14px;
    padding: 14px;
  }

  .publish-settings-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .publish-settings-header div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .publish-settings-header p {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    text-align: right;
  }

  .publish-status-badge,
  .publish-save-badge {
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 999px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0;
    padding: 5px 9px;
    text-transform: uppercase;
  }

  .publish-status-badge.published {
    border-color: rgba(53, 208, 127, 0.38);
    color: #bbf7d0;
  }

  .publish-status-badge.paused {
    border-color: rgba(250, 204, 21, 0.36);
    color: #fde68a;
  }

  .publish-form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(180px, 0.8fr);
    gap: 10px;
    align-items: end;
  }

  .publish-field {
    display: grid;
    gap: 6px;
  }

  .publish-field span {
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .publish-field input {
    width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 7px;
    background: rgba(2, 6, 23, 0.48);
    color: var(--text);
    font: inherit;
    min-height: 38px;
    padding: 8px 10px;
  }

  .publish-token-meta {
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 7px;
    background: rgba(2, 6, 23, 0.28);
    display: grid;
    gap: 3px;
    min-height: 58px;
    padding: 8px 10px;
  }

  .publish-token-meta strong {
    color: var(--text);
    font-size: 12px;
  }

  .publish-token-meta em {
    color: var(--muted);
    font-size: 11px;
    font-style: normal;
    line-height: 1.35;
  }

  .publish-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .publish-actions button {
    min-height: 36px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 7px;
    background: rgba(148, 163, 184, 0.1);
    color: var(--text);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 12px;
  }

  .publish-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .publish-step {
    min-height: 126px;
    padding: 14px;
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .publish-step span {
    color: #4f9cff;
  }

  .publish-step em {
    color: #8d9bad;
    font-style: normal;
    font-size: 12px;
  }

  .publish-access-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  .publish-access-card {
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.42);
    border-radius: 8px;
    padding: 14px;
    display: grid;
    gap: 10px;
  }

  .publish-card-kicker {
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .publish-access-card h2 {
    font-size: 15px;
    margin: 0;
  }

  .publish-access-card p,
  .publish-access-card em {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .publish-token-row,
  .publish-admin-boundary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .publish-token-row code {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 6px;
    padding: 7px 9px;
    color: var(--text);
    background: rgba(2, 6, 23, 0.48);
  }

  .publish-token-row button {
    border: 1px solid rgba(96, 165, 250, 0.35);
    background: rgba(96, 165, 250, 0.12);
    color: #bfdbfe;
    border-radius: 6px;
    padding: 8px 10px;
    cursor: pointer;
  }

  .publish-portal-view-list {
    display: grid;
    gap: 8px;
  }

  .publish-portal-view-list span,
  .publish-admin-boundary span {
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 6px;
    padding: 8px;
    background: rgba(2, 6, 23, 0.28);
  }

  .publish-portal-view-list strong,
  .publish-admin-boundary span {
    color: var(--text);
    font-size: 12px;
  }

  .publish-portal-view-list em {
    display: block;
    margin-top: 3px;
  }

  .composer-shell {
    border-top: 1px solid #1e2936;
    background: #0d1219;
    padding: 10px 14px;
    flex-shrink: 0;
  }

  .composer {
    min-height: 68px;
    border: 1px solid #344456;
    border-radius: 8px;
    background: #151d28;
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 0 9px 0 12px;
  }

  .composer textarea {
    flex: 1;
    min-width: 0;
    min-height: 46px;
    border: 0;
    outline: 0;
    resize: none;
    background: transparent;
    color: #edf3fb;
    font: inherit;
    font-size: 13px;
    line-height: 1.45;
    padding: 12px 0 8px;
  }

  .composer textarea:disabled {
    color: #8290a3;
    cursor: default;
  }

  .composer-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 9px;
    flex-shrink: 0;
  }

  .icon-action,
  .mode-action,
  .send-action {
    height: 32px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #101720;
    color: #9aa7b8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .icon-action,
  .send-action {
    width: 32px;
  }

  .mode-action {
    gap: 6px;
    padding: 0 10px;
    font-size: 12px;
  }

  .mode-action.active {
    color: #a78bfa;
    border-color: #a78bfa66;
    background: #181b31;
  }

  .send-action {
    color: #fff;
    background: #f97316;
    border-color: #f97316;
  }

  .send-action:disabled {
    color: #5d6a7a;
    background: #101720;
    border-color: #263445;
    cursor: default;
  }

  .mobile-nav {
    display: none;
  }

  button:focus-visible,
  textarea:focus-visible,
  input:focus-visible,
  select:focus-visible,
  summary:focus-visible {
    outline: 2px solid #4f9cff;
    outline-offset: 2px;
  }

  .agent-os-shell * {
    box-sizing: border-box;
    scrollbar-color: #344456 transparent;
  }

  .agent-os-shell *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .agent-os-shell *::-webkit-scrollbar-thumb {
    background: #344456;
    border-radius: 8px;
  }

  @media (max-width: 1020px) {
    .agent-layout,
    .module-layout {
      grid-template-columns: 1fr;
      height: auto;
    }

    .workspace-panel,
    .module-detail,
    .module-list {
      min-height: 0;
    }

    .publish-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .publish-form-grid {
      grid-template-columns: 1fr;
    }

    .publish-access-grid {
      grid-template-columns: 1fr;
    }

    .runtime-meta-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .capability-map {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .configure-grid {
      grid-template-columns: 1fr;
    }

    .skill-setting-row {
      grid-template-columns: 10px minmax(0, 1fr) repeat(4, minmax(78px, auto)) 34px;
    }

    .general-skill-row {
      grid-template-columns: minmax(0, 1fr) 84px repeat(4, minmax(78px, auto)) 34px;
    }

    .switch-legend div,
    .skill-detail-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .agent-os-shell {
      display: block;
    }

    .side-rail {
      display: none;
    }

    .main-shell {
      height: 100%;
    }

    .topbar {
      padding: 0 12px;
    }

    .topbar-actions {
      display: flex;
    }

    .topbar-actions .topbar-pill {
      display: none;
    }

    .view-frame {
      padding: 10px 10px 0;
    }

    .chat-panel,
    .workspace-panel,
    .module-list,
    .module-detail,
    .page-panel {
      border-radius: 8px;
    }

    .agent-layout,
    .module-layout {
      gap: 10px;
    }

    .workspace-panel {
      display: none;
    }

    .module-detail-header,
    .page-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .module-detail-header h1,
    .page-header h1 {
      font-size: 23px;
    }

    .configure-hero {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      padding: 14px;
    }

    .configure-hero h1 {
      font-size: 23px;
    }

    .connection-pill {
      width: fit-content;
      max-width: 100%;
      white-space: normal;
    }

    .agent-run-state {
      max-width: 100%;
      white-space: normal;
      text-align: center;
    }

    .agent-summary-grid,
    .detail-grid,
    .publish-grid,
    .publish-form-grid,
    .runtime-status-grid,
    .runtime-meta-grid,
    .memory-map {
      grid-template-columns: 1fr;
    }

    .publish-settings-header {
      flex-direction: column;
    }

    .publish-settings-header p {
      text-align: left;
    }

    .runtime-control,
    .runtime-panel {
      padding: 12px;
    }

    .runtime-mode-group {
      grid-template-columns: 1fr;
    }

    .runtime-action-row {
      align-items: stretch;
      flex-direction: column;
    }

    .api-plan-meta,
    .warning-chip-row {
      align-items: flex-start;
    }

    .runtime-action-row .small-action,
    .runtime-action-row .primary-action {
      width: fit-content;
      max-width: 100%;
    }

    .capability-map,
    .skill-detail-grid {
      grid-template-columns: 1fr;
    }

    .config-card {
      padding: 12px;
    }

    .config-card-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 5px;
    }

    .skill-setting-row {
      grid-template-columns: 10px minmax(0, 1fr) 34px;
      align-items: start;
    }

    .general-skill-row {
      grid-template-columns: minmax(0, 1fr) 34px;
      align-items: start;
    }

    .skill-setting-row .toggle-row {
      grid-column: 2 / -1;
    }

    .general-skill-row .skill-state,
    .general-skill-row .toggle-row {
      grid-column: 1 / -1;
    }

    .skill-setting-row em,
    .general-skill-row em {
      white-space: normal;
    }

    .switch-legend div {
      grid-template-columns: 1fr;
    }

    .skill-help-panel {
      width: calc(100vw - 44px);
      right: 0;
    }

    .toggle-row {
      justify-content: flex-start;
    }

    .config-two-column,
    .runtime-lines span {
      grid-template-columns: 1fr;
    }

    .runtime-lines span {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }

    .runtime-lines em {
      text-align: left;
    }

    .timeline-card,
    .runtime-timeline-card,
    .data-row {
      grid-template-columns: 1fr;
    }

    .data-row p {
      overflow-wrap: anywhere;
    }

    .module-row {
      min-height: 76px;
    }

    .module-row em {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .composer-shell {
      padding: 8px 10px;
    }

    .composer {
      min-height: 96px;
      align-items: stretch;
      flex-direction: column;
      padding: 0 10px 9px;
    }

    .composer textarea {
      min-height: 54px;
      padding: 11px 0 0;
    }

    .composer-actions {
      width: 100%;
      justify-content: flex-end;
      padding-bottom: 0;
    }

    .mode-action {
      margin-right: auto;
    }

    .mobile-nav {
      height: 68px;
      border-top: 1px solid #1e2936;
      background: #0d1219;
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 2px;
      padding: 5px 6px 7px;
      flex-shrink: 0;
    }

    .mobile-nav-button {
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: #8290a3;
      display: grid;
      place-items: center;
      gap: 2px;
      font-size: 9px;
      min-width: 0;
    }

    .mobile-nav-button span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mobile-nav-button.active {
      color: #edf3fb;
      background: #172130;
      border-color: #334258;
    }
  }
`;

export default AgentFirstInterface;
