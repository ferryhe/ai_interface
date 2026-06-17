import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
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
  Moon,
  Paperclip,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { AgentCatalog } from "./_components/AgentCatalog";
import { AgentDetail } from "./_components/AgentDetail";
import { AgentManifestWizard } from "./_components/AgentManifestWizard";
import { ArtifactInspector } from "./_components/ArtifactInspector";
import { RunInspector } from "./_components/RunInspector";
import { MissionCenterShell } from "@/components/mission/MissionCenterShell";
import { OperatorBackstage } from "@/components/operator/OperatorBackstage";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import {
  createAgentFirstWorkbenchDemoData,
} from "./_shared/data";
import type {
  AgentManifestPreview,
  AgentReadiness,
  WorkbenchArtifact,
  WorkbenchArtifactPipelineGroup,
  WorkbenchRunInspection,
  WorkbenchRunStatus,
} from "./_shared/types";

type AppView = "agent" | "modules" | "progress" | "data" | "publish" | "configure";
type WorkspaceMode = "mission" | "foreground" | "backstage";
type ThemeMode = "dark" | "light";
type WorkbenchTab = "agents" | "skills" | "runs" | "artifacts" | "operator";
type BackstageTab = "io" | "artifacts" | "events" | "ui";
type ModuleId =
  | "web_listening"
  | "doc_to_md"
  | "md_to_rag"
  | "rag_to_agent"
  | "climate_monitor"
  | "ai_actuary"
  | "example_reporter";
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
type AgentProvider = "openai" | "anthropic" | "ollama" | "deterministic";
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

type AgentFirstMessageValues = Record<string, string | number>;

interface AgentFirstLocalizedMessage {
  key: string;
  values?: AgentFirstMessageValues;
}

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
  adapterKind: "cli" | "http" | "mcp" | "internal";
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
  skillId?: ModuleId;
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
}

interface AgentRunApiResponse {
  status: "planned" | "missing_key" | "needs_approval" | "failed";
  connection: AgentConnectionPayload;
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
  options: ToolInteractionOptionApi[];
  artifactIds: string[];
  resumeHandle: string | null;
  requestedBy: string | null;
  requestedAt: string;
  metadata: JsonObject;
  respondedAt?: string;
  response?: ToolInteractionFeedbackApi;
}

interface ToolInteractionOptionApi {
  id: string;
  label: string;
  value?: unknown;
}

interface ToolInteractionFeedbackApi {
  responseText?: string;
  selectedOptionId?: string;
  approved?: boolean;
  artifactIds: string[];
  resumeHandle?: string;
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

interface LocalWorkbenchRunRaw {
  source: "local-demo";
  agentId: string;
  agentNameKey: string | null;
  agentNameFallback: string;
  pipelineRunId: string;
  skillIds: string[];
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
  keyPrefix: string;
}

type ArtifactRendererKind = "markdown" | "table" | "json" | "text" | "image" | "file";

interface SkillArtifactSample {
  id: string;
  title: string;
  kind: string;
  renderer: ArtifactRendererKind;
  content?: string | JsonObject | JsonObject[];
  contentKey?: string;
}

interface SkillManifestPreview {
  id: ModuleId;
  name: string;
  description: string;
  project: {
    source?: string;
    defaultSiblingPath: string;
    envPath: string;
    readiness: "ready" | "not_configured";
  };
  execution: {
    adapterId: string;
    kind: "cli" | "http" | "internal" | "mcp";
    requiredEnv: string[];
    supportsResume: boolean;
  };
  ui: {
    mode: "html" | "renderer" | "auto";
    htmlEntrypoint?: string;
    openOnTrigger: boolean;
    preferredRenderer: ArtifactRendererKind;
  };
  artifactKinds: string[];
  interactionKinds: Array<"question" | "approval" | "data_request" | "blocked">;
  inputSchema: JsonObject;
  outputSchema: JsonObject;
  sampleInput: JsonObject;
  sampleOutput: JsonObject;
  sampleArtifacts: SkillArtifactSample[];
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
  connection: AgentConnectionPayload;
}

interface PlannerProviderReadiness {
  provider: AgentProvider;
  displayName: string;
  requiredEnv: string[];
  defaultModelId: string;
  supportsReasoningEffort: boolean;
  configured: boolean;
  missingEnv: string[];
}

interface AgentConnectionPayload {
  status: Exclude<AgentConnectionStatus, "offline">;
  configuredProvider: AgentProvider;
  activeProvider: AgentProvider;
  providers: PlannerProviderReadiness[];
  warnings: string[];
  checkedAt?: string;
}

interface AgentConnectionApiResponse extends AgentConnectionPayload {
  checkedAt: string;
}

type ClimateMonitorRunMode = "dry_run" | "live_run";
type ClimateMonitorApiState = "loading" | "api" | "offline";
type ClimateMonitorRunState = "idle" | "submitting" | "succeeded" | "offline" | "failed";
type ClimateWarningSeverity = "info" | "warning" | "critical";

interface ClimateReport {
  id: string;
  title: string;
  status: string;
  generatedAt: string;
  summary: string;
}

interface ClimateScopeCoverage {
  label: string;
  covered: number;
  total: number;
  status: string;
}

interface ClimateWarningPlaceholder {
  id: string;
  label: string;
  severity: ClimateWarningSeverity;
  detail: string;
}

interface ClimateDedupStatus {
  candidates: number;
  merged: number;
  pending: number;
  lastChecked: string;
}

interface ClimateMonitorStatus {
  configured: boolean;
  latestReport: ClimateReport | null;
  scopeCoverage: ClimateScopeCoverage[];
  warnings: ClimateWarningPlaceholder[];
  dedup: ClimateDedupStatus;
  updatedAt: string;
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
  {
    id: "climate_monitor",
    name: "climate_monitor",
    description: "Track climate and actuarial monitor reports, source coverage, warnings, and run controls.",
    status: "waiting",
    records: 6,
    result: "latest monitor report",
    color: "#14b8a6",
  },
  {
    id: "ai_actuary",
    name: "ai_actuary",
    description: "Invoke the reserving pipeline through the safe CLI executor.",
    status: "queued",
    records: 0,
    result: "ready when configured",
    color: "#f2c94c",
  },
  {
    id: "example_reporter",
    name: "example_reporter",
    description: "Validation-only community manifest example for custom skill development.",
    status: "queued",
    records: 0,
    result: "community example",
    color: "#33c6d8",
  },
];

const skillManifestPreviews: SkillManifestPreview[] = [
  {
    id: "web_listening",
    name: "web_listening",
    description: "Monitor URLs, create page snapshots, extract text, and detect changes.",
    project: {
      defaultSiblingPath: "../web_listening",
      envPath: "WEB_LISTENING_PROJECT_PATH",
      readiness: "not_configured",
    },
    execution: {
      adapterId: "web_listening.cli.v1",
      kind: "cli",
      requiredEnv: ["WEB_LISTENING_CLI_PATH"],
      supportsResume: true,
    },
    ui: {
      mode: "html",
      htmlEntrypoint: "/skill-ui/web_listening",
      openOnTrigger: true,
      preferredRenderer: "json",
    },
    artifactKinds: ["web_snapshot", "extracted_text", "change_event"],
    interactionKinds: ["question", "approval", "blocked"],
    inputSchema: {
      type: "object",
      required: ["siteUrl", "monitoringGoal"],
      properties: {
        siteUrl: { type: "string" },
        monitoringGoal: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        snapshots: { type: "array" },
        events: { type: "array" },
      },
    },
    sampleInput: {
      siteUrl: "https://docs.example.com/getting-started",
      monitoringGoal: "Detect onboarding doc changes",
    },
    sampleOutput: {
      snapshots: 18,
      changes: 3,
      manifest: "document_manifest.yaml",
    },
    sampleArtifacts: [
      {
        id: "snap_018",
        title: "Latest page snapshot",
        kind: "web_snapshot",
        renderer: "json",
        content: {
          url: "https://docs.example.com/getting-started",
          status: 200,
          extractedTextBytes: 18442,
          changedSelectors: ["nav.docs", "main h2:nth-of-type(2)"],
        },
      },
    ],
  },
  {
    id: "doc_to_md",
    name: "doc_to_md",
    description: "Convert source documents into Markdown with warnings and extracted assets.",
    project: {
      defaultSiblingPath: "../doc_to_md",
      envPath: "DOC_TO_MD_PROJECT_PATH",
      readiness: "not_configured",
    },
    execution: {
      adapterId: "doc_to_md.http.v1",
      kind: "http",
      requiredEnv: ["DOC_TO_MD_API_BASE_URL"],
      supportsResume: true,
    },
    ui: {
      mode: "renderer",
      openOnTrigger: false,
      preferredRenderer: "markdown",
    },
    artifactKinds: ["markdown_document", "conversion_warning", "document_asset"],
    interactionKinds: ["question", "data_request"],
    inputSchema: {
      type: "object",
      required: ["sourceArtifactIds"],
      properties: {
        sourceArtifactIds: { type: "array", items: { type: "string" } },
        includeAssets: { type: "boolean" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        markdown: { type: "string" },
        quality: { type: "object" },
        assets: { type: "array" },
      },
    },
    sampleInput: {
      sourceArtifactIds: ["snap_018", "onboarding.pdf"],
      includeAssets: true,
    },
    sampleOutput: {
      markdownArtifactId: "md_006",
      warnings: 1,
      assets: 3,
    },
    sampleArtifacts: [
      {
        id: "md_006",
        title: "onboarding.md",
        kind: "markdown_document",
        renderer: "markdown",
        contentKey:
          "agentFirst.workbenchDemo.sampleArtifacts.docToMdMarkdown.content",
      },
    ],
  },
  {
    id: "md_to_rag",
    name: "md_to_rag",
    description: "Chunk Markdown, prepare embedding metadata, and build RAG index records.",
    project: {
      defaultSiblingPath: "../c-ross-2",
      envPath: "CROSS2_PROJECT_PATH",
      readiness: "not_configured",
    },
    execution: {
      adapterId: "md_to_rag.cli.v1",
      kind: "cli",
      requiredEnv: ["CROSS2_CLI_PATH"],
      supportsResume: false,
    },
    ui: {
      mode: "renderer",
      openOnTrigger: false,
      preferredRenderer: "table",
    },
    artifactKinds: ["rag_chunk", "embedding_metadata", "rag_index"],
    interactionKinds: ["question", "data_request", "blocked"],
    inputSchema: {
      type: "object",
      required: ["markdownArtifactIds", "collection"],
      properties: {
        markdownArtifactIds: { type: "array", items: { type: "string" } },
        collection: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        chunks: { type: "array" },
        manifest: { type: "object" },
      },
    },
    sampleInput: {
      markdownArtifactIds: ["md_006"],
      collection: "onboarding",
    },
    sampleOutput: {
      chunks: 124,
      readyDataManifest: "ready_data_manifest.json",
    },
    sampleArtifacts: [
      {
        id: "chunk_096",
        title: "Chunk table",
        kind: "rag_chunk",
        renderer: "table",
        content: [
          { chunk: 94, tokens: 788, source: "onboarding.md", status: "ready" },
          { chunk: 95, tokens: 801, source: "onboarding.md", status: "ready" },
          { chunk: 96, tokens: 812, source: "onboarding.md", status: "pending_adapter" },
        ],
      },
    ],
  },
  {
    id: "rag_to_agent",
    name: "rag_to_agent",
    description: "Generate agent configs, prompts, tools, and validation results.",
    project: {
      defaultSiblingPath: "../c-ross-2",
      envPath: "CROSS2_PROJECT_PATH",
      readiness: "not_configured",
    },
    execution: {
      adapterId: "rag_to_agent.http.v1",
      kind: "http",
      requiredEnv: ["RAG_TO_AGENT_API_BASE_URL"],
      supportsResume: true,
    },
    ui: {
      mode: "html",
      htmlEntrypoint: "/skill-ui/rag_to_agent",
      openOnTrigger: true,
      preferredRenderer: "json",
    },
    artifactKinds: ["agent_config", "agent_prompt", "agent_validation"],
    interactionKinds: ["question", "approval", "blocked"],
    inputSchema: {
      type: "object",
      required: ["ragIndexArtifactId", "agentName"],
      properties: {
        ragIndexArtifactId: { type: "string" },
        agentName: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        agentConfig: { type: "object" },
        prompt: { type: "string" },
        validation: { type: "object" },
      },
    },
    sampleInput: {
      ragIndexArtifactId: "chunk_096",
      agentName: "Onboarding Guide",
      publishMode: "draft",
    },
    sampleOutput: {
      agentConfigId: "agent_cfg_002",
      tools: ["rag.search", "artifact.open"],
      validation: "pending_approval",
    },
    sampleArtifacts: [
      {
        id: "agent_cfg_002",
        title: "Agent config draft",
        kind: "agent_config",
        renderer: "json",
        content: {
          name: "Onboarding Guide",
          model: "gpt-4.1-mini",
          tools: ["rag.search", "artifact.open"],
          approvalGate: "publish",
        },
      },
    ],
  },
  {
    id: "climate_monitor",
    name: "climate_monitor",
    description: "Track climate and actuarial monitor reports, source scope coverage, and run controls.",
    project: {
      defaultSiblingPath: "../climate_monitor_wiki",
      envPath: "CLIMATE_MONITOR_PROJECT_PATH",
      readiness: "not_configured",
    },
    execution: {
      adapterId: "climate_monitor.cli.v1",
      kind: "cli",
      requiredEnv: ["CLIMATE_MONITOR_PROJECT_PATH"],
      supportsResume: false,
    },
    ui: {
      mode: "renderer",
      openOnTrigger: true,
      preferredRenderer: "json",
    },
    artifactKinds: [
      "climate_monitor_report",
      "climate_monitor_run_json",
      "climate_monitor_scope_status",
    ],
    interactionKinds: ["approval", "blocked"],
    inputSchema: {
      type: "object",
      properties: {
        dryRun: { type: "boolean" },
        date: { type: "string" },
        manifestFixture: { type: "string" },
        researchFixture: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        report_date: { type: "string" },
        report_path: { type: ["string", "null"] },
        item_count: { type: "integer" },
        items: { type: "array" },
        dedup_notes: { type: "array" },
        warnings: { type: "array" },
        synced: { type: "boolean" },
      },
    },
    sampleInput: {
      dryRun: true,
      date: "2026-05-14",
    },
    sampleOutput: {
      report_date: "2026-05-14",
      report_path: "wiki/climate-monitor-2026-05-14.md",
      item_count: 5,
      items: [
        {
          title: "Climate supervision update",
          lane: "website",
        },
      ],
      dedup_notes: [],
      warnings: [],
      synced: true,
    },
    sampleArtifacts: [
      {
        id: "climate_monitor_report_014",
        title: "Latest climate and actuarial monitor report",
        kind: "climate_monitor_report",
        renderer: "json",
        content: {
          reportDate: "2026-05-14",
          reportPath: "wiki/climate-monitor-2026-05-14.md",
          climateItems: 5,
          actuarialClimateItems: 2,
          liveRunEnabled: false,
        },
      },
      {
        id: "climate_monitor_scope_014",
        title: "Source scope coverage",
        kind: "climate_monitor_scope_status",
        renderer: "table",
        content: [
          { scope: "Excel URL-bearing sources", covered: "34 / 34", status: "complete" },
          { scope: "Site scopes", covered: "34 / 34", status: "complete" },
          { scope: "Missing scopes", covered: "0", status: "ready" },
        ],
      },
    ],
  },
  {
    id: "ai_actuary",
    name: "ai_actuary",
    description: "Invoke the ai_actuary reserving pipeline through the safe CLI executor.",
    project: {
      defaultSiblingPath: "../ai_actuary",
      envPath: "AI_ACTUARY_PROJECT_PATH",
      readiness: "not_configured",
    },
    execution: {
      adapterId: "ai_actuary.cli.v1",
      kind: "cli",
      requiredEnv: ["AI_ACTUARY_PROJECT_PATH"],
      supportsResume: false,
    },
    ui: {
      mode: "renderer",
      openOnTrigger: false,
      preferredRenderer: "json",
    },
    artifactKinds: ["actuary_run_json", "actuary_report"],
    interactionKinds: ["approval", "blocked"],
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string" },
        scenario: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        reportPath: { type: "string" },
      },
    },
    sampleInput: {
      scenario: "reserve-review",
    },
    sampleOutput: {
      status: "queued",
      reportPath: "reports/reserve-review.json",
    },
    sampleArtifacts: [
      {
        id: "ai_actuary_report_demo",
        title: "Actuary run JSON",
        kind: "actuary_run_json",
        renderer: "json",
        content: {
          status: "ready_when_configured",
          adapter: "ai_actuary.cli.v1",
        },
      },
    ],
  },
  {
    id: "example_reporter",
    name: "example_reporter",
    description: "Validation-only community manifest example.",
    project: {
      defaultSiblingPath: "skills/community/example_reporter",
      envPath: "EXAMPLE_REPORTER_ENABLED",
      readiness: "not_configured",
    },
    execution: {
      adapterId: "example_reporter.internal.v1",
      kind: "internal",
      requiredEnv: [],
      supportsResume: false,
    },
    ui: {
      mode: "renderer",
      openOnTrigger: false,
      preferredRenderer: "json",
    },
    artifactKinds: ["example_report"],
    interactionKinds: [],
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        report: { type: "object" },
      },
    },
    sampleInput: {
      title: "Example report",
    },
    sampleOutput: {
      report: "validation example",
    },
    sampleArtifacts: [
      {
        id: "example_report_demo",
        title: "Example report",
        kind: "example_report",
        renderer: "json",
        content: {
          source: "community",
          status: "sample",
        },
      },
    ],
  },
];

const moduleGuides: Record<ModuleId, CapabilityGuide> = {
  web_listening: {
    keyPrefix: "agentFirst.configure.guides.business.web_listening.",
  },
  doc_to_md: {
    keyPrefix: "agentFirst.configure.guides.business.doc_to_md.",
  },
  md_to_rag: {
    keyPrefix: "agentFirst.configure.guides.business.md_to_rag.",
  },
  rag_to_agent: {
    keyPrefix: "agentFirst.configure.guides.business.rag_to_agent.",
  },
  climate_monitor: {
    keyPrefix: "agentFirst.configure.guides.business.climate_monitor.",
  },
  ai_actuary: {
    keyPrefix: "agentFirst.configure.guides.business.ai_actuary.",
  },
  example_reporter: {
    keyPrefix: "agentFirst.configure.guides.business.example_reporter.",
  },
};

const generalSkillGuides: Record<GeneralSkillId, CapabilityGuide> = {
  web_search: {
    keyPrefix: "agentFirst.configure.guides.general.web_search.",
  },
  browser: {
    keyPrefix: "agentFirst.configure.guides.general.browser.",
  },
  github: {
    keyPrefix: "agentFirst.configure.guides.general.github.",
  },
  notion: {
    keyPrefix: "agentFirst.configure.guides.general.notion.",
  },
  lark: {
    keyPrefix: "agentFirst.configure.guides.general.lark.",
  },
  file_tools: {
    keyPrefix: "agentFirst.configure.guides.general.file_tools.",
  },
};

const configureGuides = {
  provider:
    "Controls which planner runtime the console talks to. Readiness is based on environment names only; plaintext keys and local base URLs stay server-side.",
  model:
    "Controls the model, reasoning effort, and system prompt that shape planning quality, tool choice, and response style.",
  memory:
    "Controls short-term thread memory and long-term Postgres memory so module outputs can become reusable context.",
  safety:
    "Controls approval points, self-learning behavior, publishing gates, and how many tool steps the Agent may take.",
  runtime:
    "Summarizes the current runtime contract: provider, active skills, memory mode, and safety posture.",
};

const plannerProviderOptions: Array<{
  provider: AgentProvider;
  label: string;
  defaultModelId: string;
}> = [
  { provider: "openai", label: "OpenAI", defaultModelId: "gpt-5.5" },
  {
    provider: "anthropic",
    label: "Anthropic",
    defaultModelId: "claude-3-5-sonnet-latest",
  },
  { provider: "ollama", label: "Ollama", defaultModelId: "llama3.1" },
  {
    provider: "deterministic",
    label: "Deterministic",
    defaultModelId: "deterministic-v1",
  },
];

const plannerModelOptions = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.2",
  "claude-3-5-sonnet-latest",
  "llama3.1",
  "deterministic-v1",
];

function defaultModelForProvider(provider: AgentProvider): string {
  return (
    plannerProviderOptions.find((option) => option.provider === provider)
      ?.defaultModelId ?? "gpt-5.5"
  );
}

function plannerProviderLabel(provider: AgentProvider): string {
  return (
    plannerProviderOptions.find((option) => option.provider === provider)?.label ??
    provider
  );
}

const businessSwitchGuides = ["enabled", "approval", "network", "dbWrite"] as const;

const generalSwitchGuides = ["enabled", "onDemand", "approval", "network"] as const;

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
    approvalRequired: module.id === "rag_to_agent" || module.id === "climate_monitor",
    canUseNetwork: module.id === "web_listening" || module.id === "climate_monitor",
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

const mockClimateMonitorStatus: ClimateMonitorStatus = {
  configured: false,
  latestReport: {
    id: "climate-monitor-2026-05-14",
    title: "Daily Climate & Actuarial Monitor - 2026-05-14",
    status: "ready",
    generatedAt: "2026-05-14",
    summary: "Latest summary covers climate-related website and report changes from monitored supranational sources.",
  },
  scopeCoverage: [
    { label: "Source registry", covered: 34, total: 34, status: "complete" },
    { label: "Scoped sources", covered: 34, total: 34, status: "complete" },
    { label: "Missing scopes", covered: 0, total: 34, status: "ready" },
  ],
  warnings: [
    {
      id: "cm-warn-live-disabled",
      label: "Live runs disabled",
      severity: "warning",
      detail: "Dry-run is available; live execution requires explicit server-side enablement.",
    },
    {
      id: "cm-warn-api-fallback",
      label: "Local fallback",
      severity: "info",
      detail: "The panel uses mock status until the ai_interface API is reachable.",
    },
  ],
  dedup: {
    candidates: 5,
    merged: 5,
    pending: 0,
    lastChecked: "2026-05-14",
  },
  updatedAt: "2026-05-14",
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
  {
    id: "climate",
    moduleId: "climate_monitor",
    title: "Climate monitor ops check",
    detail: "Latest report, scope coverage, warnings, and dedup state are ready for Backstage review.",
    status: "waiting",
    time: "On demand",
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
  {
    id: "run-climate-monitor-014",
    moduleId: "climate_monitor",
    title: "Checked climate monitor ops",
    status: "skipped",
    adapterId: "climate_monitor.cli.v1",
    adapterKind: "cli",
    externalRunId: "climate-monitor-014",
    event: "Dry-run is available after the Climate Monitor project path is configured.",
    resultRecordIds: ["climate_monitor_report_014"],
    missingRequiredEnv: ["CLIMATE_MONITOR_PROJECT_PATH"],
    updatedAt: "08:20",
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
  {
    id: "climate_monitor_report_014",
    kind: "climate_monitor_report",
    title: "Daily Climate & Actuarial Monitor",
    moduleId: "climate_monitor",
    summary: "Climate-related source changes, document links, and actuarial research matches are summarized for operator review.",
    updatedAt: "08:20",
  },
];

const navItems: Array<{ id: AppView; labelKey: string; icon: ReactNode }> = [
  { id: "agent", labelKey: "agentFirst.nav.agent", icon: <Bot size={18} /> },
  { id: "modules", labelKey: "agentFirst.nav.modules", icon: <Boxes size={18} /> },
  { id: "progress", labelKey: "agentFirst.nav.progress", icon: <ListChecks size={18} /> },
  { id: "data", labelKey: "agentFirst.nav.data", icon: <Database size={18} /> },
  { id: "configure", labelKey: "agentFirst.nav.configure", icon: <Settings2 size={18} /> },
  { id: "publish", labelKey: "agentFirst.nav.publish", icon: <UploadCloud size={18} /> },
];

function previewUrl(componentPath: string, search = ""): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${basePath}/preview/${componentPath}${search}`;
}

const PORTAL_DEMO_TOKEN = "portal-demo-token";

function portalPreviewUrl(token: string): string {
  const trimmed = token.trim();
  const search = trimmed
    ? `?token=${encodeURIComponent(trimmed)}`
    : `?token=${encodeURIComponent(PORTAL_DEMO_TOKEN)}`;
  return previewUrl("ai-os/AgentPortalInterface", search);
}

function agentFirstMessage(
  key: string,
  values?: AgentFirstMessageValues,
): AgentFirstLocalizedMessage {
  return values ? { key, values } : { key };
}

function translateAgentFirstMessage(
  t: TFunction,
  message: AgentFirstLocalizedMessage,
): string {
  return t(message.key, message.values);
}

function statusLabel(status: RunStatus, t: TFunction): string {
  return t(`agentFirst.status.run.${status}`);
}

function statusClass(status: RunStatus): string {
  return `status-dot ${status}`;
}

function runtimeStatusLabel(status: RuntimeRunStatus, t: TFunction): string {
  return t(`agentFirst.status.runtime.${status}`);
}

const reasoningEffortLabelKeys: Record<AgentReasoningEffort, string> = {
  none: "agentFirst.configure.reasoningEffort.none",
  low: "agentFirst.configure.reasoningEffort.low",
  medium: "agentFirst.configure.reasoningEffort.medium",
  high: "agentFirst.configure.reasoningEffort.high",
  xhigh: "agentFirst.configure.reasoningEffort.xhigh",
};

function reasoningEffortLabel(
  effort: AgentReasoningEffort,
  t: TFunction,
): string {
  return t(reasoningEffortLabelKeys[effort]);
}

const memoryPromotionLabelKeys: Record<MemoryPromotionMode, string> = {
  agent_suggested: "agentFirst.configure.memoryPromotion.agent_suggested",
  manual: "agentFirst.configure.memoryPromotion.manual",
};

function memoryPromotionLabel(
  mode: MemoryPromotionMode,
  t: TFunction,
): string {
  return t(memoryPromotionLabelKeys[mode]);
}

function runtimeStatusClass(status: RuntimeRunStatus): string {
  return `runtime-status ${status}`;
}

function moduleById(moduleId: ModuleId): ModuleDefinition {
  return modules.find((item) => item.id === moduleId) ?? modules[0]!;
}

function isModuleId(value: string): value is ModuleId {
  return modules.some((module) => module.id === value);
}

function skillManifestById(
  skillId: ModuleId,
  catalog: SkillManifestPreview[] = skillManifestPreviews,
): SkillManifestPreview {
  return catalog.find((item) => item.id === skillId) ?? catalog[0] ?? skillManifestPreviews[0]!;
}

function hasBackstageSkillUi(skill: SkillManifestPreview): boolean {
  return skill.id === "climate_monitor" || Boolean(skill.ui.htmlEntrypoint);
}

function backstageUiLabel(skill: SkillManifestPreview, t: TFunction): string {
  if (skill.id === "climate_monitor") return t("agentFirst.backstage.ui.opsPanel");
  return skill.ui.htmlEntrypoint
    ? t("agentFirst.backstage.ui.htmlTab")
    : skill.ui.preferredRenderer;
}

function shouldOpenBackstageForRun(run: RuntimeModuleRun): boolean {
  const manifest = skillManifestById(run.moduleId);
  return (
    manifest.ui.openOnTrigger &&
    (run.status === "approval_required" ||
      run.status === "waiting_for_user" ||
      run.status === "waiting_for_data" ||
      run.status === "blocked")
  );
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

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringFromObject(value: JsonObject, key: string, fallback: string): string {
  const field = value[key];
  return typeof field === "string" ? field : fallback;
}

function numberFromObject(value: JsonObject, key: string, fallback: number): number {
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field) ? field : fallback;
}

function booleanFromObject(value: JsonObject, key: string, fallback: boolean): boolean {
  const field = value[key];
  return typeof field === "boolean" ? field : fallback;
}

function stringFromNullableObject(
  value: JsonObject,
  key: string,
  fallback: string,
  nullFallback: string,
): string {
  return Object.prototype.hasOwnProperty.call(value, key) && value[key] === null
    ? nullFallback
    : stringFromObject(value, key, fallback);
}

function climateWarningSeverity(value: unknown): ClimateWarningSeverity {
  if (value === "critical" || value === "warning" || value === "info") return value;
  return "info";
}

function climateStatusRoot(payload: unknown): JsonObject | null {
  if (!isJsonObject(payload)) return null;
  if (isJsonObject(payload["status"])) return payload["status"];
  if (isJsonObject(payload["climateMonitor"])) return payload["climateMonitor"];
  return payload;
}

function reportIdFromPath(path: string, fallback: string): string {
  const filename = path.split(/[\\/]/).pop();
  return filename?.replace(/\.md$/i, "") || fallback;
}

function climateReportFallback(fallback: ClimateReport | null): ClimateReport {
  return (
    fallback ?? {
      id: "climate-monitor-run",
      title: "Climate monitor run",
      status: "pending",
      generatedAt: climateTimestamp(),
      summary: "Climate monitor report metadata is not available yet.",
    }
  );
}

function normalizeClimateReport(
  value: unknown,
  fallback: ClimateReport | null,
  root?: JsonObject,
): ClimateReport | null {
  if (!isJsonObject(value)) return fallback;

  const reportFallback = climateReportFallback(fallback);
  const path = stringFromObject(value, "path", "");
  const date = stringFromObject(
    value,
    "date",
    stringFromObject(value, "report_date", reportFallback.generatedAt),
  );
  const project = root && isJsonObject(root["project"]) ? root["project"] : null;
  const command = root && isJsonObject(root["command"]) ? root["command"] : null;
  const dryRun = command ? booleanFromObject(command, "dryRun", true) : true;

  return {
    id: stringFromObject(
      value,
      "id",
      stringFromObject(
        value,
        "reportId",
        reportIdFromPath(stringFromObject(value, "report_path", path), reportFallback.id),
      ),
    ),
    title: stringFromNullableObject(
      value,
      "title",
      reportFallback.title,
      "Untitled climate report",
    ),
    status: stringFromObject(
      value,
      "status",
      command
        ? dryRun
          ? "dry-run completed"
          : "live run completed"
        : project
          ? stringFromObject(project, "status", reportFallback.status)
          : reportFallback.status,
    ),
    generatedAt: stringFromObject(
      value,
      "generatedAt",
      stringFromObject(value, "generated_at", date),
    ),
    summary: stringFromNullableObject(
      value,
      "summary",
      reportFallback.summary,
      "No summary was returned by the Climate Monitor API.",
    ),
  };
}

function normalizeBackendCoverage(
  value: JsonObject,
  fallback: ClimateScopeCoverage[],
): ClimateScopeCoverage[] {
  const sourceCount = numberFromObject(value, "sourceCount", 0);
  const scopeCount = numberFromObject(value, "scopeCount", 0);
  const scopedSourceCount = numberFromObject(value, "scopedSourceCount", 0);
  const missingScopeCount = numberFromObject(value, "missingScopeCount", 0);
  const status = stringFromObject(value, "status", "unknown");
  const hasCoverageFields = [
    "sourceCount",
    "scopeCount",
    "scopedSourceCount",
    "missingScopeCount",
    "status",
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
  if (!hasCoverageFields) return fallback;

  return [
    {
      label: "Source registry",
      covered: sourceCount,
      total: sourceCount,
      status,
    },
    {
      label: "Scoped sources",
      covered: scopedSourceCount,
      total: sourceCount,
      status,
    },
    {
      label: "Site scopes",
      covered: scopeCount,
      total: sourceCount,
      status,
    },
    {
      label: "Missing scopes",
      covered: missingScopeCount,
      total: sourceCount,
      status: missingScopeCount > 0 ? "review" : "ready",
    },
  ];
}

function normalizeClimateScopeCoverage(
  value: unknown,
  fallback: ClimateScopeCoverage[],
): ClimateScopeCoverage[] {
  if (isJsonObject(value)) return normalizeBackendCoverage(value, fallback);
  if (!Array.isArray(value)) return fallback;

  const normalized = value.flatMap((item, index) => {
    if (!isJsonObject(item)) return [];
    const fallbackItem = fallback[index] ?? {
      label: "Scope",
      covered: 0,
      total: 0,
      status: "unknown",
    };

    return [
      {
        label: stringFromObject(
          item,
          "label",
          stringFromObject(item, "scope", fallbackItem.label),
        ),
        covered: numberFromObject(item, "covered", fallbackItem.covered),
        total: numberFromObject(item, "total", fallbackItem.total),
        status: stringFromObject(item, "status", fallbackItem.status),
      },
    ];
  });

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeClimateWarnings(
  value: unknown,
  fallback: ClimateWarningPlaceholder[],
): ClimateWarningPlaceholder[] {
  if (!Array.isArray(value)) return fallback;
  if (value.length === 0) return [];

  const normalized = value.flatMap((item, index) => {
    if (typeof item === "string") {
      return [
        {
          id: `cm-warning-${index}`,
          label: "Run warning",
          severity: "warning" as const,
          detail: item,
        },
      ];
    }
    if (!isJsonObject(item)) return [];
    const fallbackItem = fallback[index] ?? {
      id: `cm-warning-${index}`,
      label: "Warning placeholder",
      severity: "info" as const,
      detail: "Pending review",
    };

    return [
      {
        id: stringFromObject(item, "id", fallbackItem.id),
        label: stringFromObject(item, "label", fallbackItem.label),
        severity: climateWarningSeverity(item["severity"]),
        detail: stringFromObject(item, "detail", fallbackItem.detail),
      },
    ];
  });

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeClimateRunParsedReport(
  parsed: JsonObject,
  root: JsonObject,
  fallback: ClimateReport | null,
): ClimateReport {
  const reportFallback = climateReportFallback(fallback);
  const items = Array.isArray(parsed["items"]) ? parsed["items"].length : 0;
  const reportDate = stringFromObject(parsed, "report_date", reportFallback.generatedAt);
  const reportPath = stringFromObject(parsed, "report_path", reportFallback.id);
  return normalizeClimateReport(
    {
      id: reportIdFromPath(reportPath, reportFallback.id),
      title: `Climate monitor run - ${reportDate}`,
      report_date: reportDate,
      report_path: reportPath,
      summary:
        items === 1
          ? "1 climate-related item matched the run filters."
          : `${items} climate-related items matched the run filters.`,
    },
    reportFallback,
    root,
  ) ?? reportFallback;
}

function normalizeClimateDedup(
  value: unknown,
  fallback: ClimateDedupStatus,
): ClimateDedupStatus {
  if (!isJsonObject(value)) return fallback;

  return {
    candidates: numberFromObject(value, "candidates", fallback.candidates),
    merged: numberFromObject(value, "merged", fallback.merged),
    pending: numberFromObject(value, "pending", fallback.pending),
    lastChecked: stringFromObject(
      value,
      "lastChecked",
      stringFromObject(value, "last_checked", fallback.lastChecked),
    ),
  };
}

function normalizeClimateMonitorStatus(
  payload: unknown,
  fallback: ClimateMonitorStatus = mockClimateMonitorStatus,
): ClimateMonitorStatus {
  const root = climateStatusRoot(payload);
  if (!root) return fallback;

  const parsedRun = isJsonObject(root["parsed"]) ? root["parsed"] : null;
  const latestReportValue =
    root["latestReport"] !== undefined
      ? root["latestReport"]
      : root["latest_report"] !== undefined
        ? root["latest_report"]
        : root["report"] !== undefined
          ? root["report"]
          : parsedRun;
  const scopeCoverageValue =
    root["scopeCoverage"] ?? root["scope_coverage"] ?? root["coverage"];
  const project = isJsonObject(root["project"]) ? root["project"] : null;

  return {
    configured: booleanFromObject(
      root,
      "configured",
      project
        ? stringFromObject(project, "status", "") === "ready"
        : booleanFromObject(root, "liveConfigured", fallback.configured),
    ),
    latestReport: parsedRun
      ? normalizeClimateRunParsedReport(parsedRun, root, fallback.latestReport)
      : latestReportValue === null
        ? null
      : normalizeClimateReport(latestReportValue, fallback.latestReport, root),
    scopeCoverage: normalizeClimateScopeCoverage(
      scopeCoverageValue,
      fallback.scopeCoverage,
    ),
    warnings: normalizeClimateWarnings(
      parsedRun?.["warnings"] ?? root["warnings"],
      fallback.warnings,
    ),
    dedup: normalizeClimateDedup(
      root["dedup"] ?? root["deduplication"],
      fallback.dedup,
    ),
    updatedAt: stringFromObject(
      root,
      "updatedAt",
      stringFromObject(
        root,
        "updated_at",
        parsedRun
          ? stringFromObject(parsedRun, "report_date", fallback.updatedAt)
          : isJsonObject(latestReportValue)
            ? stringFromObject(latestReportValue, "date", fallback.updatedAt)
            : fallback.updatedAt,
      ),
    ),
  };
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

function isToolInteractionOptionApi(
  value: unknown,
): value is ToolInteractionOptionApi {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["label"] === "string"
  );
}

function parseToolInteractionFeedback(
  value: unknown,
): ToolInteractionFeedbackApi | undefined {
  if (!isRecord(value)) return undefined;
  const artifactIds = stringArrayValue(value["artifactIds"]);
  const metadata = isJsonObject(value["metadata"]) ? value["metadata"] : {};
  return {
    responseText:
      typeof value["responseText"] === "string"
        ? value["responseText"]
        : undefined,
    selectedOptionId:
      typeof value["selectedOptionId"] === "string"
        ? value["selectedOptionId"]
        : undefined,
    approved: typeof value["approved"] === "boolean" ? value["approved"] : undefined,
    artifactIds,
    resumeHandle:
      typeof value["resumeHandle"] === "string"
        ? value["resumeHandle"]
        : undefined,
    metadata,
  };
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
    options: Array.isArray(interaction["options"])
      ? interaction["options"].filter(isToolInteractionOptionApi)
      : [],
    artifactIds: stringArrayValue(interaction["artifactIds"]),
    resumeHandle:
      typeof interaction["resumeHandle"] === "string"
        ? interaction["resumeHandle"]
        : null,
    requestedBy:
      typeof interaction["requestedBy"] === "string"
        ? interaction["requestedBy"]
        : null,
    requestedAt: interaction["requestedAt"],
    metadata:
      interaction["metadata"] &&
      typeof interaction["metadata"] === "object" &&
      !Array.isArray(interaction["metadata"])
        ? (interaction["metadata"] as JsonObject)
        : {},
    respondedAt:
      typeof interaction["respondedAt"] === "string"
        ? interaction["respondedAt"]
        : undefined,
    response: parseToolInteractionFeedback(interaction["response"]),
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
  const adapterKind = stringFromMetadata(run.metadata, "adapterKind", "http");

  return {
    id: run.id,
    moduleId: run.moduleId,
    title: run.title ?? moduleById(run.moduleId).name,
    status: runtimeStatusFromApiRun(run),
    adapterId: stringFromMetadata(run.metadata, "adapterId", `${run.moduleId}.adapter`),
    adapterKind:
      adapterKind === "cli" ||
      adapterKind === "http" ||
      adapterKind === "mcp" ||
      adapterKind === "internal"
        ? adapterKind
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

function connectionLabel(status: AgentConnectionStatus, t: TFunction): string {
  return t(`agentFirst.status.connection.${status}`);
}

function agentRunStateLabel(state: AgentRunSubmitState, t: TFunction): string {
  return t(`agentFirst.status.agentRun.${state}`);
}

function agentRunApiStatusLabel(
  status: AgentRunApiResponse["status"],
  t: TFunction,
): string {
  return t(`agentFirst.status.agentRunApi.${status}`);
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function artifactRendererValue(value: unknown): ArtifactRendererKind {
  if (
    value === "markdown" ||
    value === "table" ||
    value === "json" ||
    value === "text" ||
    value === "image" ||
    value === "file"
  ) {
    return value;
  }
  return "json";
}

function executionKindValue(value: unknown): "cli" | "http" | "internal" | "mcp" {
  if (value === "cli" || value === "http" || value === "internal" || value === "mcp") {
    return value;
  }
  return "internal";
}

function uiModeValue(value: unknown): "html" | "renderer" | "auto" {
  if (value === "html" || value === "renderer" || value === "auto") return value;
  return "renderer";
}

function normalizeSkillPreviews(payload: unknown): SkillManifestPreview[] {
  if (!isRecord(payload) || !Array.isArray(payload["skills"])) return [];
  const readinessBySkillId = new Map<string, "ready" | "not_configured">();
  if (Array.isArray(payload["readiness"])) {
    for (const item of payload["readiness"]) {
      if (!isRecord(item)) continue;
      const skillId = nullableString(item["skillId"]);
      const project = isRecord(item["project"]) ? item["project"] : {};
      const status = project["status"] === "ready" ? "ready" : "not_configured";
      if (skillId) readinessBySkillId.set(skillId, status);
    }
  }

  return payload["skills"].flatMap((item): SkillManifestPreview[] => {
    if (!isRecord(item)) return [];
    const rawId = nullableString(item["moduleId"]) ?? nullableString(item["skillId"]);
    if (!rawId || !isModuleId(rawId)) return [];

    const existing = skillManifestById(rawId);
    const project = isRecord(item["project"]) ? item["project"] : {};
    const execution = isRecord(item["execution"]) ? item["execution"] : {};
    const ui = isRecord(item["ui"]) ? item["ui"] : {};

    return [
      {
        ...existing,
        id: rawId,
        name: nullableString(item["name"]) ?? existing.name,
        description: nullableString(item["description"]) ?? existing.description,
        project: {
          source: nullableString(project["source"]) ?? existing.project.source,
          defaultSiblingPath:
            nullableString(project["defaultSiblingPath"]) ??
            existing.project.defaultSiblingPath,
          envPath: nullableString(project["envPath"]) ?? existing.project.envPath,
          readiness: readinessBySkillId.get(rawId) ?? existing.project.readiness,
        },
        execution: {
          adapterId: nullableString(execution["adapterId"]) ?? existing.execution.adapterId,
          kind: executionKindValue(execution["kind"]),
          requiredEnv:
            stringArrayValue(execution["requiredEnv"]).length > 0
              ? stringArrayValue(execution["requiredEnv"])
              : existing.execution.requiredEnv,
          supportsResume:
            typeof execution["supportsResume"] === "boolean"
              ? execution["supportsResume"]
              : existing.execution.supportsResume,
        },
        ui: {
          mode: uiModeValue(ui["mode"]),
          htmlEntrypoint:
            nullableString(ui["htmlEntrypoint"]) ?? existing.ui.htmlEntrypoint,
          openOnTrigger:
            typeof ui["openOnTrigger"] === "boolean"
              ? ui["openOnTrigger"]
              : existing.ui.openOnTrigger,
          preferredRenderer: artifactRendererValue(ui["preferredRenderer"]),
        },
        artifactKinds:
          stringArrayValue(item["artifactKinds"]).length > 0
            ? stringArrayValue(item["artifactKinds"])
            : existing.artifactKinds,
        interactionKinds: stringArrayValue(item["interactionKinds"]).filter(
          (kind): kind is "question" | "approval" | "data_request" | "blocked" =>
            isInteractionKind(kind),
        ),
        inputSchema: isJsonObject(item["inputSchema"]) ? item["inputSchema"] : existing.inputSchema,
        outputSchema: isJsonObject(item["outputSchema"])
          ? item["outputSchema"]
          : existing.outputSchema,
      },
    ];
  });
}

function isWorkbenchRunStatus(value: unknown): value is WorkbenchRunStatus {
  return (
    value === "pending" ||
    value === "queued" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "approval_required" ||
    value === "waiting_for_user" ||
    value === "waiting_for_data" ||
    value === "blocked" ||
    value === "skipped"
  );
}

function normalizeWorkbenchRunStatus(value: unknown): WorkbenchRunStatus {
  if (isWorkbenchRunStatus(value)) return value;
  if (value === "done") return "succeeded";
  if (value === "waiting") return "waiting_for_user";
  return "queued";
}

function toWorkbenchRunFromAgentRun(
  response: AgentRunApiResponse,
  fallbackAgentId?: string,
): WorkbenchRunInspection {
  const metadataAgentId = isJsonObject(response.pipelineRun.metadata)
    ? nullableString(response.pipelineRun.metadata["agentId"])
    : null;
  const moduleSteps = response.moduleRuns.map((run, index) => ({
    id: run.id,
    order: index + 1,
    moduleId: run.moduleId,
    title: run.title ?? run.moduleId,
    status: normalizeWorkbenchRunStatus(run.status),
    summary: run.summary ?? run.externalRunId,
    activeSkillId: run.status === "running" ? run.moduleId : undefined,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  }));
  const activeStep = moduleSteps.find((step) => step.status === "running");

  return {
    pipelineRunId: response.pipelineRun.id,
    title: response.pipelineRun.title,
    agentId: metadataAgentId ?? fallbackAgentId,
    status: normalizeWorkbenchRunStatus(response.pipelineRun.status),
    activeSkillId: activeStep?.moduleId,
    updatedAt: response.pipelineRun.updatedAt,
    moduleSteps,
    events: response.moduleRuns.map((run) => ({
      id: `${run.id}-event`,
      time: run.updatedAt,
      type: run.moduleId,
      status: normalizeWorkbenchRunStatus(run.status),
      title: run.title ?? run.moduleId,
      detail: run.summary ?? run.externalRunId,
    })),
    raw: response,
  };
}

function isLocalWorkbenchRunRaw(value: unknown): value is LocalWorkbenchRunRaw {
  return (
    isRecord(value) &&
    value["source"] === "local-demo" &&
    typeof value["agentId"] === "string" &&
    (value["agentNameKey"] === null ||
      typeof value["agentNameKey"] === "string") &&
    typeof value["agentNameFallback"] === "string" &&
    typeof value["pipelineRunId"] === "string" &&
    Array.isArray(value["skillIds"]) &&
    value["skillIds"].every((item) => typeof item === "string")
  );
}

function localWorkbenchAgentNameKey(agentId: string): string | null {
  if (agentId === "knowledge_builder") {
    return "agentFirst.workbenchDemo.agents.knowledgeBuilder.name";
  }
  if (agentId === "climate_briefing_agent") {
    return "agentFirst.workbenchDemo.agents.climateBriefing.name";
  }
  return null;
}

function localizeLocalWorkbenchRun(
  raw: LocalWorkbenchRunRaw,
  t: TFunction,
): WorkbenchRunInspection {
  const agentName = raw.agentNameKey
    ? t(raw.agentNameKey)
    : raw.agentNameFallback;

  return {
    pipelineRunId: raw.pipelineRunId,
    title: t("agentFirst.workbenchDemo.localRun.title", {
      agentName,
    }),
    agentId: raw.agentId,
    status: "queued",
    activeSkillId: raw.skillIds[0],
    updatedAt: t("agentFirst.workbenchDemo.localRun.updatedAt"),
    moduleSteps: raw.skillIds.map((skillId, index) => ({
      id: `${raw.pipelineRunId}_${skillId}`,
      order: index + 1,
      moduleId: skillId,
      title: skillId,
      status: index === 0 ? "queued" : "pending",
      summary:
        index === 0
          ? t("agentFirst.workbenchDemo.localRun.firstStepSummary")
          : t("agentFirst.workbenchDemo.localRun.waitingSummary"),
      activeSkillId: index === 0 ? skillId : undefined,
    })),
    events: [
      {
        id: `${raw.pipelineRunId}_queued`,
        time: t("agentFirst.workbenchDemo.localRun.updatedAt"),
        type: "agent-run",
        status: "queued",
        title: t("agentFirst.workbenchDemo.localRun.eventTitle"),
        detail: t("agentFirst.workbenchDemo.localRun.eventDetail"),
      },
    ],
    raw,
  };
}

function createLocalWorkbenchRun(
  agentId: string,
  agents: AgentManifestPreview[],
  t: TFunction,
): WorkbenchRunInspection {
  const agent = agents.find((item) => item.agentId === agentId);
  const skillIds = agent?.skills.map((skill) => skill.skillId) ?? ["md_to_rag", "rag_to_agent"];
  const pipelineRunId = `local_${agentId}_${Date.now()}`;
  const agentNameKey = localWorkbenchAgentNameKey(agentId);
  const raw: LocalWorkbenchRunRaw = {
    source: "local-demo",
    agentId,
    agentNameKey,
    agentNameFallback: agentNameKey ? agentId : (agent?.title ?? agent?.name ?? agentId),
    pipelineRunId,
    skillIds,
  };

  return localizeLocalWorkbenchRun(raw, t);
}

function runtimeStatusFromWorkbenchStatus(status: WorkbenchRunStatus): RuntimeRunStatus {
  if (status === "succeeded") return "succeeded";
  if (status === "running") return "running";
  if (status === "approval_required") return "approval_required";
  if (status === "waiting_for_user") return "waiting_for_user";
  if (status === "waiting_for_data") return "waiting_for_data";
  if (status === "blocked" || status === "failed" || status === "cancelled") {
    return "blocked";
  }
  if (status === "skipped") return "skipped";
  return "queued";
}

function toLocalRuntimeRuns(run: WorkbenchRunInspection): RuntimeModuleRun[] {
  return run.moduleSteps.flatMap((step): RuntimeModuleRun[] => {
    if (!isModuleId(step.moduleId)) return [];
    return [
      {
        id: step.id,
        moduleId: step.moduleId,
        title: step.title,
        status: runtimeStatusFromWorkbenchStatus(step.status),
        adapterId: `${step.moduleId}.local`,
        adapterKind: "cli",
        externalRunId: run.pipelineRunId,
        event: step.summary,
        resultRecordIds: [],
        missingRequiredEnv: [],
        updatedAt: step.startedAt ?? step.completedAt ?? run.updatedAt,
      },
    ];
  });
}

function normalizeApiRuns(payload: unknown): WorkbenchRunInspection[] {
  if (!isRecord(payload) || !Array.isArray(payload["runs"])) return [];

  return payload["runs"].flatMap((item): WorkbenchRunInspection[] => {
    if (!isRecord(item) || !isRecord(item["pipelineRun"])) return [];
    const pipelineRun = item["pipelineRun"];
    const moduleRuns = Array.isArray(item["moduleRuns"]) ? item["moduleRuns"] : [];
    const metadata = isJsonObject(pipelineRun["metadata"]) ? pipelineRun["metadata"] : {};
    const pipelineRunId = nullableString(pipelineRun["id"]) ?? "api-run";
    const steps = moduleRuns.flatMap((run, index) => {
      if (!isRecord(run)) return [];
      const moduleId = nullableString(run["moduleId"]) ?? "module";
      const status = normalizeWorkbenchRunStatus(run["status"]);
      return [
        {
          id: nullableString(run["id"]) ?? `${pipelineRunId}-${index}`,
          order: index + 1,
          moduleId,
          title: nullableString(run["title"]) ?? moduleId,
          status,
          summary:
            nullableString(run["summary"]) ??
            nullableString(run["externalRunId"]) ??
            "Module run",
          activeSkillId: status === "running" ? moduleId : undefined,
          startedAt: nullableString(run["startedAt"]),
          completedAt: nullableString(run["completedAt"]),
        },
      ];
    });
    const activeStep = steps.find((step) => step.status === "running");

    return [
      {
        pipelineRunId,
        title: nullableString(pipelineRun["title"]) ?? "Agent run",
        agentId: nullableString(metadata["agentId"]) ?? undefined,
        status: normalizeWorkbenchRunStatus(pipelineRun["status"]),
        activeSkillId: activeStep?.moduleId,
        updatedAt: nullableString(pipelineRun["updatedAt"]) ?? "API",
        moduleSteps: steps,
        events: steps.map((step) => ({
          id: `${step.id}-event`,
          time: step.startedAt ?? step.completedAt ?? "API",
          type: step.moduleId,
          status: step.status,
          title: step.title,
          detail: step.summary,
        })),
        raw: item,
      },
    ];
  });
}

function normalizeApiArtifacts(
  payload: unknown,
  context?: {
    pipelineRunId?: string;
    pipelineTitle?: string;
  },
): WorkbenchArtifactPipelineGroup[] {
  if (!isRecord(payload) || !Array.isArray(payload["artifacts"])) return [];

  const groups = new Map<string, WorkbenchArtifactPipelineGroup>();
  for (const item of payload["artifacts"]) {
    if (!isRecord(item)) continue;
    const provenance = isJsonObject(item["provenance"]) ? item["provenance"] : {};
    const pipelineRunId =
      context?.pipelineRunId ??
      nullableString(provenance["pipelineRunId"]) ??
      nullableString(provenance["pipeline_run_id"]) ??
      "api-artifacts";
    const moduleRunId = nullableString(item["sourceRunId"]) ?? "module-run";
    const moduleId = nullableString(item["sourceModuleId"]) ?? "module";
    const artifact: WorkbenchArtifact = {
      id: nullableString(item["id"]) ?? `${moduleRunId}-artifact`,
      title: nullableString(item["title"]) ?? "Artifact",
      kind: nullableString(item["artifactKind"]) ?? "artifact",
      summary:
        nullableString(item["contentText"]) ??
        (isJsonObject(item["contentJson"]) ? "JSON artifact" : "Stored artifact"),
      moduleRunId,
      moduleId,
      createdAt: nullableString(item["createdAt"]) ?? "API",
      content: item["contentJson"] ?? item["contentText"],
      raw: item,
    };

    const pipeline =
      groups.get(pipelineRunId) ??
      {
        pipelineRunId,
        title:
          context?.pipelineTitle ??
          (pipelineRunId === "api-artifacts" ? "API artifacts" : `Pipeline ${pipelineRunId}`),
        moduleGroups: [],
      };
    const moduleGroup =
      pipeline.moduleGroups.find((group) => group.moduleRunId === moduleRunId) ??
      {
        moduleRunId,
        moduleId,
        artifacts: [],
      };
    moduleGroup.artifacts.push(artifact);
    if (!pipeline.moduleGroups.includes(moduleGroup)) {
      pipeline.moduleGroups.push(moduleGroup);
    }
    groups.set(pipelineRunId, pipeline);
  }

  return Array.from(groups.values());
}

export function AgentFirstInterface() {
  const { t, i18n } = useTranslation();
  const demoWorkbenchData = useMemo(
    () => createAgentFirstWorkbenchDemoData(t),
    [t],
  );
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("mission");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [activeView, setActiveView] = useState<AppView>("agent");
  const [selectedModuleId, setSelectedModuleId] = useState<ModuleId>("md_to_rag");
  const [selectedSkillId, setSelectedSkillId] = useState<ModuleId>("rag_to_agent");
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>("agents");
  const [selectedAgentId, setSelectedAgentId] = useState("knowledge_builder");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    demoWorkbenchData.demoRunInspections[0]?.pipelineRunId ?? null,
  );
  const [backstageTab, setBackstageTab] = useState<BackstageTab>("ui");
  const [usesDemoAgents, setUsesDemoAgents] = useState(true);
  const [usesDemoAgentReadiness, setUsesDemoAgentReadiness] = useState(true);
  const [usesDemoRuns, setUsesDemoRuns] = useState(true);
  const [usesDemoArtifacts, setUsesDemoArtifacts] = useState(true);
  const [localAgents, setLocalAgents] = useState<AgentManifestPreview[]>([]);
  const [localAgentReadiness, setLocalAgentReadiness] = useState<
    AgentReadiness[]
  >([]);
  const [localWorkbenchRuns, setLocalWorkbenchRuns] = useState<
    WorkbenchRunInspection[]
  >([]);
  const [agents, setAgents] = useState<AgentManifestPreview[]>(
    () => demoWorkbenchData.demoAgentManifests,
  );
  const [agentReadiness, setAgentReadiness] =
    useState<AgentReadiness[]>(() => demoWorkbenchData.demoAgentReadiness);
  const [workbenchRuns, setWorkbenchRuns] =
    useState<WorkbenchRunInspection[]>(
      () => demoWorkbenchData.demoRunInspections,
    );
  const [artifactGroups, setArtifactGroups] =
    useState<WorkbenchArtifactPipelineGroup[]>(
      () => demoWorkbenchData.demoArtifactGroups,
    );
  const [skillCatalog, setSkillCatalog] =
    useState<SkillManifestPreview[]>(skillManifestPreviews);
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
  const [publishPreviewToken, setPublishPreviewToken] =
    useState(PORTAL_DEMO_TOKEN);
  const [publishSaveState, setPublishSaveState] =
    useState<PublishSaveState>("local");
  const [publishStatusMessage, setPublishStatusMessage] = useState(
    agentFirstMessage("agentFirst.statusMessages.localPublishSettings"),
  );
  const [connectionStatus, setConnectionStatus] =
    useState<AgentConnectionStatus>("offline");
  const [connectionPayload, setConnectionPayload] =
    useState<AgentConnectionPayload | null>(null);
  const [configStatusMessage, setConfigStatusMessage] = useState(
    agentFirstMessage("agentFirst.statusMessages.localDraft"),
  );
  const [isConfigBusy, setIsConfigBusy] = useState(false);
  const [agentRunState, setAgentRunState] =
    useState<AgentRunSubmitState>("local");
  const [agentRunStatusMessage, setAgentRunStatusMessage] = useState(
    agentFirstMessage("agentFirst.statusMessages.localMockRuntime"),
  );
  const [latestAgentRun, setLatestAgentRun] =
    useState<AgentRunUiState | null>(null);
  const [localFallbackRuntimeRuns, setLocalFallbackRuntimeRuns] =
    useState<RuntimeModuleRun[] | null>(null);
  const [runtimeActionStates, setRuntimeActionStates] =
    useState<Record<string, RuntimeActionState>>({});
  const [runtimeActionNoticeMessage, setRuntimeActionNoticeMessage] = useState(
    agentFirstMessage("agentFirst.statusMessages.runtimeActionsLocal"),
  );
  const [runtimeActionStatusMessages, setRuntimeActionStatusMessages] =
    useState<Record<string, AgentFirstLocalizedMessage>>({});
  const submitCommandInFlightRef = useRef(false);
  const workbenchTestRunInFlightRef = useRef(false);
  const backstageAutoOpenRunIdRef = useRef<string | null>(null);

  const selectedModule = moduleById(selectedModuleId);
  const selectedSkillManifest = skillManifestById(selectedSkillId, skillCatalog);
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agentId === selectedAgentId) ?? agents[0]!,
    [agents, selectedAgentId],
  );
  const displayedRuntimeRuns =
    latestAgentRun?.runtimeRuns ?? localFallbackRuntimeRuns ?? mockRuntimeRuns;
  const configStatusText = translateAgentFirstMessage(t, configStatusMessage);
  const publishStatusText = translateAgentFirstMessage(t, publishStatusMessage);
  const agentRunStatusText = translateAgentFirstMessage(t, agentRunStatusMessage);
  const runtimeActionNoticeText = translateAgentFirstMessage(
    t,
    runtimeActionNoticeMessage,
  );
  const runtimeActionStatusTexts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(runtimeActionStatusMessages).map(([runId, message]) => [
          runId,
          translateAgentFirstMessage(t, message),
        ]),
      ),
    [runtimeActionStatusMessages, t],
  );
  const filteredRecords = useMemo(
    () =>
      selectedRecordKind === "all"
        ? dataRecords
        : dataRecords.filter((record) => record.kind === selectedRecordKind),
    [selectedRecordKind],
  );

  useEffect(() => {
    if (usesDemoAgents) {
      const localAgentIds = new Set(localAgents.map((agent) => agent.agentId));
      setAgents([
        ...localAgents,
        ...demoWorkbenchData.demoAgentManifests.filter(
          (agent) => !localAgentIds.has(agent.agentId),
        ),
      ]);
    }
    if (usesDemoAgentReadiness) {
      const localReadinessIds = new Set(
        localAgentReadiness.map((item) => item.agentId),
      );
      setAgentReadiness([
        ...localAgentReadiness,
        ...demoWorkbenchData.demoAgentReadiness.filter(
          (item) => !localReadinessIds.has(item.agentId),
        ),
      ]);
    }
    if (usesDemoRuns) {
      const localRunIds = new Set(
        localWorkbenchRuns.map((run) => run.pipelineRunId),
      );
      const nextRuns = [
        ...localWorkbenchRuns,
        ...demoWorkbenchData.demoRunInspections.filter(
          (run) => !localRunIds.has(run.pipelineRunId),
        ),
      ];
      setWorkbenchRuns(nextRuns);
      setSelectedRunId((current) =>
        nextRuns.some((run) => run.pipelineRunId === current)
          ? current
          : nextRuns[0]?.pipelineRunId ?? null,
      );
    }
    if (usesDemoArtifacts) {
      setArtifactGroups(demoWorkbenchData.demoArtifactGroups);
    }
  }, [
    demoWorkbenchData,
    localAgentReadiness,
    localAgents,
    localWorkbenchRuns,
    usesDemoAgentReadiness,
    usesDemoAgents,
    usesDemoArtifacts,
    usesDemoRuns,
  ]);

  useEffect(() => {
    const localRawRuns = [...localWorkbenchRuns, ...workbenchRuns]
      .map((run) => run.raw)
      .filter(isLocalWorkbenchRunRaw);

    setLocalWorkbenchRuns((current) =>
      current.map((run) =>
        isLocalWorkbenchRunRaw(run.raw)
          ? localizeLocalWorkbenchRun(run.raw, t)
          : run,
      ),
    );
    setWorkbenchRuns((current) =>
      current.map((run) =>
        isLocalWorkbenchRunRaw(run.raw)
          ? localizeLocalWorkbenchRun(run.raw, t)
          : run,
      ),
    );
    setLocalFallbackRuntimeRuns((current) => {
      if (!current) return current;
      const pipelineRunId = current[0]?.externalRunId;
      const raw = localRawRuns
        .find(
          (value) => value.pipelineRunId === pipelineRunId,
        );
      return raw ? toLocalRuntimeRuns(localizeLocalWorkbenchRun(raw, t)) : current;
    });
  }, [i18n.resolvedLanguage]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbenchIndexes(): Promise<void> {
      try {
        const [agentsResponse, skillsResponse, runsResponse] = await Promise.all([
          fetch("/api/agents"),
          fetch("/api/skills"),
          fetch("/api/runs?limit=20"),
        ]);

        if (!cancelled && agentsResponse.ok) {
          const data = (await agentsResponse.json()) as {
            agents?: AgentManifestPreview[];
            readiness?: AgentReadiness[];
          };
          const apiAgents = Array.isArray(data.agents) ? data.agents : [];
          const hasApiAgents = apiAgents.length > 0;
          if (hasApiAgents) {
            setUsesDemoAgents(false);
            setAgents(apiAgents);
            setSelectedAgentId((current) =>
              apiAgents.some((agent) => agent.agentId === current)
                ? current
                : apiAgents[0]?.agentId ?? current,
            );
          }
          if (
            Array.isArray(data.readiness) &&
            (hasApiAgents || data.readiness.length > 0)
          ) {
            setUsesDemoAgentReadiness(false);
            setAgentReadiness(data.readiness);
          }
        }

        if (!cancelled && skillsResponse.ok) {
          const skillData = normalizeSkillPreviews(await skillsResponse.json());
          if (skillData.length > 0) {
            setSkillCatalog(skillData);
            setSelectedSkillId((current) =>
              skillData.some((skill) => skill.id === current)
                ? current
                : skillData[0]?.id ?? current,
            );
          }
        }

        let loadedRuns: WorkbenchRunInspection[] = [];
        if (!cancelled && runsResponse.ok) {
          loadedRuns = normalizeApiRuns(await runsResponse.json());
          if (loadedRuns.length > 0) {
            setUsesDemoRuns(false);
            setWorkbenchRuns(loadedRuns);
            setSelectedRunId(loadedRuns[0]?.pipelineRunId ?? null);
          }
        }

        if (!cancelled && loadedRuns.length > 0) {
          const artifactGroupsByRun = await Promise.all(
            loadedRuns.map(async (run) => {
              const response = await fetch(
                `/api/artifacts?pipelineRunId=${encodeURIComponent(run.pipelineRunId)}&limit=50`,
              );
              if (!response.ok) return [];
              return normalizeApiArtifacts(await response.json(), {
                pipelineRunId: run.pipelineRunId,
                pipelineTitle: run.title,
              });
            }),
          );
          if (!cancelled) {
            setUsesDemoArtifacts(false);
            setArtifactGroups(artifactGroupsByRun.flat());
          }
        }
      } catch {
        if (cancelled) return;
        setSkillCatalog(skillManifestPreviews);
      }
    }

    void loadWorkbenchIndexes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const triggeredRun = displayedRuntimeRuns.find(shouldOpenBackstageForRun);
    if (!triggeredRun) return;
    if (backstageAutoOpenRunIdRef.current === triggeredRun.id) return;
    backstageAutoOpenRunIdRef.current = triggeredRun.id;
    setSelectedSkillId(triggeredRun.moduleId);
    setBackstageTab("ui");
  }, [displayedRuntimeRuns]);

  function openModules(moduleId?: ModuleId): void {
    if (moduleId) {
      setSelectedModuleId(moduleId);
    }
    setActiveView("modules");
    setWorkspaceMode("foreground");
  }

  function openBackstageSkill(moduleId: ModuleId, tab: BackstageTab = "io"): void {
    setSelectedSkillId(moduleId);
    setBackstageTab(tab);
    setWorkbenchTab("skills");
    setWorkspaceMode("backstage");
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
        setConnectionPayload(data.connection);
        setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.loadedFromApi"));
        setPublishSaveState("saved");
        setPublishStatusMessage(
          agentFirstMessage("agentFirst.statusMessages.loadedPublishSettingsFromApi"),
        );
      } catch {
        if (cancelled) return;
        setConnectionStatus("offline");
        setConnectionPayload(null);
        setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.apiOfflineLocalDraft"));
        setPublishSaveState("offline");
        setPublishStatusMessage(
          agentFirstMessage("agentFirst.statusMessages.apiOfflineLocalPublishSettings"),
        );
      }
    }

    void loadAgentConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateConfig(patch: Partial<AgentConfigDraft>): void {
    setAgentConfig((current) => ({ ...current, ...patch }));
    setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.unsavedLocalDraft"));
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
    setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.unsavedLocalDraft"));
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
    setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.unsavedLocalDraft"));
  }

  function updateMemorySettings(patch: Partial<AgentMemorySettings>): void {
    setAgentConfig((current) => ({
      ...current,
      memorySettings: { ...current.memorySettings, ...patch },
    }));
    setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.unsavedLocalDraft"));
  }

  function updateSafetySettings(patch: Partial<AgentSafetySettings>): void {
    setAgentConfig((current) => ({
      ...current,
      safetySettings: { ...current.safetySettings, ...patch },
    }));
    setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.unsavedLocalDraft"));
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
      setConnectionPayload(data.connection);
      setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.savedToApi"));
    } catch {
      setConnectionStatus("offline");
      setConnectionPayload(null);
      setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.apiOfflineLocalDraftOnly"));
    } finally {
      setIsConfigBusy(false);
    }
  }

  function updatePublishVersionLabel(versionLabel: string): void {
    setPublishSettings((current) => ({ ...current, versionLabel }));
    setPublishSaveState("local");
    setPublishStatusMessage(
      agentFirstMessage("agentFirst.statusMessages.unsavedLocalPublishSettings"),
    );
  }

  async function savePublishSettings(nextStatus: PublishStatus): Promise<void> {
    if (publishSaveState === "saving") return;

    const versionLabel = publishSettings.versionLabel.trim() || "draft-0.3";
    const token = publishTokenDraft.trim();

    setPublishSaveState("saving");
    setPublishStatusMessage(
      agentFirstMessage("agentFirst.statusMessages.savingPublishSettings"),
    );

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
      setConnectionPayload(data.connection);
      if (token) {
        setPublishPreviewToken(token);
      }
      setPublishTokenDraft("");
      setPublishSaveState("saved");
      setPublishStatusMessage(
        agentFirstMessage("agentFirst.statusMessages.savedPublishSettingsToApi"),
      );
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
      setConnectionPayload(null);
      setPublishSaveState("offline");
      setPublishStatusMessage(
        agentFirstMessage("agentFirst.statusMessages.apiOfflineLocalPublishSettingsOnly"),
      );
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
      setConnectionPayload(data);
      setConfigStatusMessage(
        agentFirstMessage(`agentFirst.status.connection.${data.status}`),
      );
    } catch {
      setConnectionStatus("offline");
      setConnectionPayload(null);
      setConfigStatusMessage(agentFirstMessage("agentFirst.statusMessages.apiOfflineCannotTestKey"));
    } finally {
      setIsConfigBusy(false);
    }
  }

  async function submitCommand(): Promise<void> {
    if (submitCommandInFlightRef.current || agentRunState === "submitting") {
      return;
    }

    const trimmed = command.trim();
    if (!trimmed) return;

    submitCommandInFlightRef.current = true;
    setQueuedPrompt(trimmed);
    setCommand("");
    setAgentRunState("submitting");
    setAgentRunStatusMessage(
      agentFirstMessage("agentFirst.statusMessages.submittingAgentRunApi"),
    );
    setRuntimeActionStates({});
    setRuntimeActionStatusMessages({});
    setRuntimeActionNoticeMessage(
      agentFirstMessage("agentFirst.statusMessages.waitingForApiRunData"),
    );
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
        setLocalFallbackRuntimeRuns(null);
        setAgentRunState("failed");
        setAgentRunStatusMessage(
          agentFirstMessage("agentFirst.statusMessages.agentRunApiFailedLocal"),
        );
        setRuntimeActionNoticeMessage(
          agentFirstMessage("agentFirst.statusMessages.runtimeActionsLocal"),
        );
        return;
      }

      const data = (await response.json()) as AgentRunApiResponse;
      const runtimeRuns = toRuntimeRunsFromAgentRun(data);
      setLatestAgentRun({
        response: data,
        runtimeRuns,
      });
      setLocalFallbackRuntimeRuns(null);
      setConnectionStatus(data.connection.status);
      setConnectionPayload(data.connection);
      setAgentRunState("saved");
      setAgentRunStatusMessage(
        agentFirstMessage("agentFirst.statusMessages.savedRun", {
          runId: data.pipelineRun.id.slice(0, 8),
        }),
      );
      setRuntimeActionNoticeMessage(
        agentFirstMessage("agentFirst.statusMessages.runtimeActionsConnected"),
      );
      const triggeredRun = runtimeRuns.find(shouldOpenBackstageForRun);
      if (triggeredRun) {
        openBackstageSkill(triggeredRun.moduleId, "ui");
      }
    } catch {
      setLatestAgentRun(null);
      setLocalFallbackRuntimeRuns(null);
      setAgentRunState("offline");
      setAgentRunStatusMessage(
        agentFirstMessage("agentFirst.statusMessages.apiOfflineLocalMock"),
      );
      setRuntimeActionNoticeMessage(
        agentFirstMessage("agentFirst.statusMessages.runtimeActionsLocal"),
      );
      setConnectionStatus("offline");
      setConnectionPayload(null);
    } finally {
      submitCommandInFlightRef.current = false;
    }
  }

  function rememberWorkbenchRun(run: WorkbenchRunInspection): void {
    if (usesDemoRuns) {
      setLocalWorkbenchRuns((current) => [
        run,
        ...current.filter((item) => item.pipelineRunId !== run.pipelineRunId),
      ]);
    } else {
      setWorkbenchRuns((current) => [
        run,
        ...current.filter((item) => item.pipelineRunId !== run.pipelineRunId),
      ]);
    }
    setSelectedRunId(run.pipelineRunId);
  }

  function rememberCreatedAgent(agent: AgentManifestPreview): void {
    const readiness: AgentReadiness = {
      agentId: agent.agentId,
      status: "ready",
      missingSkillIds: [],
      enabledSkillIds: agent.skills.map((skill) => skill.skillId),
    };
    if (usesDemoAgents) {
      setLocalAgents((current) => [
        agent,
        ...current.filter((item) => item.agentId !== agent.agentId),
      ]);
    } else {
      setAgents((current) => [
        agent,
        ...current.filter((item) => item.agentId !== agent.agentId),
      ]);
    }
    if (usesDemoAgentReadiness) {
      setLocalAgentReadiness((current) => [
        readiness,
        ...current.filter((item) => item.agentId !== agent.agentId),
      ]);
    } else {
      setAgentReadiness((current) => [
        readiness,
        ...current.filter((item) => item.agentId !== agent.agentId),
      ]);
    }
    setSelectedAgentId(agent.agentId);
  }

  async function testWorkbenchAgent(agentId: string): Promise<void> {
    if (
      agentRunState === "submitting" ||
      workbenchTestRunInFlightRef.current
    ) {
      return;
    }

    const agent = agents.find((item) => item.agentId === agentId);
    const prompt = `Run ${(agent?.title ?? agent?.name ?? agentId)} test plan.`;

    workbenchTestRunInFlightRef.current = true;
    setSelectedAgentId(agentId);
    setAgentRunState("submitting");
    setAgentRunStatusMessage(
      agentFirstMessage("agentFirst.statusMessages.submittingAgent", { agentId }),
    );
    setRuntimeActionStates({});
    setRuntimeActionStatusMessages({});
    setRuntimeActionNoticeMessage(
      agentFirstMessage("agentFirst.statusMessages.waitingForApiRunData"),
    );

    try {
      const response = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: prompt,
          executionMode,
          metadata: { source: "mockup-sandbox", trigger: "workbench-test-run" },
        }),
      });

      if (!response.ok) {
        const localRun = createLocalWorkbenchRun(
          agentId,
          agents,
          t,
        );
        rememberWorkbenchRun(localRun);
        setLatestAgentRun(null);
        setLocalFallbackRuntimeRuns(toLocalRuntimeRuns(localRun));
        setConnectionStatus("offline");
        setConnectionPayload(null);
        setWorkbenchTab("runs");
        setAgentRunState(response.status === 403 ? "failed" : "offline");
        setAgentRunStatusMessage(
          agentFirstMessage("agentFirst.statusMessages.agentRunApiUnavailableLocalDemo"),
        );
        setRuntimeActionNoticeMessage(
          agentFirstMessage("agentFirst.statusMessages.runtimeActionsLocal"),
        );
        return;
      }

      const data = (await response.json()) as AgentRunApiResponse;
      const runtimeRuns = toRuntimeRunsFromAgentRun(data);
      const workbenchRun = toWorkbenchRunFromAgentRun(data, agentId);
      setLatestAgentRun({
        response: data,
        runtimeRuns,
      });
      setLocalFallbackRuntimeRuns(null);
      rememberWorkbenchRun(workbenchRun);
      setConnectionStatus(data.connection.status);
      setConnectionPayload(data.connection);
      setWorkbenchTab("runs");
      setAgentRunState("saved");
      setAgentRunStatusMessage(
        agentFirstMessage("agentFirst.statusMessages.savedRun", {
          runId: data.pipelineRun.id.slice(0, 8),
        }),
      );
      setRuntimeActionNoticeMessage(
        agentFirstMessage("agentFirst.statusMessages.runtimeActionsConnected"),
      );
    } catch {
      const localRun = createLocalWorkbenchRun(
        agentId,
        agents,
        t,
      );
      rememberWorkbenchRun(localRun);
      setLatestAgentRun(null);
      setLocalFallbackRuntimeRuns(toLocalRuntimeRuns(localRun));
      setWorkbenchTab("runs");
      setAgentRunState("offline");
      setAgentRunStatusMessage(
        agentFirstMessage("agentFirst.statusMessages.apiOfflineLocalDemo"),
      );
      setRuntimeActionNoticeMessage(
        agentFirstMessage("agentFirst.statusMessages.runtimeActionsLocal"),
      );
      setConnectionStatus("offline");
      setConnectionPayload(null);
    } finally {
      workbenchTestRunInFlightRef.current = false;
    }
  }

  async function resumeRuntimeRun(run: RuntimeModuleRun): Promise<void> {
    if (!latestAgentRun) {
      openModules(run.moduleId);
      return;
    }

    setRuntimeActionStates((current) => ({ ...current, [run.id]: "submitting" }));
    setRuntimeActionStatusMessages((current) => ({
      ...current,
      [run.id]: agentFirstMessage("agentFirst.statusMessages.resumingModule", {
        moduleId: run.moduleId,
      }),
    }));

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
      setRuntimeActionStatusMessages((current) => ({
        ...current,
        [run.id]: agentFirstMessage(
          "agentFirst.statusMessages.resumeSubmittedForModule",
          {
            moduleId: run.moduleId,
          },
        ),
      }));
    } catch {
      setRuntimeActionStates((current) => ({ ...current, [run.id]: "failed" }));
      setRuntimeActionStatusMessages((current) => ({
        ...current,
        [run.id]: agentFirstMessage(
          "agentFirst.statusMessages.resumeApiFailedForModule",
          {
            moduleId: run.moduleId,
          },
        ),
      }));
    }
  }

  return (
    <div className={`agent-os-shell agent-os-shell--${themeMode}`}>
      <aside className="side-rail" aria-label={t("agentFirst.aria.mainNavigation")}>
        <div className="brand-mark">
          <Sparkles size={17} />
          <span>AI</span>
        </div>
        <nav className="rail-nav">
          {navItems.map((item) => {
            const label = t(item.labelKey);
            return (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? "rail-button active" : "rail-button"}
                onClick={() => {
                  setWorkspaceMode("foreground");
                  setActiveView(item.id);
                }}
                title={label}
                aria-label={label}
              >
                {item.icon}
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <Bot size={17} />
            <span>{t("agentFirst.topbar.title")}</span>
          </div>
          <div className="topbar-actions">
            <div className="workspace-switch" aria-label={t("agentFirst.aria.workspaceMode")}>
              <button
                type="button"
                className={workspaceMode === "mission" ? "active" : ""}
                onClick={() => setWorkspaceMode("mission")}
              >
                {t("agentFirst.workspace.mission")}
              </button>
              <button
                type="button"
                className={workspaceMode === "foreground" ? "active" : ""}
                onClick={() => setWorkspaceMode("foreground")}
              >
                {t("agentFirst.workspace.foreground")}
              </button>
              <button
                type="button"
                className={workspaceMode === "backstage" ? "active" : ""}
                onClick={() => setWorkspaceMode("backstage")}
              >
                {t("agentFirst.workspace.backstage")}
              </button>
              <button
                type="button"
                className={workspaceMode === "backstage" && workbenchTab === "operator" ? "active" : ""}
                onClick={() => {
                  setWorkspaceMode("backstage");
                  setWorkbenchTab("operator");
                }}
              >
                {t("agentFirst.workspace.operator")}
              </button>
            </div>
            <LanguageSwitcher className="topbar-mode-switch language-mode-switch" variant="ghost" />
            <button
              type="button"
              className="topbar-mode-switch theme-mode-switch"
              aria-label={
                themeMode === "dark"
                  ? t("topbar.switchToLight")
                  : t("topbar.switchToDark")
              }
              title={
                themeMode === "dark"
                  ? t("topbar.switchToLight")
                  : t("topbar.switchToDark")
              }
              aria-pressed={themeMode === "light"}
              onClick={() =>
                setThemeMode((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              type="button"
              className="topbar-mode-switch portal-mode-switch"
              aria-label={t("topbar.viewPortal")}
              title={t("topbar.viewPortal")}
              onClick={() =>
                window.location.assign(
                  portalPreviewUrl(
                    publishTokenDraft.trim() || publishPreviewToken,
                  ),
                )
              }
            >
              <UploadCloud size={14} />
              {t("topbar.viewPortal")}
            </button>
            <span className="topbar-pill">
              <ShieldCheck size={14} />
              {t("agentFirst.topbar.postgresMemory")}
            </span>
            <span className="topbar-pill live">
              <Activity size={14} />
              {t("agentFirst.topbar.activeRuns", { count: 1 })}
            </span>
          </div>
        </header>

        <main className="view-frame">
          {workspaceMode === "mission" ? (
            <MissionCenterShell
              onOpenBackstage={() => {
                setWorkspaceMode("backstage");
                setWorkbenchTab("runs");
              }}
              onOpenOperator={() => {
                setWorkspaceMode("backstage");
                setWorkbenchTab("operator");
              }}
            />
          ) : workspaceMode === "backstage" ? (
            <BackstageView
              workbenchTab={workbenchTab}
              agents={agents}
              agentReadiness={agentReadiness}
              selectedAgent={selectedAgent}
              selectedAgentId={selectedAgentId}
              workbenchRuns={workbenchRuns}
              selectedRunId={selectedRunId}
              artifactGroups={artifactGroups}
              skillCatalog={skillCatalog}
              selectedSkill={selectedSkillManifest}
              selectedSkillId={selectedSkillId}
              skillTab={backstageTab}
              runtimeRuns={displayedRuntimeRuns}
              latestAgentRun={latestAgentRun}
              onSetWorkbenchTab={setWorkbenchTab}
              onSelectAgent={setSelectedAgentId}
              onSelectRun={setSelectedRunId}
              onTestAgent={testWorkbenchAgent}
              onCreateAgent={rememberCreatedAgent}
              onSelectSkill={(skillId) => {
                setSelectedSkillId(skillId);
                setSelectedModuleId(skillId);
              }}
              onSetSkillTab={setBackstageTab}
              onOpenForeground={(moduleId) => {
                setSelectedModuleId(moduleId);
                setWorkspaceMode("foreground");
                setActiveView("modules");
              }}
              onOpenSkillFromAgent={(skillId) => {
                if (isModuleId(skillId)) {
                  setSelectedSkillId(skillId);
                  setSelectedModuleId(skillId);
                  setBackstageTab("io");
                  setWorkbenchTab("skills");
                }
              }}
            />
          ) : (
            <>
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
              onOpenBackstage={openBackstageSkill}
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
              runtimeActionStatusTexts={runtimeActionStatusTexts}
              onSelectModule={setSelectedModuleId}
              onOpenData={() => setActiveView("data")}
              onResumeRuntimeRun={resumeRuntimeRun}
              onOpenBackstage={openBackstageSkill}
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
              runtimeActionNoticeText={runtimeActionNoticeText}
              runtimeActionStatusTexts={runtimeActionStatusTexts}
              latestAgentRun={latestAgentRun}
              onOpenConfigure={() => setActiveView("configure")}
              onOpenData={() => setActiveView("data")}
              onOpenBackstage={openBackstageSkill}
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
              connection={connectionPayload}
              statusText={configStatusText}
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
              publishPreviewToken={publishPreviewToken}
              publishSaveState={publishSaveState}
              publishStatusText={publishStatusText}
              onUpdateVersionLabel={updatePublishVersionLabel}
              onUpdateTokenDraft={setPublishTokenDraft}
              onSavePublishSettings={savePublishSettings}
            />
          )}
            </>
          )}
        </main>

        {workspaceMode === "foreground" && (
          <Composer
            value={command}
            planMode={planMode}
            onChange={setCommand}
            onTogglePlanMode={() => setPlanMode((value) => !value)}
            onSubmit={submitCommand}
            onOpenConfigure={() => setActiveView("configure")}
            isSubmitting={agentRunState === "submitting"}
          />
        )}

        <nav className="mobile-nav" aria-label={t("agentFirst.aria.mobileNavigation")}>
          {navItems.map((item) => {
            const label = t(item.labelKey);
            return (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? "mobile-nav-button active" : "mobile-nav-button"}
                onClick={() => {
                  setWorkspaceMode("foreground");
                  setActiveView(item.id);
                }}
                aria-label={label}
              >
                {item.icon}
                <span>{label}</span>
              </button>
            );
          })}
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
  onOpenBackstage,
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
  onOpenBackstage: (moduleId: ModuleId, tab?: BackstageTab) => void;
  onOpenProgress: () => void;
  onOpenData: () => void;
}) {
  const { t } = useTranslation();
  const resumeReadyCount = runtimeRuns.filter((run) => run.status === "resumable").length;
  const approvalCount = runtimeRuns.filter((run) => run.status === "approval_required").length;
  const configNeededCount = runtimeRuns.filter((run) => run.status === "skipped").length;
  const succeededCount = runtimeRuns.filter((run) => run.status === "succeeded").length;
  const storedRecordCount = modules.reduce((total, module) => total + module.records, 0);
  const artifactCount = skillManifestPreviews.reduce(
    (total, skill) => total + skill.sampleArtifacts.length,
    0,
  );

  return (
    <section className="agent-layout">
      <div className="chat-panel">
        <div className="panel-heading">
          <span>
            <MessageSquareText size={16} />
            {t("agentFirst.agentView.title")}
          </span>
          <span className="soft-label">
            {t(`agentFirst.executionMode.${executionMode}`)}
          </span>
        </div>

        <div className="chat-stream">
          <ChatBubble role="user">
            {t("agentFirst.agentView.demoUserMessage")}
          </ChatBubble>
          <ChatBubble role="agent">
            {t("agentFirst.agentView.demoAgentMessage")}
          </ChatBubble>

          <RunCard
            title={t("agentFirst.agentView.pipelineTitle")}
            detail={t("agentFirst.agentView.pipelineDetail", {
              succeededCount,
              resumeReadyCount,
              approvalCount,
              configNeededCount,
            })}
            status={executionMode === "execute_ready" ? "running" : "queued"}
            actions={
              <>
                <button type="button" className="small-action" onClick={onOpenProgress}>
                  {t("agentFirst.nav.progress")}
                </button>
                <button type="button" className="small-action" onClick={onOpenData}>
                  {t("agentFirst.nav.data")}
                </button>
                <button type="button" className="small-action" onClick={() => onOpenModules()}>
                  {t("agentFirst.nav.modules")}
                </button>
                <button
                  type="button"
                  className="small-action"
                  onClick={() => onOpenBackstage("rag_to_agent", "ui")}
                >
                  {t("agentFirst.workspace.backstage")}
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
            {t("agentFirst.agentView.liveWorkspace")}
          </span>
          <span className="soft-label">{t("agentFirst.agentView.apiIngest")}</span>
        </div>
        <div className="workspace-preview">
          <div className="preview-bar">
            <span />
            <span />
            <span />
            <strong>{t("agentFirst.agentView.moduleMemory")}</strong>
          </div>
          <div className="memory-map">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={module.id === selectedModule.id ? "memory-node active" : "memory-node"}
                onClick={() => onOpenBackstage(module.id, "io")}
              >
                <i style={{ background: module.color }} />
                <strong>{module.name}</strong>
                <span>{module.result}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="agent-summary-grid">
          <Metric label={t("agentFirst.metrics.runs")} value={String(Math.max(runtimeRuns.length, modules.length))} />
          <Metric label={t("agentFirst.metrics.records")} value={String(storedRecordCount)} />
          <Metric label={t("agentFirst.metrics.artifacts")} value={String(artifactCount)} />
        </div>
      </div>
    </section>
  );
}

function BackstageView({
  workbenchTab,
  agents,
  agentReadiness,
  selectedAgent,
  selectedAgentId,
  workbenchRuns,
  selectedRunId,
  artifactGroups,
  skillCatalog,
  selectedSkill,
  selectedSkillId,
  skillTab,
  runtimeRuns,
  latestAgentRun,
  onSetWorkbenchTab,
  onSelectAgent,
  onSelectRun,
  onTestAgent,
  onCreateAgent,
  onSelectSkill,
  onSetSkillTab,
  onOpenForeground,
  onOpenSkillFromAgent,
}: {
  workbenchTab: WorkbenchTab;
  agents: AgentManifestPreview[];
  agentReadiness: AgentReadiness[];
  selectedAgent: AgentManifestPreview;
  selectedAgentId: string;
  workbenchRuns: WorkbenchRunInspection[];
  selectedRunId: string | null;
  artifactGroups: WorkbenchArtifactPipelineGroup[];
  skillCatalog: SkillManifestPreview[];
  selectedSkill: SkillManifestPreview;
  selectedSkillId: ModuleId;
  skillTab: BackstageTab;
  runtimeRuns: RuntimeModuleRun[];
  latestAgentRun: AgentRunUiState | null;
  onSetWorkbenchTab: (tab: WorkbenchTab) => void;
  onSelectAgent: (agentId: string) => void;
  onSelectRun: (pipelineRunId: string) => void;
  onTestAgent: (agentId: string) => void;
  onCreateAgent: (agent: AgentManifestPreview) => void;
  onSelectSkill: (skillId: ModuleId) => void;
  onSetSkillTab: (tab: BackstageTab) => void;
  onOpenForeground: (moduleId: ModuleId) => void;
  onOpenSkillFromAgent: (skillId: string) => void;
}) {
  const { t } = useTranslation();
  const demoWorkbenchData = useMemo(
    () => createAgentFirstWorkbenchDemoData(t),
    [t],
  );
  const selectedRun = runtimeRuns.find((run) => run.moduleId === selectedSkill.id);
  const selectedRecords = dataRecords.filter((record) => record.moduleId === selectedSkill.id);
  const workbenchTabs: Array<{ id: WorkbenchTab; labelKey: string }> = [
    { id: "agents", labelKey: "agentFirst.backstage.tabs.agents" },
    { id: "skills", labelKey: "agentFirst.backstage.tabs.skills" },
    { id: "runs", labelKey: "agentFirst.backstage.tabs.runs" },
    { id: "artifacts", labelKey: "agentFirst.backstage.tabs.artifacts" },
    { id: "operator", labelKey: "agentFirst.backstage.tabs.operator" },
  ];
  const skillTabs: Array<{ id: BackstageTab; labelKey: string; enabled: boolean }> = [
    { id: "io", labelKey: "agentFirst.backstage.skillTabs.io", enabled: true },
    { id: "artifacts", labelKey: "agentFirst.backstage.skillTabs.artifacts", enabled: true },
    { id: "events", labelKey: "agentFirst.backstage.skillTabs.events", enabled: true },
    { id: "ui", labelKey: "agentFirst.backstage.skillTabs.ui", enabled: hasBackstageSkillUi(selectedSkill) },
  ];
  const selectedReadiness =
    agentReadiness.find((item) => item.agentId === selectedAgent.agentId) ?? null;
  const selectedAgentRun =
    workbenchRuns.find((run) => run.agentId === selectedAgent.agentId) ?? null;

  return (
    <section className="workbench-shell">
      <div className="backstage-tabs workbench-primary-tabs" role="tablist" aria-label={t("agentFirst.aria.workbenchTabs")}>
        {workbenchTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={workbenchTab === item.id}
            className={workbenchTab === item.id ? "active" : ""}
            onClick={() => onSetWorkbenchTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {workbenchTab === "agents" && (
        <section className="backstage-layout">
          <aside className="skill-catalog" aria-label={t("agentFirst.aria.agentCatalog")}>
            <div className="panel-heading">
              <span>
                <Bot size={16} />
                {t("agentFirst.backstage.agentsTitle")}
              </span>
              <span className="soft-label">{t("agentFirst.backstage.loadedCount", { count: agents.length })}</span>
            </div>
            <AgentCatalog
              agents={agents}
              readiness={agentReadiness}
              runs={workbenchRuns}
              selectedAgentId={selectedAgentId}
              onSelectAgent={onSelectAgent}
              onTestRun={onTestAgent}
            />
          </aside>

          <div className="backstage-main">
            <AgentDetail
              agent={selectedAgent}
              readiness={selectedReadiness}
              skills={demoWorkbenchData.workbenchSkillOptions}
              latestRun={selectedAgentRun}
              onTestRun={onTestAgent}
              onOpenSkill={onOpenSkillFromAgent}
            />
            <AgentManifestWizard
              skills={demoWorkbenchData.workbenchSkillOptions}
              onCreated={onCreateAgent}
            />
          </div>
        </section>
      )}

      {workbenchTab === "skills" && (
        <section className="backstage-layout">
          <aside className="skill-catalog" aria-label={t("agentFirst.aria.skillCatalog")}>
            <div className="panel-heading">
              <span>
                <Boxes size={16} />
                {t("agentFirst.backstage.skillsTitle")}
              </span>
              <span className="soft-label">{t("agentFirst.backstage.loadedCount", { count: skillCatalog.length })}</span>
            </div>
            {skillCatalog.map((skill) => {
              const run = runtimeRuns.find((item) => item.moduleId === skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={skill.id === selectedSkillId ? "skill-row active" : "skill-row"}
                  onClick={() => onSelectSkill(skill.id)}
                >
                  <i style={{ background: moduleById(skill.id).color }} />
                  <span>
                    <strong>{skill.name}</strong>
                    <em>{skill.execution.kind}</em>
                  </span>
                  <b className={run ? runtimeStatusClass(run.status) : "runtime-status queued"}>
                    {run ? runtimeStatusLabel(run.status, t) : t("agentFirst.status.runtime.queued")}
                  </b>
                </button>
              );
            })}
          </aside>

          <div className="backstage-main">
            <div className="backstage-header">
              <div>
                <span className="soft-label">{t("agentFirst.backstage.skillManifest")}</span>
                <h1>{selectedSkill.name}</h1>
                <p>{selectedSkill.description}</p>
              </div>
              <button
                type="button"
                className="small-action"
                onClick={() => onOpenForeground(selectedSkill.id)}
              >
                {t("agentFirst.backstage.foregroundDetail")}
              </button>
            </div>

            <div className="backstage-metrics">
              <Metric label={t("agentFirst.metrics.kind")} value={selectedSkill.execution.kind} />
              <Metric
                label={t("agentFirst.metrics.readiness")}
                value={
                  selectedSkill.project.readiness === "ready"
                    ? t("agentFirst.status.readiness.ready")
                    : t("agentFirst.status.readiness.not_configured")
                }
              />
              <Metric label={t("agentFirst.metrics.adapter")} value={selectedSkill.execution.adapterId} />
              <Metric label={t("agentFirst.metrics.ui")} value={backstageUiLabel(selectedSkill, t)} />
            </div>

            <div className="backstage-tabs" role="tablist" aria-label={t("agentFirst.aria.skillTabs")}>
              {skillTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  disabled={!item.enabled}
                  aria-selected={skillTab === item.id}
                  className={skillTab === item.id ? "active" : ""}
                  onClick={() => item.enabled && onSetSkillTab(item.id)}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>

            {skillTab === "io" && (
              <div className="backstage-grid two">
                <JsonInspector title={t("agentFirst.backstage.input")} value={selectedRun?.id ? selectedSkill.sampleInput : selectedSkill.inputSchema} />
                <JsonInspector title={t("agentFirst.backstage.output")} value={selectedSkill.sampleOutput} />
              </div>
            )}

            {skillTab === "artifacts" && (
              <div className="artifact-grid">
                {selectedSkill.sampleArtifacts.map((artifact) => (
                  <ArtifactRenderer key={artifact.id} artifact={artifact} />
                ))}
                {selectedRecords.map((record) => (
                  <div key={record.id} className="artifact-card">
                    <div className="artifact-title">
                      <FileText size={15} />
                      <span>{record.title}</span>
                    </div>
                    <p>{record.summary}</p>
                    <code>{record.id}</code>
                  </div>
                ))}
              </div>
            )}

            {skillTab === "events" && (
              <div className="event-feed">
                {(selectedRun ? [selectedRun] : runtimeRuns.filter((run) => run.moduleId === selectedSkill.id)).map(
                  (run) => (
                    <div key={run.id} className="event-row">
                      <span className={runtimeStatusClass(run.status)}>{runtimeStatusLabel(run.status, t)}</span>
                      <strong>{run.title}</strong>
                      <p>{run.event}</p>
                      <em>{run.updatedAt}</em>
                    </div>
                  ),
                )}
                {selectedRun?.interaction && (
                  <div className="event-row attention">
                    <span className="runtime-status approval_required">{t("agentFirst.backstage.interaction")}</span>
                    <strong>{selectedRun.interaction.title}</strong>
                    <p>{selectedRun.interaction.message}</p>
                    <em>{selectedRun.interaction.resumeHandle}</em>
                  </div>
                )}
              </div>
            )}

            {skillTab === "ui" && <SkillHtmlPanel skill={selectedSkill} run={selectedRun} />}
          </div>
        </section>
      )}

      {workbenchTab === "runs" && (
        <RunInspector
          runs={workbenchRuns}
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
        />
      )}

      {workbenchTab === "artifacts" && <ArtifactInspector groups={artifactGroups} />}

      {workbenchTab === "operator" && (
        <OperatorBackstage agents={agents} skills={skillCatalog} />
      )}
    </section>
  );
}

function JsonInspector({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="json-inspector">
      <div className="artifact-title">
        <Database size={15} />
        <span>{title}</span>
      </div>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function ArtifactRenderer({ artifact }: { artifact: SkillArtifactSample }) {
  const { t } = useTranslation();
  const content = artifact.contentKey ? t(artifact.contentKey) : artifact.content;

  return (
    <div className="artifact-card">
      <div className="artifact-title">
        <FileText size={15} />
        <span>{artifact.title}</span>
        <em>{artifact.renderer}</em>
      </div>
      {artifact.renderer === "markdown" && (
        <div className="markdown-preview">
          {String(content ?? "")
            .split("\n")
            .map((line, index) =>
              line.startsWith("# ") ? (
                <h3 key={`${artifact.id}-${index}`}>{line.replace(/^#\s*/, "")}</h3>
              ) : line.startsWith("- ") ? (
                <p key={`${artifact.id}-${index}`} className="markdown-list-line">
                  {line}
                </p>
              ) : (
                <p key={`${artifact.id}-${index}`}>{line || "\u00a0"}</p>
              ),
            )}
        </div>
      )}
      {artifact.renderer === "table" && Array.isArray(content) && (
        <div className="artifact-table-wrap">
          <table className="artifact-table">
            <thead>
              <tr>
                {Object.keys((content[0] as JsonObject) ?? {}).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(content as JsonObject[]).map((row, index) => (
                <tr key={`${artifact.id}-${index}`}>
                  {Object.values(row).map((value, valueIndex) => (
                    <td key={`${artifact.id}-${index}-${valueIndex}`}>{String(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {artifact.renderer === "json" && (
        <pre className="artifact-json">{JSON.stringify(content, null, 2)}</pre>
      )}
      {artifact.renderer === "text" && <pre className="artifact-json">{String(content ?? "")}</pre>}
      {(artifact.renderer === "image" || artifact.renderer === "file") && (
        <div className="file-preview">
          <FileText size={18} />
          <span>{artifact.id}</span>
        </div>
      )}
    </div>
  );
}

function SkillHtmlPanel({
  skill,
  run,
}: {
  skill: SkillManifestPreview;
  run?: RuntimeModuleRun;
}) {
  const { t } = useTranslation();

  if (skill.id === "climate_monitor") {
    return <ClimateMonitorOpsPanel run={run} />;
  }

  if (!skill.ui.htmlEntrypoint) {
    return (
      <div className="json-inspector empty-state">
        <strong>{t("agentFirst.skillUi.genericRenderer")}</strong>
        <p>{t("agentFirst.skillUi.noHtmlSurface")}</p>
      </div>
    );
  }

  const runStatus = run
    ? runtimeStatusLabel(run.status, t)
    : t("agentFirst.status.runtime.queued");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #101820; color: #edf3fb; }
      main { padding: 22px; display: grid; gap: 14px; }
      section { border: 1px solid #263545; border-radius: 8px; padding: 14px; background: #121d27; }
      h1 { font-size: 20px; margin: 0 0 6px; }
      p { color: #9fb0c3; margin: 0; line-height: 1.5; }
      code { color: #8bd7ff; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${skill.name}</h1>
        <p>${t("agentFirst.skillUi.htmlEntrypoint")}: <code>${skill.ui.htmlEntrypoint}</code></p>
      </section>
      <section>
        <p>${t("agentFirst.skillUi.runStatus")}: <code>${runStatus}</code></p>
        <p>${t("agentFirst.metrics.adapter")}: <code>${skill.execution.adapterId}</code></p>
      </section>
    </main>
  </body>
</html>`;

  return (
    <div className="skill-ui-frame">
      <iframe title={`${skill.name} backstage UI`} sandbox="" srcDoc={html} />
    </div>
  );
}

function climateApiStateLabel(state: ClimateMonitorApiState, t: TFunction): string {
  return t(`agentFirst.status.climateApi.${state}`);
}

function climateApiStateClass(state: ClimateMonitorApiState): string {
  if (state === "api") return "runtime-status succeeded";
  if (state === "loading") return "runtime-status running";
  return "runtime-status skipped";
}

function climateRunStateLabel(state: ClimateMonitorRunState, t: TFunction): string {
  return t(`agentFirst.status.climateRun.${state}`);
}

function climateTimestamp(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function ClimateMonitorOpsPanel({ run }: { run?: RuntimeModuleRun }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ClimateMonitorStatus>(mockClimateMonitorStatus);
  const [apiState, setApiState] = useState<ClimateMonitorApiState>("loading");
  const [runState, setRunState] = useState<ClimateMonitorRunState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    agentFirstMessage("agentFirst.statusMessages.loadingClimateMonitorStatus"),
  );
  const [runDate, setRunDate] = useState("");
  const [manifestFixture, setManifestFixture] = useState("");
  const [researchFixture, setResearchFixture] = useState("");
  const missingEnv = status.configured
    ? []
    : run?.missingRequiredEnv.length
      ? run.missingRequiredEnv
      : ["CLIMATE_MONITOR_PROJECT_PATH"];
  const dryRunDisabled = !status.configured || runState === "submitting";
  const liveRunDisabled = !status.configured || runState === "submitting";
  const statusText = translateAgentFirstMessage(t, statusMessage);

  useEffect(() => {
    let cancelled = false;

    async function loadClimateStatus(): Promise<void> {
      try {
        const response = await fetch("/api/climate-monitor/status", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Climate Monitor status returned ${response.status}`);
        }

        const data = (await response.json()) as unknown;
        if (cancelled) return;

        setStatus(normalizeClimateMonitorStatus(data));
        setApiState("api");
        setStatusMessage(agentFirstMessage("agentFirst.statusMessages.climateStatusLoadedFromApi"));
      } catch {
        if (cancelled) return;
        setStatus(mockClimateMonitorStatus);
        setApiState("offline");
        setStatusMessage(agentFirstMessage("agentFirst.statusMessages.climateApiOfflineLocalMock"));
      }
    }

    void loadClimateStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function climateRunErrorMessage(response: Response): Promise<AgentFirstLocalizedMessage> {
    try {
      const payload = (await response.json()) as unknown;
      if (isJsonObject(payload) && typeof payload["error"] === "string") {
        return agentFirstMessage("agentFirst.statusMessages.climateRunFailed", {
          message: payload["error"],
        });
      }
    } catch {
      // Fall through to the generic HTTP status message.
    }
    return agentFirstMessage("agentFirst.statusMessages.climateRunHttpError", {
      status: response.status,
    });
  }

  async function submitClimateRun(mode: ClimateMonitorRunMode): Promise<void> {
    if (!status.configured) return;

    setRunState("submitting");
    setStatusMessage(
      agentFirstMessage(
        mode === "dry_run"
          ? "agentFirst.statusMessages.submittingClimateDryRun"
          : "agentFirst.statusMessages.submittingClimateLiveRun",
      ),
    );

    const runRequest: {
      dryRun: boolean;
      date?: string;
      manifestFixture?: string;
      researchFixture?: string;
    } = {
      dryRun: mode === "dry_run",
    };
    const normalizedDate = runDate.trim();
    const normalizedManifestFixture = manifestFixture.trim();
    const normalizedResearchFixture = researchFixture.trim();
    if (normalizedDate) runRequest.date = normalizedDate;
    if (normalizedManifestFixture) runRequest.manifestFixture = normalizedManifestFixture;
    if (normalizedResearchFixture) runRequest.researchFixture = normalizedResearchFixture;

    try {
      const response = await fetch("/api/climate-monitor/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Interface-Command-Intent": "climate-monitor-run",
        },
        body: JSON.stringify(runRequest),
      });
      if (!response.ok) {
        setApiState("api");
        setRunState("failed");
        setStatusMessage(await climateRunErrorMessage(response));
        return;
      }

      const data = (await response.json()) as unknown;
      setStatus(normalizeClimateMonitorStatus(data, status));
      setApiState("api");
      setRunState("succeeded");
      setStatusMessage(
        agentFirstMessage(
          mode === "dry_run"
            ? "agentFirst.statusMessages.climateDryRunAccepted"
            : "agentFirst.statusMessages.climateLiveRunAccepted",
        ),
      );
    } catch {
      const updatedAt = climateTimestamp();
      setStatus((current) => ({
        ...current,
        latestReport: current.latestReport
          ? {
              ...current.latestReport,
              status: mode === "dry_run" ? "dry-run queued" : current.latestReport.status,
              generatedAt: updatedAt,
            }
          : null,
        updatedAt,
      }));
      setApiState("offline");
      setRunState(mode === "dry_run" ? "offline" : "failed");
      setStatusMessage(
        agentFirstMessage(
          mode === "dry_run"
            ? "agentFirst.statusMessages.climateDryRunApiOffline"
            : "agentFirst.statusMessages.climateLiveRunApiUnavailable",
        ),
      );
    }
  }

  return (
    <div className="climate-ops-panel">
      <div className="panel-heading">
        <span>
          <Globe2 size={16} />
          {t("agentFirst.climate.title")}
        </span>
        <span className={climateApiStateClass(apiState)}>{climateApiStateLabel(apiState, t)}</span>
      </div>

      <div className="climate-ops-metrics">
        <Metric
          label={t("agentFirst.metrics.configured")}
          value={status.configured ? t("agentFirst.common.yes") : t("agentFirst.common.no")}
        />
        <Metric label={t("agentFirst.metrics.runState")} value={climateRunStateLabel(runState, t)} />
        <Metric label={t("agentFirst.metrics.updated")} value={status.updatedAt} />
        <Metric label={t("agentFirst.metrics.warnings")} value={String(status.warnings.length)} />
      </div>

      {status.latestReport ? (
        <section className="climate-report-card">
          <div>
            <span className="soft-label">{t("agentFirst.climate.latestReport")}</span>
            <h2>{status.latestReport.title}</h2>
            <p>{status.latestReport.summary}</p>
          </div>
          <div className="climate-report-meta">
            <strong>{status.latestReport.id}</strong>
            <span>{status.latestReport.status}</span>
            <em>{status.latestReport.generatedAt}</em>
          </div>
        </section>
      ) : (
        <section className="climate-report-card empty-report">
          <div>
            <span className="soft-label">{t("agentFirst.climate.latestReport")}</span>
            <h2>{t("agentFirst.climate.noReportTitle")}</h2>
            <p>{t("agentFirst.climate.noReportDescription")}</p>
          </div>
          <div className="climate-report-meta">
            <strong>not_available</strong>
            <span>
              {status.configured
                ? t("agentFirst.status.readiness.readyToRun")
                : t("agentFirst.status.readiness.not_configured")}
            </span>
            <em>{status.updatedAt}</em>
          </div>
        </section>
      )}

      <div className="climate-ops-grid">
        <section className="climate-ops-card">
          <div className="artifact-title">
            <Database size={15} />
            <span>{t("agentFirst.climate.scopeCoverage")}</span>
          </div>
          <div className="climate-coverage-list">
            {status.scopeCoverage.map((item) => {
              const coverage =
                item.total > 0 ? Math.min(100, Math.round((item.covered / item.total) * 100)) : 0;
              return (
                <div key={item.label} className="climate-coverage-row">
                  <span>
                    <strong>{item.label}</strong>
                    <em>{item.status}</em>
                  </span>
                  <b>
                    {item.covered} / {item.total}
                  </b>
                  <div
                    className="climate-progress"
                    aria-label={t("agentFirst.climate.coverageAria", {
                      label: item.label,
                      coverage,
                    })}
                  >
                    <i style={{ width: `${coverage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="climate-ops-card">
          <div className="artifact-title">
            <CircleAlert size={15} />
            <span>{t("agentFirst.metrics.warnings")}</span>
          </div>
          <div className="climate-warning-list">
            {status.warnings.map((warning) => (
              <div key={warning.id} className={`climate-warning-row ${warning.severity}`}>
                <strong>{warning.label}</strong>
                <span>{warning.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="climate-ops-card climate-dedup-card">
          <div className="artifact-title">
            <Layers3 size={15} />
            <span>{t("agentFirst.climate.dedupPlaceholders")}</span>
          </div>
          <div className="climate-dedup-grid">
            <span>
              <strong>{status.dedup.candidates}</strong>
              <em>{t("agentFirst.climate.candidates")}</em>
            </span>
            <span>
              <strong>{status.dedup.merged}</strong>
              <em>{t("agentFirst.climate.merged")}</em>
            </span>
            <span>
              <strong>{status.dedup.pending}</strong>
              <em>{t("agentFirst.climate.pending")}</em>
            </span>
            <span>
              <strong>{status.dedup.lastChecked}</strong>
              <em>{t("agentFirst.climate.lastChecked")}</em>
            </span>
          </div>
        </section>
      </div>

      <div className="runtime-action-row climate-actions">
        <div className="runtime-chip-row">
          {missingEnv.length > 0 ? (
            missingEnv.map((envName) => <span key={envName}>{envName}</span>)
          ) : (
            <span>{t("agentFirst.status.connection.configured")}</span>
          )}
        </div>
        <div className="climate-run-options">
          <label>
            <span>{t("agentFirst.climate.date")}</span>
            <input
              type="date"
              value={runDate}
              onChange={(event) => setRunDate(event.target.value)}
            />
          </label>
          <label>
            <span>{t("agentFirst.climate.manifest")}</span>
            <input
              type="text"
              value={manifestFixture}
              onChange={(event) => setManifestFixture(event.target.value)}
              placeholder="fixtures/sample-manifest.json"
            />
          </label>
          <label>
            <span>{t("agentFirst.climate.research")}</span>
            <input
              type="text"
              value={researchFixture}
              onChange={(event) => setResearchFixture(event.target.value)}
              placeholder="fixtures/sample-research.json"
            />
          </label>
        </div>
        <div className="runtime-action-row">
          <button
            type="button"
            className="small-action"
            disabled={dryRunDisabled}
            onClick={() => void submitClimateRun("dry_run")}
          >
            <Activity size={14} />
            {runState === "submitting"
              ? t("agentFirst.status.climateRun.submitting")
              : t("agentFirst.climate.dryRun")}
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={liveRunDisabled}
            onClick={() => void submitClimateRun("live_run")}
          >
            <ShieldCheck size={14} />
            {t("agentFirst.climate.liveRun")}
          </button>
        </div>
      </div>
      <p className="runtime-action-feedback">{statusText}</p>
    </div>
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
  const { t } = useTranslation();
  return (
    <div className="runtime-control">
      <div className="panel-heading">
        <span>
          <Activity size={16} />
          {t("agentFirst.runtime.title")}
        </span>
        <span className={`agent-run-state ${agentRunState}`}>
          {agentRunStateLabel(agentRunState, t)}
        </span>
      </div>
      <p className="agent-run-status-text">{agentRunStatusText}</p>
      <div className="runtime-mode-group" aria-label={t("agentFirst.aria.runtimeExecutionMode")}>
        <button
          type="button"
          aria-pressed={executionMode === "plan_only"}
          className={
            executionMode === "plan_only"
              ? "runtime-mode-button active"
              : "runtime-mode-button"
          }
          onClick={() => onSetExecutionMode("plan_only")}
        >
          {t("agentFirst.executionMode.plan_only")}
        </button>
        <button
          type="button"
          aria-pressed={executionMode === "execute_ready"}
          className={
            executionMode === "execute_ready"
              ? "runtime-mode-button active"
              : "runtime-mode-button"
          }
          onClick={() => onSetExecutionMode("execute_ready")}
        >
          {t("agentFirst.executionMode.execute_ready")}
        </button>
      </div>
      <div className="runtime-status-grid">
        <Metric label={t("agentFirst.metrics.resumeReady")} value={String(resumeReadyCount)} />
        <Metric label={t("agentFirst.metrics.approval")} value={String(approvalCount)} />
        <Metric label={t("agentFirst.metrics.configNeeded")} value={String(configNeededCount)} />
      </div>
    </div>
  );
}

function ModulesView({
  selectedModule,
  selectedModuleId,
  runtimeRuns,
  runtimeActionStates,
  runtimeActionStatusTexts,
  onSelectModule,
  onOpenData,
  onResumeRuntimeRun,
  onOpenBackstage,
}: {
  selectedModule: ModuleDefinition;
  selectedModuleId: ModuleId;
  runtimeRuns: RuntimeModuleRun[];
  runtimeActionStates: Record<string, RuntimeActionState>;
  runtimeActionStatusTexts: Record<string, string>;
  onSelectModule: (moduleId: ModuleId) => void;
  onOpenData: () => void;
  onResumeRuntimeRun: (run: RuntimeModuleRun) => void | Promise<void>;
  onOpenBackstage: (moduleId: ModuleId, tab?: BackstageTab) => void;
}) {
  const { t } = useTranslation();
  const selectedRuntimeRun = runtimeRuns.find((run) => run.moduleId === selectedModule.id);
  const selectedActionState = selectedRuntimeRun
    ? runtimeActionStates[selectedRuntimeRun.id] ?? "idle"
    : "idle";
  const selectedActionStatusText = selectedRuntimeRun
    ? runtimeActionStatusTexts[selectedRuntimeRun.id]
    : undefined;
  const supportsResume = skillManifestById(selectedModule.id).execution.supportsResume;

  return (
    <section className="module-layout">
      <div className="module-list">
        <div className="panel-heading">
          <span>
            <Boxes size={16} />
            {t("agentFirst.modules.title")}
          </span>
          <span className="soft-label">{t("agentFirst.modules.registeredCount", { count: modules.length })}</span>
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
            <b>{statusLabel(module.status, t)}</b>
          </button>
        ))}
      </div>

      <div className="module-detail">
        <div className="module-detail-header">
          <div>
            <h1>{selectedModule.name}</h1>
            <p>{selectedModule.description}</p>
          </div>
          <span className={statusClass(selectedModule.status)}>{statusLabel(selectedModule.status, t)}</span>
        </div>

        <div className="detail-grid">
          <Metric label={t("agentFirst.metrics.storedRecords")} value={String(selectedModule.records)} />
          <Metric label={t("agentFirst.metrics.latestResult")} value={selectedModule.result} />
          <Metric label={t("agentFirst.metrics.integration")} value={t("agentFirst.agentView.apiIngest")} />
        </div>

        {selectedRuntimeRun && (
          <div className="runtime-panel">
            <div className="panel-heading">
              <span>
                <Activity size={16} />
                {t("agentFirst.modules.runtimeContract")}
              </span>
              <span className={runtimeStatusClass(selectedRuntimeRun.status)}>
                {runtimeStatusLabel(selectedRuntimeRun.status, t)}
              </span>
            </div>
            <div className="runtime-meta-grid">
              <Metric label={t("agentFirst.metrics.adapter")} value={selectedRuntimeRun.adapterId} />
              <Metric label={t("agentFirst.metrics.kind")} value={selectedRuntimeRun.adapterKind.toUpperCase()} />
              <Metric label={t("agentFirst.metrics.externalRun")} value={selectedRuntimeRun.externalRunId} />
              <Metric
                label={t("agentFirst.metrics.requiredEnv")}
                value={
                  selectedRuntimeRun.missingRequiredEnv.length > 0
                    ? selectedRuntimeRun.missingRequiredEnv.join(", ")
                    : t("agentFirst.status.readiness.ready")
                }
              />
              <Metric label={t("agentFirst.metrics.resume")} value={supportsResume ? t("agentFirst.common.yes") : t("agentFirst.common.no")} />
              <Metric label={t("agentFirst.metrics.updated")} value={selectedRuntimeRun.updatedAt} />
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
                    {selectedActionState === "submitting"
                      ? t("agentFirst.actions.resuming")
                      : t("agentFirst.actions.resumeNow")}
                  </button>
                )}
                <button type="button" className="small-action" onClick={onOpenData}>
                  {t("agentFirst.actions.openData")}
                </button>
                <button
                  type="button"
                  className="small-action"
                  onClick={() => onOpenBackstage(selectedModule.id, "io")}
                >
                  {t("agentFirst.workspace.backstage")}
                </button>
              </div>
            </div>
            {selectedActionStatusText && selectedActionState !== "idle" && (
              <p className="runtime-action-feedback">{selectedActionStatusText}</p>
            )}
          </div>
        )}

        <div className="result-panel">
          <div className="panel-heading">
            <span>
              <FileText size={16} />
              {t("agentFirst.modules.resultUi")}
            </span>
            <button type="button" className="small-action" onClick={onOpenData}>
              {t("agentFirst.actions.openData")}
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
  runtimeActionNoticeText,
  runtimeActionStatusTexts,
  latestAgentRun,
  onOpenConfigure,
  onOpenData,
  onOpenBackstage,
  onResumeRuntimeRun,
}: {
  queuedPrompt: string | null;
  executionMode: RuntimeExecutionMode;
  runtimeRuns: RuntimeModuleRun[];
  agentRunState: AgentRunSubmitState;
  agentRunStatusText: string;
  runtimeActionStates: Record<string, RuntimeActionState>;
  runtimeActionNoticeText: string;
  runtimeActionStatusTexts: Record<string, string>;
  latestAgentRun: AgentRunUiState | null;
  onOpenConfigure: () => void;
  onOpenData: () => void;
  onOpenBackstage: (moduleId: ModuleId, tab?: BackstageTab) => void;
  onResumeRuntimeRun: (run: RuntimeModuleRun) => void | Promise<void>;
}) {
  const { t } = useTranslation();
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
          {actionState === "submitting"
            ? t("agentFirst.actions.resuming")
            : t("agentFirst.actions.resume")}
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
        <button type="button" className="small-action" onClick={() => onOpenBackstage(run.moduleId, "ui")}>
          {t("agentFirst.actions.review")}
        </button>
      );
    }
    if (run.status === "skipped") {
      return (
        <button type="button" className="small-action" onClick={onOpenConfigure}>
          {t("agentFirst.nav.configure")}
        </button>
      );
    }
    if (run.status === "succeeded") {
      return (
        <button type="button" className="small-action" onClick={onOpenData}>
          {t("agentFirst.actions.viewData")}
        </button>
      );
    }
    return (
      <button type="button" className="small-action" onClick={() => onOpenBackstage(run.moduleId, "io")}>
        {t("agentFirst.actions.viewRun")}
      </button>
    );
  }

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>{t("agentFirst.progress.title")}</h1>
          <p>{t("agentFirst.progress.description")}</p>
        </div>
        <div className="runtime-action-row">
          <span className="connection-pill">
            <Activity size={14} />
            {t(`agentFirst.executionMode.${executionMode}`)}
          </span>
          <span className={`agent-run-state ${agentRunState}`}>
            {agentRunStateLabel(agentRunState, t)}
          </span>
          <button type="button" className="primary-action" onClick={onOpenData}>
            <Database size={15} />
            {t("agentFirst.actions.openMemory")}
          </button>
        </div>
      </div>

      {queuedPrompt && (
        <div className="queued-card">
          <Clock3 size={16} />
          <span>
            <strong>{t("agentFirst.progress.queuedInstruction")}</strong>
            <em>{queuedPrompt}</em>
          </span>
        </div>
      )}

      {latestAgentRun ? (
        <div className="api-plan-panel">
          <div className="api-plan-meta">
            <strong>
              {t("agentFirst.progress.pipeline", {
                runId: latestAgentRun.response.pipelineRun.id.slice(0, 8),
              })}
            </strong>
            <span>
              {t("agentFirst.progress.planSteps", {
                count: latestAgentRun.response.plan.steps.length,
              })}
            </span>
            <span>{agentRunApiStatusLabel(latestAgentRun.response.status, t)}</span>
            <span>{agentRunStatusText}</span>
          </div>
          <p>{latestAgentRun.response.plan.summary}</p>
          {latestAgentRun.response.plan.warnings.length > 0 && (
            <div className="warning-chip-row" aria-label={t("agentFirst.progress.planWarnings")}>
              {latestAgentRun.response.plan.warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="agent-run-status-text">{agentRunStatusText}</p>
      )}
      <p className="agent-run-status-text">{runtimeActionNoticeText}</p>

      <div className="timeline">
        {runtimeRuns.map((run) => (
          <article key={run.id} className="timeline-card runtime-timeline-card">
            <span className={runtimeStatusClass(run.status)}>
              {runtimeStatusLabel(run.status, t)}
            </span>
            <div>
              <h2>{run.title}</h2>
              <p>{run.event}</p>
              <small>
                {run.updatedAt} / {run.moduleId} / {run.adapterId}
              </small>
              <div className="runtime-action-row">
                <span>
                  {t("agentFirst.progress.resultRecordCount", {
                    count: run.resultRecordIds.length,
                  })}
                </span>
                {runtimeAction(run)}
              </div>
              {runtimeActionStatusTexts[run.id] &&
                (runtimeActionStates[run.id] ?? "idle") !== "idle" && (
                  <p className="runtime-action-feedback">
                    {runtimeActionStatusTexts[run.id]}
                  </p>
                )}
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
  const { t } = useTranslation();
  const kinds = ["all", ...Array.from(new Set(dataRecords.map((record) => record.kind)))];

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>{t("agentFirst.data.title")}</h1>
          <p>{t("agentFirst.data.description")}</p>
        </div>
        <div className="search-box">
          <Search size={14} />
          <span>{t("agentFirst.data.searchRecords")}</span>
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
            {kind === "all" ? t("agentFirst.data.all") : kind}
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
  connection,
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
  connection: AgentConnectionPayload | null;
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
  const { t } = useTranslation();
  const enabledBusinessSkills = config.businessSkillSettings.filter(
    (skill) => skill.enabled,
  ).length;
  const enabledGeneralSkills = config.generalSkillSettings.filter(
    (skill) => skill.enabled || skill.installOnDemand,
  ).length;
  const memoryModeKey =
    config.memorySettings.shortTermEnabled && config.memorySettings.longTermEnabled
      ? "shortLong"
      : config.memorySettings.longTermEnabled
        ? "longOnly"
        : "shortOnly";
  const memoryMode = t(`agentFirst.configure.memoryMode.${memoryModeKey}`);
  const activeProvider = connection?.activeProvider ?? config.provider;
  const configuredProvider = connection?.configuredProvider ?? config.provider;
  const providerWarnings = connection?.warnings ?? [];
  const activeProviderText =
    connection && activeProvider !== configuredProvider
      ? t("agentFirst.configure.providerFallback", {
          provider: plannerProviderLabel(activeProvider),
        })
      : plannerProviderLabel(activeProvider);

  return (
    <section className="configure-layout">
      <div className="configure-hero">
        <div>
          <h1>{t("agentFirst.configure.title")}</h1>
          <p>{t("agentFirst.configure.description")}</p>
        </div>
        <div className={`connection-pill ${connectionStatus}`}>
          <Activity size={15} />
          <span>{connectionLabel(connectionStatus, t)}</span>
        </div>
      </div>

      <div className="capability-map" aria-label={t("agentFirst.aria.capabilityMap")}>
        <span>
          <strong>{t("agentFirst.configure.capability.agent.title")}</strong>
          <em>{t("agentFirst.configure.capability.agent.detail")}</em>
        </span>
        <span>
          <strong>{t("agentFirst.configure.capability.businessSkills.title")}</strong>
          <em>{t("agentFirst.configure.capability.businessSkills.detail")}</em>
        </span>
        <span>
          <strong>{t("agentFirst.configure.capability.generalSkills.title")}</strong>
          <em>{t("agentFirst.configure.capability.generalSkills.detail")}</em>
        </span>
        <span>
          <strong>{t("agentFirst.configure.capability.memory.title")}</strong>
          <em>{t("agentFirst.configure.capability.memory.detail")}</em>
        </span>
      </div>

      <div className="configure-grid">
        <article className="config-card">
          <div className="config-card-heading">
            <span>
              <Globe2 size={16} />
              {t("agentFirst.configure.provider")}
            </span>
            <em>{statusText}</em>
          </div>
          <p className="config-explainer">{t("agentFirst.configure.guides.provider")}</p>
          <div className="config-field">
            <span className="config-field-label" id="agent-provider-label">
              {t("agentFirst.configure.provider")}
            </span>
            <div
              className="segmented-control"
              role="group"
              aria-labelledby="agent-provider-label"
            >
              {plannerProviderOptions.map((option) => (
                <button
                  key={option.provider}
                  type="button"
                  className={
                    config.provider === option.provider
                      ? "segmented-button active"
                      : "segmented-button"
                  }
                  onClick={() =>
                    onUpdateConfig({
                      provider: option.provider,
                      modelId: defaultModelForProvider(option.provider),
                      reasoningEffort:
                        option.provider === "openai"
                          ? config.reasoningEffort === "none"
                            ? "medium"
                            : config.reasoningEffort
                          : "none",
                    })
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {connection && (
            <div className="provider-readiness">
              <span>
                {t("agentFirst.configure.activePlanner")}: <strong>{activeProviderText}</strong>
              </span>
              {providerWarnings.slice(0, 2).map((warning) => (
                <em key={warning}>{warning}</em>
              ))}
            </div>
          )}
          <div className="config-field">
            <span className="config-field-label" id="agent-endpoint-label">
              {t("agentFirst.configure.endpoint")}
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
              {t("agentFirst.actions.test")}
            </button>
            <button type="button" className="primary-action" disabled={isBusy} onClick={onSave}>
              {t("agentFirst.actions.save")}
            </button>
          </div>
        </article>

        <article className="config-card">
          <div className="config-card-heading">
            <span>
              <Bot size={16} />
              {t("agentFirst.configure.model")}
            </span>
            <em>
              {t("agentFirst.configure.reasoningSummary", {
                effort: reasoningEffortLabel(config.reasoningEffort, t),
              })}
            </em>
          </div>
          <p className="config-explainer">{t("agentFirst.configure.guides.model")}</p>
          <div className="config-field">
            <label htmlFor="agent-model-select">{t("agentFirst.configure.model")}</label>
            <select
              id="agent-model-select"
              value={config.modelId}
              onChange={(event) => onUpdateConfig({ modelId: event.target.value })}
            >
              {plannerModelOptions.map((modelId) => (
                <option key={modelId} value={modelId}>
                  {modelId}
                </option>
              ))}
            </select>
          </div>
          <div className="config-field">
            <span className="config-field-label" id="agent-reasoning-label">
              {t("agentFirst.configure.reasoning")}
            </span>
            <div
              className="segmented-control"
              role="group"
              aria-labelledby="agent-reasoning-label"
            >
              {(["none", "low", "medium", "high", "xhigh"] as AgentReasoningEffort[]).map((effort) => (
                <button
                  key={effort}
                  type="button"
                  className={config.reasoningEffort === effort ? "segmented-button active" : "segmented-button"}
                  disabled={config.provider !== "openai" && effort !== "none"}
                  onClick={() => onUpdateConfig({ reasoningEffort: effort })}
                >
                  {reasoningEffortLabel(effort, t)}
                </button>
              ))}
            </div>
          </div>
          <div className="config-field">
            <label htmlFor="agent-system-prompt">{t("agentFirst.configure.systemPrompt")}</label>
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
              {t("agentFirst.configure.businessSkills")}
            </span>
            <em>{t("agentFirst.configure.enabledCount", { count: enabledBusinessSkills })}</em>
          </div>
          <p className="config-explainer">{t("agentFirst.configure.businessSkillsDescription")}</p>
          <SwitchLegend items={businessSwitchGuides} title={t("agentFirst.configure.switchGuide")} />
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
                    {t("agentFirst.configure.enabled")}
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.approvalRequired}
                      onChange={(event) =>
                        onUpdateBusinessSkill(skill.moduleId, { approvalRequired: event.target.checked })
                      }
                    />
                    {t("agentFirst.configure.approval")}
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.canUseNetwork}
                      onChange={(event) =>
                        onUpdateBusinessSkill(skill.moduleId, { canUseNetwork: event.target.checked })
                      }
                    />
                    {t("agentFirst.configure.network")}
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.canWriteDatabase}
                      onChange={(event) =>
                        onUpdateBusinessSkill(skill.moduleId, { canWriteDatabase: event.target.checked })
                      }
                    />
                    {t("agentFirst.configure.dbWrite")}
                  </label>
                  <GuideDisclosure
                    guide={guide}
                    label={t("agentFirst.configure.skillDetailsLabel", {
                      name: module.name,
                    })}
                  />
                </div>
              );
            })}
          </div>
        </article>

        <article className="config-card config-card-wide">
          <div className="config-card-heading">
            <span>
              <WandSparkles size={16} />
              {t("agentFirst.configure.generalSkills")}
            </span>
            <em>{t("agentFirst.configure.allowedCount", { count: enabledGeneralSkills })}</em>
          </div>
          <p className="config-explainer">{t("agentFirst.configure.generalSkillsDescription")}</p>
          <SwitchLegend items={generalSwitchGuides} title={t("agentFirst.configure.switchGuide")} />
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
                    {skill.installed
                      ? t("agentFirst.configure.installed")
                      : t("agentFirst.configure.available")}
                  </b>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(event) =>
                        onUpdateGeneralSkill(skill.skillId, { enabled: event.target.checked })
                      }
                    />
                    {t("agentFirst.configure.enabled")}
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
                    {t("agentFirst.configure.onDemand")}
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
                    {t("agentFirst.configure.approval")}
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
                    {t("agentFirst.configure.network")}
                  </label>
                  <GuideDisclosure
                    guide={guide}
                    label={t("agentFirst.configure.skillDetailsLabel", {
                      name: skill.name,
                    })}
                  />
                </div>
              );
            })}
          </div>
        </article>

        <article className="config-card">
          <div className="config-card-heading">
            <span>
              <Database size={16} />
              {t("agentFirst.configure.memory")}
            </span>
            <em>{memoryMode}</em>
          </div>
          <p className="config-explainer">{t("agentFirst.configure.guides.memory")}</p>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.memorySettings.shortTermEnabled}
              onChange={(event) => onUpdateMemory({ shortTermEnabled: event.target.checked })}
            />
            {t("agentFirst.configure.shortTermThreadMemory")}
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.memorySettings.longTermEnabled}
              onChange={(event) => onUpdateMemory({ longTermEnabled: event.target.checked })}
            />
            {t("agentFirst.configure.longTermPostgresMemory")}
          </label>
          <div className="config-field">
            <label htmlFor="agent-memory-promotion">{t("agentFirst.configure.promotion")}</label>
            <select
              id="agent-memory-promotion"
              value={config.memorySettings.promotionMode}
              onChange={(event) =>
                onUpdateMemory({ promotionMode: event.target.value as MemoryPromotionMode })
              }
            >
              {(["agent_suggested", "manual"] as MemoryPromotionMode[]).map(
                (mode) => (
                  <option key={mode} value={mode}>
                    {memoryPromotionLabel(mode, t)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="config-two-column">
            <div className="config-field">
              <label htmlFor="agent-memory-collection">{t("agentFirst.configure.collection")}</label>
              <input
                id="agent-memory-collection"
                value={config.memorySettings.ragCollection}
                onChange={(event) => onUpdateMemory({ ragCollection: event.target.value })}
              />
            </div>
            <div className="config-field">
              <label htmlFor="agent-memory-retention-days">{t("agentFirst.configure.retentionDays")}</label>
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
              {t("agentFirst.configure.safety")}
            </span>
            <em>{t("agentFirst.configure.toolSteps", { count: config.safetySettings.maxToolSteps })}</em>
          </div>
          <p className="config-explainer">{t("agentFirst.configure.guides.safety")}</p>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.safetySettings.requireApprovalForExternalActions}
              onChange={(event) =>
                onUpdateSafety({ requireApprovalForExternalActions: event.target.checked })
              }
            />
            {t("agentFirst.configure.approveExternalActions")}
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.safetySettings.requireApprovalForPublishing}
              onChange={(event) =>
                onUpdateSafety({ requireApprovalForPublishing: event.target.checked })
              }
            />
            {t("agentFirst.configure.approvePublishing")}
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={config.safetySettings.allowSelfLearning}
              onChange={(event) => onUpdateSafety({ allowSelfLearning: event.target.checked })}
            />
            {t("agentFirst.configure.allowSelfLearning")}
          </label>
          <div className="config-field">
            <label htmlFor="agent-max-tool-steps">{t("agentFirst.configure.maxToolSteps")}</label>
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
              {t("agentFirst.configure.runtimePreview")}
            </span>
            <em>{config.endpoint}</em>
          </div>
          <p className="config-explainer">{t("agentFirst.configure.guides.runtime")}</p>
          <div className="runtime-lines">
            <span>
              <strong>{t("agentFirst.metrics.configured")}</strong>
              <em>{plannerProviderLabel(config.provider)} / {config.modelId}</em>
            </span>
            <span>
              <strong>{t("agentFirst.configure.active")}</strong>
              <em>{activeProviderText}</em>
            </span>
            <span>
              <strong>{t("agentFirst.configure.skills")}</strong>
              <em>
                {t("agentFirst.configure.skillCounts", {
                  businessCount: enabledBusinessSkills,
                  generalCount: enabledGeneralSkills,
                })}
              </em>
            </span>
            <span>
              <strong>{t("agentFirst.configure.memory")}</strong>
              <em>
                {t("agentFirst.configure.memoryIntoCollection", {
                  memoryMode,
                  collection: config.memorySettings.ragCollection,
                })}
              </em>
            </span>
            <span>
              <strong>{t("agentFirst.configure.safety")}</strong>
              <em>
                {config.safetySettings.allowSelfLearning
                  ? t("agentFirst.configure.selfLearningAllowed")
                  : t("agentFirst.configure.selfLearningPaused")}
              </em>
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
  items: readonly string[];
  title: string;
}) {
  const { t } = useTranslation();

  return (
    <details className="switch-legend">
      <summary>{title}</summary>
      <div>
        {items.map((item) => (
          <span key={item}>
            <strong>{t(`agentFirst.configure.switches.${item}.label`)}</strong>
            <em>{t(`agentFirst.configure.switches.${item}.detail`)}</em>
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
  const { t } = useTranslation();

  return (
    <div className="skill-detail-grid">
      <span>
        <strong>{t("agentFirst.configure.skillDetail.purpose")}</strong>
        <em>{t(`${guide.keyPrefix}summary`)}</em>
      </span>
      <span>
        <strong>{t("agentFirst.configure.skillDetail.whenUsed")}</strong>
        <em>{t(`${guide.keyPrefix}trigger`)}</em>
      </span>
      <span>
        <strong>{t("agentFirst.configure.skillDetail.agentAction")}</strong>
        <em>{t(`${guide.keyPrefix}action`)}</em>
      </span>
      <span>
        <strong>{t("agentFirst.configure.skillDetail.result")}</strong>
        <em>{t(`${guide.keyPrefix}output`)}</em>
      </span>
      <span>
        <strong>{t("agentFirst.configure.skillDetail.boundary")}</strong>
        <em>{t(`${guide.keyPrefix}boundary`)}</em>
      </span>
    </div>
  );
}

const portalVisibleViews = ["chat", "steps", "data", "sources", "result"] as const;

function publishStatusLabel(status: PublishStatus, t: TFunction): string {
  return t(`agentFirst.status.publish.${status}`);
}

function publishSaveStateLabel(state: PublishSaveState, t: TFunction): string {
  return t(`agentFirst.status.publishSave.${state}`);
}

function PublishView({
  publishSettings,
  publishTokenDraft,
  publishPreviewToken,
  publishSaveState,
  publishStatusText,
  onUpdateVersionLabel,
  onUpdateTokenDraft,
  onSavePublishSettings,
}: {
  publishSettings: PublishSettingsApi;
  publishTokenDraft: string;
  publishPreviewToken: string;
  publishSaveState: PublishSaveState;
  publishStatusText: string;
  onUpdateVersionLabel: (versionLabel: string) => void;
  onUpdateTokenDraft: (token: string) => void;
  onSavePublishSettings: (status: PublishStatus) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const isSaving = publishSaveState === "saving";
  const previewToken =
    publishTokenDraft.trim() || publishPreviewToken.trim() || PORTAL_DEMO_TOKEN;
  const previewTokenLabel = publishTokenDraft.trim()
    ? publishTokenDraft.trim()
    : publishPreviewToken.trim() || PORTAL_DEMO_TOKEN;
  const currentPortalPreviewUrl = portalPreviewUrl(previewToken);

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>{t("agentFirst.publish.title")}</h1>
          <p>{t("agentFirst.publish.description")}</p>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={() => window.location.assign(currentPortalPreviewUrl)}
        >
          <UploadCloud size={15} />
          {t("agentFirst.publish.openPortalPreview")}
        </button>
      </div>

      <section className="publish-settings-panel" aria-label={t("agentFirst.aria.publishSettings")}>
        <div className="publish-settings-header">
          <div>
            <span className={`publish-status-badge ${publishSettings.status}`}>
              {publishStatusLabel(publishSettings.status, t)}
            </span>
            <span className="publish-save-badge">
              {publishSaveStateLabel(publishSaveState, t)}
            </span>
          </div>
          <p>{publishStatusText}</p>
        </div>

        <div className="publish-form-grid">
          <label className="publish-field" htmlFor="publish-version-label">
            <span>{t("agentFirst.publish.versionLabel")}</span>
            <input
              id="publish-version-label"
              value={publishSettings.versionLabel}
              onChange={(event) => onUpdateVersionLabel(event.target.value)}
            />
          </label>
          <label className="publish-field" htmlFor="publish-portal-token">
            <span>{t("agentFirst.publish.portalToken")}</span>
            <input
              id="publish-portal-token"
              type="password"
              autoComplete="off"
              placeholder={t("agentFirst.publish.portalTokenPlaceholder")}
              value={publishTokenDraft}
              onChange={(event) => onUpdateTokenDraft(event.target.value)}
            />
          </label>
          <div className="publish-token-meta">
            <strong>
              {publishSettings.portalTokenLast4
                ? t("agentFirst.publish.tokenEnding", {
                    tokenLast4: publishSettings.portalTokenLast4,
                  })
                : t("agentFirst.publish.noSavedToken")}
            </strong>
            <em>
              {publishSettings.portalTokenUpdatedAt
                ? t("agentFirst.publish.updatedAt", {
                    time: new Date(publishSettings.portalTokenUpdatedAt).toLocaleString(),
                  })
                : t("agentFirst.publish.noPlaintextTokens")}
            </em>
          </div>
        </div>

        <div className="publish-actions">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onSavePublishSettings("draft")}
          >
            {t("agentFirst.publish.saveDraft")}
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={isSaving}
            onClick={() => void onSavePublishSettings("published")}
          >
            <UploadCloud size={15} />
            {t("agentFirst.nav.publish")}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onSavePublishSettings("paused")}
          >
            {t("agentFirst.publish.pause")}
          </button>
        </div>
      </section>

      <div className="publish-grid">
        <PublishStep
          label={t("agentFirst.publish.steps.ragIndex")}
          value={t("agentFirst.publish.steps.chunkProgress")}
          status="running"
        />
        <PublishStep
          label={t("agentFirst.publish.steps.agentConfig")}
          value={publishSettings.versionLabel}
          status="waiting"
        />
        <PublishStep
          label={t("agentFirst.publish.steps.validation")}
          value={t("agentFirst.status.run.queued")}
          status="queued"
        />
        <PublishStep
          label={t("agentFirst.publish.steps.endpoint")}
          value={publishStatusLabel(publishSettings.status, t)}
          status={publishSettings.status === "published" ? "succeeded" : "waiting"}
        />
      </div>

      <div className="publish-access-grid">
        <section className="publish-access-card">
          <span className="publish-card-kicker">{t("agentFirst.publish.portalAccess")}</span>
          <h2>{t("agentFirst.publish.portalAccessTitle")}</h2>
          <p>{t("agentFirst.publish.portalAccessDescription")}</p>
          <div className="publish-token-row">
            <code>{previewTokenLabel}</code>
            <button
              type="button"
              onClick={() => window.location.assign(currentPortalPreviewUrl)}
            >
              {t("agentFirst.publish.viewAsUser")}
            </button>
          </div>
          <em>{t("agentFirst.publish.demoTokenOnly")}</em>
        </section>

        <section className="publish-access-card">
          <span className="publish-card-kicker">{t("agentFirst.publish.frontstageVisible")}</span>
          <h2>{t("agentFirst.publish.frontstageVisibleTitle")}</h2>
          <div className="publish-portal-view-list">
            {portalVisibleViews.map((view) => (
              <span key={view}>
                <strong>{t(`agentFirst.publish.portalViews.${view}.label`)}</strong>
                <em>{t(`agentFirst.publish.portalViews.${view}.detail`)}</em>
              </span>
            ))}
          </div>
        </section>

        <section className="publish-access-card">
          <span className="publish-card-kicker">{t("agentFirst.publish.adminOnly")}</span>
          <h2>{t("agentFirst.publish.adminOnlyTitle")}</h2>
          <p>{t("agentFirst.publish.adminOnlyDescription")}</p>
          <div className="publish-admin-boundary">
            <span>
              <ShieldCheck size={14} /> {t("agentFirst.publish.configureRuntime")}
            </span>
            <span>
              <Database size={14} /> {t("agentFirst.publish.manageMemoryWrites")}
            </span>
            <span>
              <Settings2 size={14} /> {t("agentFirst.publish.controlSkillPermissions")}
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
  const { t } = useTranslation();
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
          placeholder={t("agentFirst.composer.placeholder")}
          rows={2}
          disabled={isSubmitting}
        />
        <div className="composer-actions">
          <button type="button" className="icon-action" aria-label={t("agentFirst.composer.attachFile")}>
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            className={planMode ? "mode-action active" : "mode-action"}
            onClick={onTogglePlanMode}
          >
            <WandSparkles size={15} />
            {t("agentFirst.composer.plan")}
          </button>
          <button
            type="button"
            className="icon-action"
            aria-label={t("agentFirst.composer.agentSettings")}
            onClick={onOpenConfigure}
          >
            <Settings2 size={16} />
          </button>
          <button
            type="button"
            className="send-action"
            aria-label={t("agentFirst.composer.send")}
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
  const { t } = useTranslation();
  return (
    <div className={role === "user" ? "chat-bubble user" : "chat-bubble agent"}>
      <span>{role === "user" ? t("agentFirst.chat.you") : t("agentFirst.chat.agent")}</span>
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
  const { t } = useTranslation();
  return (
    <div className="run-card">
      <span className={statusClass(status)}>{statusLabel(status, t)}</span>
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
  const { t } = useTranslation();
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
    color-scheme: dark;
    --button-outline: rgba(148, 163, 184, 0.22);
    --badge-outline: rgba(148, 163, 184, 0.24);
    --background: 216 31% 5%;
    --foreground: 210 40% 93%;
    --card: 214 30% 9%;
    --card-foreground: 210 40% 93%;
    --popover: 214 31% 7%;
    --popover-foreground: 210 40% 93%;
    --primary: 24 95% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 214 30% 14%;
    --secondary-foreground: 210 40% 93%;
    --muted: 214 31% 13%;
    --muted-foreground: 215 17% 64%;
    --accent: 211 56% 15%;
    --accent-foreground: 211 100% 92%;
    --destructive: 0 72% 55%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 28% 20%;
    --input: 214 28% 20%;
    --ring: 211 100% 65%;
    --primary-border: rgba(249, 115, 22, 0.55);
    --secondary-border: rgba(148, 163, 184, 0.18);
    --destructive-border: rgba(248, 113, 113, 0.42);
    --agent-bg: #080b0f;
    --agent-surface: #101720;
    --agent-surface-alt: #151d28;
    --agent-surface-raised: #1b2430;
    --agent-border: #263241;
    --agent-border-strong: #344456;
    --agent-text: #edf3fb;
    --agent-muted: #8d9bad;
    --agent-faint: #5d6a7a;
    --agent-orange: #f97316;
    --agent-blue: #4f9cff;
    --agent-green: #35d07f;
    --agent-yellow: #f2c94c;
    --agent-red: #ff6b6b;
    --agent-violet: #a78bfa;
    --agent-cyan: #33c6d8;
    background: #080b0f;
    color: #edf3fb;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .agent-os-shell--light {
    color-scheme: light;
    --button-outline: rgba(15, 23, 42, 0.14);
    --badge-outline: rgba(15, 23, 42, 0.12);
    --background: 210 36% 96%;
    --foreground: 215 28% 13%;
    --card: 0 0% 100%;
    --card-foreground: 215 28% 13%;
    --popover: 0 0% 100%;
    --popover-foreground: 215 28% 13%;
    --primary: 24 95% 48%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 32% 91%;
    --secondary-foreground: 215 28% 13%;
    --muted: 210 30% 92%;
    --muted-foreground: 215 16% 43%;
    --accent: 210 72% 92%;
    --accent-foreground: 214 80% 24%;
    --border: 214 22% 82%;
    --input: 214 22% 82%;
    --ring: 211 100% 42%;
    --primary-border: rgba(234, 88, 12, 0.42);
    --secondary-border: rgba(15, 23, 42, 0.12);
    --destructive-border: rgba(220, 38, 38, 0.32);
    --agent-bg: #edf3fb;
    --agent-surface: #ffffff;
    --agent-surface-alt: #f8fafc;
    --agent-surface-raised: #e2e8f0;
    --agent-border: #cbd5e1;
    --agent-border-strong: #94a3b8;
    --agent-text: #0f172a;
    --agent-muted: #475569;
    --agent-faint: #64748b;
    --agent-orange: #ea580c;
    --agent-blue: #2563eb;
    --agent-green: #15803d;
    --agent-yellow: #b45309;
    --agent-red: #dc2626;
    --agent-violet: #7c3aed;
    --agent-cyan: #0891b2;
    background: #edf3fb;
    color: #111827;
  }

  .agent-os-shell--light .side-rail,
  .agent-os-shell--light .topbar {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  .agent-os-shell--light .brand-mark {
    border-color: #cbd5e1;
    color: #ea580c;
  }

  .agent-os-shell--light .rail-button {
    color: #64748b;
  }

  .agent-os-shell--light .rail-button.active {
    border-color: #bfdbfe;
    background: #dbeafe;
    color: #0f172a;
  }

  .agent-os-shell--light .topbar-title {
    color: #111827;
  }

  .agent-os-shell--light .workspace-switch {
    border-color: #cbd5e1;
    background: #e2e8f0;
  }

  .agent-os-shell--light .workspace-switch button {
    color: #64748b;
  }

  .agent-os-shell--light .workspace-switch button.active {
    background: #ffffff;
    color: #0f172a;
  }

  .agent-os-shell--light .topbar-mode-switch {
    border-color: #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .agent-os-shell--light .topbar-pill {
    border-color: #cbd5e1;
    background: #ffffff;
    color: #475569;
  }

  .agent-os-shell--light .topbar-pill.live {
    border-color: #22c55e55;
    background: #dcfce7;
    color: #166534;
  }

  .agent-os-shell--light .view-frame,
  .agent-os-shell--light .skill-catalog,
  .agent-os-shell--light .backstage-main,
  .agent-os-shell--light .chat-panel,
  .agent-os-shell--light .workspace-panel,
  .agent-os-shell--light .module-list,
  .agent-os-shell--light .module-detail,
  .agent-os-shell--light .page-panel,
  .agent-os-shell--light .run-list,
  .agent-os-shell--light .run-detail,
  .agent-os-shell--light .artifact-inspector-layout,
  .agent-os-shell--light .workbench-section,
  .agent-os-shell--light .json-inspector,
  .agent-os-shell--light .artifact-card,
  .agent-os-shell--light .event-row,
  .agent-os-shell--light .runtime-panel,
  .agent-os-shell--light .runtime-control,
  .agent-os-shell--light .runtime-interaction,
  .agent-os-shell--light .config-card,
  .agent-os-shell--light .publish-settings-panel,
  .agent-os-shell--light .publish-access-card,
  .agent-os-shell--light .publish-step,
  .agent-os-shell--light .composer-shell,
  .agent-os-shell--light .composer,
  .agent-os-shell--light .mobile-nav,
  .agent-os-shell--light .skill-ui-frame {
    border-color: #cbd5e1;
    background: #ffffff;
    color: #0f172a;
  }

  .agent-os-shell--light .view-frame {
    background: #edf3fb;
  }

  .agent-os-shell--light .panel-heading,
  .agent-os-shell--light .module-detail-header,
  .agent-os-shell--light .page-header,
  .agent-os-shell--light .preview-bar,
  .agent-os-shell--light .publish-settings-header,
  .agent-os-shell--light .artifact-title,
  .agent-os-shell--light .backstage-header,
  .agent-os-shell--light .runtime-action-row {
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .agent-os-shell--light .agent-catalog-row,
  .agent-os-shell--light .agent-catalog-select,
  .agent-os-shell--light .agent-catalog-run,
  .agent-os-shell--light .agent-catalog-meta span,
  .agent-os-shell--light .agent-skill-chip,
  .agent-os-shell--light .workbench-metrics span,
  .agent-os-shell--light .workbench-lines span,
  .agent-os-shell--light .skill-row,
  .agent-os-shell--light .run-list-row,
  .agent-os-shell--light .run-step-row,
  .agent-os-shell--light .artifact-pipeline-group,
  .agent-os-shell--light .memory-node,
  .agent-os-shell--light .run-card,
  .agent-os-shell--light .queued-card,
  .agent-os-shell--light .timeline-card,
  .agent-os-shell--light .result-panel,
  .agent-os-shell--light .metric,
  .agent-os-shell--light .data-row,
  .agent-os-shell--light .api-plan-panel,
  .agent-os-shell--light .runtime-mode-button,
  .agent-os-shell--light .runtime-status,
  .agent-os-shell--light .runtime-action-row > span:not(.connection-pill),
  .agent-os-shell--light .runtime-timeline-card,
  .agent-os-shell--light .filter-chip,
  .agent-os-shell--light .provider-readiness,
  .agent-os-shell--light .capability-map span,
  .agent-os-shell--light .switch-legend,
  .agent-os-shell--light .switch-legend div,
  .agent-os-shell--light .skill-setting-row,
  .agent-os-shell--light .general-skill-row,
  .agent-os-shell--light .skill-help,
  .agent-os-shell--light .skill-help-panel,
  .agent-os-shell--light .skill-detail-grid span,
  .agent-os-shell--light .toggle-row,
  .agent-os-shell--light .runtime-lines span,
  .agent-os-shell--light .publish-token-meta,
  .agent-os-shell--light .publish-token-row,
  .agent-os-shell--light .publish-admin-boundary,
  .agent-os-shell--light .publish-portal-view-list span,
  .agent-os-shell--light .publish-admin-boundary span,
  .agent-os-shell--light .climate-report-card,
  .agent-os-shell--light .climate-ops-card,
  .agent-os-shell--light .climate-coverage-row,
  .agent-os-shell--light .climate-warning-row,
  .agent-os-shell--light .climate-dedup-grid span {
    border-color: #cbd5e1;
    background: #f8fafc;
    color: #0f172a;
  }

  .agent-os-shell--light .agent-catalog-row.active,
  .agent-os-shell--light .skill-row.active,
  .agent-os-shell--light .run-list-row.active,
  .agent-os-shell--light .memory-node.active,
  .agent-os-shell--light .module-row.active,
  .agent-os-shell--light .runtime-mode-button.active,
  .agent-os-shell--light .filter-chip.active,
  .agent-os-shell--light .segmented-button.active,
  .agent-os-shell--light .backstage-tabs button.active {
    border-color: #60a5fa;
    background: #dbeafe;
    color: #0f172a;
  }

  .agent-os-shell--light .agent-catalog-icon,
  .agent-os-shell--light .search-box,
  .agent-os-shell--light .locked-value,
  .agent-os-shell--light .config-card select,
  .agent-os-shell--light .config-card input,
  .agent-os-shell--light .config-card textarea,
  .agent-os-shell--light .wizard-field input,
  .agent-os-shell--light .wizard-field textarea,
  .agent-os-shell--light .publish-field input,
  .agent-os-shell--light .composer textarea,
  .agent-os-shell--light .json-inspector pre,
  .agent-os-shell--light .artifact-json,
  .agent-os-shell--light .publish-token-row code,
  .agent-os-shell--light .data-table {
    border-color: #cbd5e1;
    background: #ffffff;
    color: #0f172a;
  }

  .agent-os-shell--light .agent-catalog-main strong,
  .agent-os-shell--light .agent-detail-header h2,
  .agent-os-shell--light .workbench-section-title,
  .agent-os-shell--light .agent-skill-chip strong,
  .agent-os-shell--light .run-list-row strong,
  .agent-os-shell--light .run-step-row strong,
  .agent-os-shell--light .artifact-pipeline-heading strong,
  .agent-os-shell--light .backstage-header h1,
  .agent-os-shell--light .artifact-title strong,
  .agent-os-shell--light .climate-report-card h2,
  .agent-os-shell--light .climate-report-meta strong,
  .agent-os-shell--light .climate-coverage-row strong,
  .agent-os-shell--light .climate-warning-row strong,
  .agent-os-shell--light .climate-dedup-grid strong,
  .agent-os-shell--light .panel-heading,
  .agent-os-shell--light .run-card h2,
  .agent-os-shell--light .timeline-card h2,
  .agent-os-shell--light .metric strong,
  .agent-os-shell--light .module-detail-header h1,
  .agent-os-shell--light .page-header h1,
  .agent-os-shell--light .module-row strong,
  .agent-os-shell--light .result-line strong,
  .agent-os-shell--light .data-row strong,
  .agent-os-shell--light .runtime-interaction strong,
  .agent-os-shell--light .provider-readiness strong,
  .agent-os-shell--light .capability-map strong,
  .agent-os-shell--light .switch-legend strong,
  .agent-os-shell--light .config-card-heading span,
  .agent-os-shell--light .skill-setting-row strong,
  .agent-os-shell--light .general-skill-row strong,
  .agent-os-shell--light .skill-detail-grid strong,
  .agent-os-shell--light .runtime-lines strong,
  .agent-os-shell--light .publish-token-meta strong,
  .agent-os-shell--light .publish-access-card h2,
  .agent-os-shell--light .publish-portal-view-list strong,
  .agent-os-shell--light .publish-admin-boundary span {
    color: #0f172a;
  }

  .agent-os-shell--light .agent-catalog-main em,
  .agent-os-shell--light .agent-catalog-meta span,
  .agent-os-shell--light .agent-detail-header p,
  .agent-os-shell--light .workbench-section p,
  .agent-os-shell--light .workbench-metrics em,
  .agent-os-shell--light .workbench-lines em,
  .agent-os-shell--light .agent-skill-chip em,
  .agent-os-shell--light .run-list-row em,
  .agent-os-shell--light .run-step-row em,
  .agent-os-shell--light .artifact-pipeline-heading em,
  .agent-os-shell--light .artifact-meta-line em,
  .agent-os-shell--light .backstage-header p,
  .agent-os-shell--light .artifact-card p,
  .agent-os-shell--light .event-row p,
  .agent-os-shell--light .event-row em,
  .agent-os-shell--light .climate-report-card p,
  .agent-os-shell--light .climate-report-meta span,
  .agent-os-shell--light .climate-report-meta em,
  .agent-os-shell--light .climate-coverage-row em,
  .agent-os-shell--light .climate-warning-row span,
  .agent-os-shell--light .climate-dedup-grid em,
  .agent-os-shell--light .soft-label,
  .agent-os-shell--light .chat-bubble p,
  .agent-os-shell--light .run-card p,
  .agent-os-shell--light .page-header p,
  .agent-os-shell--light .module-detail-header p,
  .agent-os-shell--light .timeline-card p,
  .agent-os-shell--light .data-row p,
  .agent-os-shell--light .metric span,
  .agent-os-shell--light .module-row em,
  .agent-os-shell--light .module-row b,
  .agent-os-shell--light .queued-card em,
  .agent-os-shell--light .api-plan-panel p,
  .agent-os-shell--light .timeline-card small,
  .agent-os-shell--light .runtime-interaction p,
  .agent-os-shell--light .runtime-interaction em,
  .agent-os-shell--light .data-row em,
  .agent-os-shell--light .config-card-heading em,
  .agent-os-shell--light .config-explainer,
  .agent-os-shell--light .switch-legend em,
  .agent-os-shell--light .skill-setting-row em,
  .agent-os-shell--light .general-skill-row em,
  .agent-os-shell--light .skill-detail-grid em,
  .agent-os-shell--light .runtime-lines em,
  .agent-os-shell--light .publish-settings-header p,
  .agent-os-shell--light .publish-token-meta em,
  .agent-os-shell--light .publish-access-card p,
  .agent-os-shell--light .publish-access-card em,
  .agent-os-shell--light .publish-portal-view-list em {
    color: #475569;
  }

  .agent-os-shell--light .text-slate-100,
  .agent-os-shell--light .text-slate-200,
  .agent-os-shell--light .text-slate-300,
  .agent-os-shell--light .text-slate-400 {
    color: #334155;
  }

  .agent-os-shell--light .text-emerald-100,
  .agent-os-shell--light .text-emerald-200,
  .agent-os-shell--light .text-emerald-300 {
    color: #166534;
  }

  .agent-os-shell--light .text-amber-100,
  .agent-os-shell--light .text-amber-200,
  .agent-os-shell--light .text-amber-300 {
    color: #92400e;
  }

  .agent-os-shell--light .text-rose-100,
  .agent-os-shell--light .text-rose-200,
  .agent-os-shell--light .text-rose-300,
  .agent-os-shell--light .text-red-100,
  .agent-os-shell--light .text-red-200,
  .agent-os-shell--light .text-red-300 {
    color: #991b1b;
  }

  .agent-os-shell--light .text-sky-100,
  .agent-os-shell--light .text-sky-200,
  .agent-os-shell--light .text-sky-300 {
    color: #075985;
  }

  .agent-os-shell--light .text-orange-100,
  .agent-os-shell--light .text-orange-200,
  .agent-os-shell--light .text-orange-300 {
    color: #9a3412;
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
  .skill-row,
  .agent-catalog-select,
  .agent-catalog-run,
  .run-list-row,
  .agent-skill-chip,
  .memory-node,
  .filter-chip,
  .segmented-button,
  .workspace-switch button,
  .backstage-tabs button {
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
  .workspace-switch,
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

  .workspace-switch {
    height: 30px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #121a24;
    padding: 2px;
    gap: 2px;
  }

  .workspace-switch button {
    height: 24px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #8f9db0;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 0 10px;
  }

  .workspace-switch button.active {
    background: #253246;
    color: #edf3fb;
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

  .language-mode-switch {
    min-width: 46px;
    justify-content: center;
    gap: 0;
    padding: 0 8px;
    text-transform: none;
  }

  .theme-mode-switch {
    min-width: 34px;
    justify-content: center;
    padding: 0;
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

  .backstage-layout {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 14px;
  }

  .workbench-shell {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .workbench-primary-tabs {
    flex-shrink: 0;
  }

  .skill-catalog,
  .backstage-main,
  .run-list,
  .run-detail,
  .artifact-inspector-layout,
  .workbench-section,
  .json-inspector,
  .artifact-card,
  .event-row {
    border: 1px solid #1f2b39;
    border-radius: 8px;
    background: #101720;
  }

  .skill-catalog {
    min-height: 0;
    overflow: auto;
    padding: 12px;
  }

  .agent-catalog-grid,
  .agent-detail-layout,
  .wizard-form,
  .wizard-skill-select,
  .wizard-permissions,
  .run-step-list,
  .artifact-inspector-layout,
  .artifact-module-group {
    display: grid;
    gap: 10px;
  }

  .agent-catalog-row {
    width: 100%;
    min-height: 92px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #dfe7f2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    text-align: left;
  }

  .agent-catalog-row.active {
    border-color: #31506f;
    background: #142234;
  }

  .agent-catalog-select {
    min-width: 0;
    min-height: 90px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 8px 10px;
    align-items: center;
    padding: 10px;
    text-align: left;
  }

  .agent-catalog-icon {
    width: 30px;
    height: 30px;
    border: 1px solid #344456;
    border-radius: 8px;
    background: #0d141d;
    display: grid;
    place-items: center;
    color: #4f9cff;
  }

  .agent-catalog-main,
  .agent-catalog-meta {
    min-width: 0;
  }

  .agent-catalog-main {
    display: grid;
    gap: 3px;
  }

  .agent-catalog-main strong,
  .agent-catalog-main em,
  .run-list-row strong,
  .run-list-row em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-catalog-main strong {
    font-size: 13px;
  }

  .agent-catalog-main em {
    color: #8795a8;
    font-size: 11px;
    font-style: normal;
    line-height: 1.35;
  }

  .agent-catalog-meta {
    grid-column: 2 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .agent-catalog-meta span,
  .agent-catalog-run,
  .artifact-meta-line {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .agent-catalog-meta span,
  .agent-catalog-run {
    min-height: 25px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #101720;
    color: #9aa7b8;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 800;
    text-transform: capitalize;
  }

  .agent-catalog-run {
    margin-right: 10px;
    width: fit-content;
    max-width: 100%;
    cursor: pointer;
  }

  .agent-detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .agent-detail-header h2 {
    margin: 2px 0 5px;
    font-size: 22px;
    letter-spacing: 0;
  }

  .agent-detail-header p,
  .workbench-section p {
    margin: 0;
    color: #95a4b7;
    line-height: 1.5;
  }

  .workbench-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .workbench-metrics span {
    min-width: 0;
    min-height: 62px;
    border: 1px solid #263445;
    border-radius: 8px;
    background: #121a25;
    display: grid;
    align-content: center;
    gap: 5px;
    padding: 10px;
  }

  .workbench-metrics strong,
  .workbench-metrics em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workbench-metrics strong {
    font-size: 13px;
    text-transform: capitalize;
  }

  .workbench-metrics em,
  .workbench-lines em,
  .artifact-pipeline-heading em,
  .artifact-meta-line em {
    color: #8795a8;
    font-size: 11px;
    font-style: normal;
  }

  .workbench-section {
    min-width: 0;
    padding: 12px;
  }

  .workbench-section-title {
    color: #dfe7f2;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 850;
    margin-bottom: 9px;
  }

  .agent-skill-list,
  .workbench-two-column,
  .wizard-layout,
  .run-inspector-layout,
  .artifact-module-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .agent-skill-chip {
    min-width: 0;
    min-height: 48px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    color: #dfe7f2;
    display: grid;
    gap: 3px;
    padding: 8px 10px;
    text-align: left;
  }

  .agent-skill-chip strong,
  .agent-skill-chip em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-skill-chip em {
    color: #8d9bad;
    font-size: 11px;
    font-style: normal;
  }

  .workbench-lines {
    display: grid;
    gap: 8px;
  }

  .workbench-lines span {
    min-height: 38px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
  }

  .workbench-lines em {
    text-align: right;
    overflow-wrap: anywhere;
  }

  .wizard-form,
  .artifact-pipeline-group {
    min-width: 0;
    border: 1px solid #1f2b39;
    border-radius: 8px;
    background: #101720;
    padding: 12px;
  }

  .wizard-field {
    min-width: 0;
    display: grid;
    gap: 6px;
  }

  .wizard-field span {
    color: #8290a3;
    font-size: 11px;
    font-weight: 800;
  }

  .wizard-field input,
  .wizard-field textarea {
    width: 100%;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    color: #edf3fb;
    font: inherit;
    font-size: 13px;
    padding: 9px 10px;
  }

  .wizard-field textarea {
    min-height: 92px;
    resize: vertical;
    line-height: 1.45;
  }

  .wizard-skill-select,
  .wizard-permissions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .run-inspector-layout {
    flex: 1;
    min-height: 0;
  }

  .run-list,
  .run-detail,
  .artifact-inspector-layout {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 12px;
  }

  .run-list-row {
    width: 100%;
    min-height: 68px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #dfe7f2;
    display: grid;
    gap: 7px;
    padding: 10px;
    text-align: left;
  }

  .run-list-row + .run-list-row {
    margin-top: 8px;
  }

  .run-list-row.active {
    border-color: #31506f;
    background: #142234;
  }

  .run-list-row span {
    min-width: 0;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .run-list-row b {
    flex-shrink: 0;
    font-size: 11px;
    text-transform: capitalize;
  }

  .run-detail {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .run-step-row {
    min-width: 0;
    min-height: 58px;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto minmax(96px, auto);
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
  }

  .run-step-row > span {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #172130;
    display: grid;
    place-items: center;
    color: #9aa7b8;
    font-size: 11px;
    font-weight: 900;
  }

  .run-step-row div {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .run-step-row strong,
  .run-step-row em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .run-step-row em {
    color: #8d9bad;
    font-size: 11px;
    font-style: normal;
  }

  .run-step-row b,
  .run-step-row code {
    font-size: 11px;
    text-transform: capitalize;
  }

  .run-step-row code,
  .artifact-meta-line code {
    min-width: 0;
    border: 1px solid #263445;
    border-radius: 6px;
    background: #0d141d;
    color: #cfe1f5;
    padding: 5px 7px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artifact-inspector-layout {
    flex: 1;
  }

  .artifact-pipeline-group {
    display: grid;
    gap: 10px;
  }

  .artifact-pipeline-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .artifact-pipeline-heading div {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .artifact-pipeline-heading strong,
  .artifact-pipeline-heading em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .artifact-pipeline-heading span {
    border: 1px solid #263445;
    border-radius: 7px;
    background: #121a25;
    color: #9aa7b8;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .artifact-module-group {
    min-width: 0;
  }

  .artifact-meta-line {
    justify-content: space-between;
    gap: 10px;
  }

  .workbench-empty-state {
    min-height: 220px;
    border: 1px dashed #344456;
    border-radius: 8px;
    color: #8d9bad;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 7px;
    padding: 18px;
    text-align: center;
  }

  .skill-row {
    width: 100%;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #dfe7f2;
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 10px;
    text-align: left;
  }

  .skill-row + .skill-row {
    margin-top: 8px;
  }

  .skill-row.active {
    border-color: #31506f;
    background: #142234;
  }

  .skill-row i {
    width: 9px;
    height: 34px;
    border-radius: 6px;
  }

  .skill-row span {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .skill-row strong,
  .skill-row em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-row strong {
    font-size: 13px;
  }

  .skill-row em {
    color: #8795a8;
    font-size: 11px;
    font-style: normal;
  }

  .backstage-main {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .backstage-header,
  .artifact-title,
  .runtime-action-row {
    display: flex;
    align-items: center;
  }

  .backstage-header {
    justify-content: space-between;
    gap: 12px;
  }

  .backstage-header h1 {
    margin: 2px 0 5px;
    font-size: 24px;
    letter-spacing: 0;
  }

  .backstage-header p {
    margin: 0;
    color: #95a4b7;
    line-height: 1.45;
  }

  .backstage-metrics,
  .backstage-grid.two {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .backstage-grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .backstage-tabs {
    display: flex;
    gap: 6px;
    border-bottom: 1px solid #233042;
    padding-bottom: 8px;
    overflow-x: auto;
  }

  .backstage-tabs button {
    border: 1px solid #273648;
    border-radius: 7px;
    background: #121c27;
    color: #91a0b3;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 7px 10px;
    white-space: nowrap;
  }

  .backstage-tabs button.active {
    border-color: #4f9cff88;
    background: #17304c;
    color: #edf3fb;
  }

  .backstage-tabs button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .json-inspector {
    min-width: 0;
    padding: 12px;
    overflow: hidden;
  }

  .json-inspector pre,
  .artifact-json {
    max-height: 360px;
    overflow: auto;
    margin: 10px 0 0;
    border-radius: 7px;
    background: #081019;
    color: #cfe1f5;
    padding: 12px;
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .artifact-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .artifact-card {
    min-width: 0;
    padding: 12px;
  }

  .artifact-card p {
    color: #9aa9bb;
    line-height: 1.5;
  }

  .artifact-card code {
    color: #8bd7ff;
  }

  .artifact-title {
    gap: 8px;
    color: #edf3fb;
    font-weight: 850;
  }

  .artifact-title em {
    margin-left: auto;
    color: #8ea0b5;
    font-size: 11px;
    font-style: normal;
    text-transform: uppercase;
  }

  .markdown-preview {
    margin-top: 10px;
    color: #dbe8f6;
  }

  .markdown-preview h3 {
    margin: 0 0 8px;
    font-size: 17px;
  }

  .markdown-preview p {
    margin: 5px 0;
  }

  .markdown-list-line {
    color: #b8c7d8;
  }

  .artifact-table-wrap {
    margin-top: 10px;
    overflow: auto;
  }

  .artifact-table {
    width: 100%;
    min-width: 420px;
    border-collapse: collapse;
    font-size: 12px;
  }

  .artifact-table th,
  .artifact-table td {
    border-bottom: 1px solid #243244;
    padding: 8px;
    text-align: left;
  }

  .artifact-table th {
    color: #9fb0c3;
    background: #121d29;
  }

  .event-feed {
    display: grid;
    gap: 10px;
  }

  .event-row {
    padding: 12px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px 12px;
    align-items: center;
  }

  .event-row p {
    grid-column: 2 / 4;
    margin: 0;
    color: #9baabd;
  }

  .event-row em {
    color: #8795a8;
    font-style: normal;
    font-size: 12px;
  }

  .event-row.attention {
    border-color: #f9731655;
    background: #1d1710;
  }

  .climate-ops-panel {
    display: grid;
    gap: 12px;
  }

  .climate-ops-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .climate-report-card,
  .climate-ops-card {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #121a25;
  }

  .climate-report-card {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 14px;
  }

  .climate-report-card h2 {
    margin: 4px 0 7px;
    font-size: 18px;
    letter-spacing: 0;
  }

  .climate-report-card p {
    margin: 0;
    color: #9aa7b8;
    font-size: 13px;
    line-height: 1.5;
  }

  .climate-report-card.empty-report {
    border-style: dashed;
    background: #101720;
  }

  .climate-report-meta {
    min-width: 180px;
    display: grid;
    justify-items: end;
    align-content: start;
    gap: 5px;
    text-align: right;
  }

  .climate-report-meta strong {
    color: #edf3fb;
    font-size: 14px;
  }

  .climate-report-meta span,
  .climate-report-meta em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
  }

  .climate-ops-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 12px;
  }

  .climate-ops-card {
    min-width: 0;
    padding: 12px;
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .climate-dedup-card {
    grid-column: 1 / -1;
  }

  .climate-coverage-list,
  .climate-warning-list {
    display: grid;
    gap: 9px;
  }

  .climate-coverage-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px 12px;
    align-items: center;
  }

  .climate-coverage-row span,
  .climate-warning-row {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .climate-coverage-row strong,
  .climate-warning-row strong {
    color: #edf3fb;
    font-size: 12px;
  }

  .climate-coverage-row em,
  .climate-warning-row span,
  .climate-dedup-grid em {
    color: #8d9bad;
    font-size: 11px;
    font-style: normal;
    line-height: 1.4;
  }

  .climate-coverage-row b {
    color: #cde7f8;
    font-size: 12px;
  }

  .climate-progress {
    grid-column: 1 / -1;
    height: 7px;
    border-radius: 999px;
    background: #0a1119;
    overflow: hidden;
  }

  .climate-progress i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #14b8a6;
  }

  .climate-warning-row {
    border-left: 3px solid #4f9cff;
    padding-left: 9px;
  }

  .climate-warning-row.warning {
    border-left-color: #f2c94c;
  }

  .climate-warning-row.critical {
    border-left-color: #ef4444;
  }

  .climate-dedup-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .climate-dedup-grid span {
    min-width: 0;
    border: 1px solid #263445;
    border-radius: 7px;
    background: #0d141d;
    display: grid;
    gap: 4px;
    padding: 10px;
  }

  .climate-dedup-grid strong {
    color: #edf3fb;
    font-size: 15px;
  }

  .climate-actions {
    justify-content: space-between;
    gap: 12px;
  }

  .climate-run-options {
    min-width: min(100%, 560px);
    display: grid;
    grid-template-columns: 128px minmax(150px, 1fr) minmax(150px, 1fr);
    gap: 8px;
  }

  .climate-run-options label {
    min-width: 0;
    display: grid;
    gap: 4px;
    color: #8d9bad;
    font-size: 11px;
    font-weight: 800;
  }

  .climate-run-options input {
    min-width: 0;
    height: 32px;
    border: 1px solid #344456;
    border-radius: 7px;
    background: #0d141d;
    color: #edf3fb;
    padding: 0 9px;
    font: inherit;
    font-size: 12px;
  }

  .climate-run-options input::placeholder {
    color: #66758a;
  }

  .skill-ui-frame {
    min-height: 420px;
    border: 1px solid #263545;
    border-radius: 8px;
    overflow: hidden;
    background: #0b1118;
  }

  .skill-ui-frame iframe {
    width: 100%;
    height: 420px;
    border: 0;
    display: block;
  }

  .file-preview,
  .empty-state {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 180px;
    color: #9fb0c3;
    text-align: center;
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

  .provider-readiness {
    display: grid;
    gap: 6px;
    border: 1px solid #344456;
    border-radius: 8px;
    background: #101722;
    padding: 10px;
    color: #9aa7b8;
    font-size: 12px;
    line-height: 1.45;
  }

  .provider-readiness strong {
    color: #e6edf5;
  }

  .provider-readiness em {
    color: #f2c94c;
    font-style: normal;
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
    color: hsl(var(--muted-foreground));
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    text-align: right;
  }

  .publish-status-badge,
  .publish-save-badge {
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 999px;
    color: hsl(var(--muted-foreground));
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
    color: hsl(var(--muted-foreground));
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .publish-field input {
    width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 7px;
    background: rgba(2, 6, 23, 0.48);
    color: #edf3fb;
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
    color: #edf3fb;
    font-size: 12px;
  }

  .publish-token-meta em {
    color: hsl(var(--muted-foreground));
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
    color: #edf3fb;
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
    color: hsl(var(--muted-foreground));
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
    color: hsl(var(--muted-foreground));
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
    color: #edf3fb;
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
    color: #edf3fb;
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

  .agent-os-shell--light .chat-bubble.user,
  .agent-os-shell--light .chat-bubble.agent,
  .agent-os-shell--light .status-dot,
  .agent-os-shell--light .small-action,
  .agent-os-shell--light .icon-action,
  .agent-os-shell--light .mode-action,
  .agent-os-shell--light .agent-run-state,
  .agent-os-shell--light .workspace-preview,
  .agent-os-shell--light .backstage-tabs button,
  .agent-os-shell--light .wizard-form,
  .agent-os-shell--light .segmented-button,
  .agent-os-shell--light .toggle-row.large,
  .agent-os-shell--light .runtime-mode-button,
  .agent-os-shell--light .publish-status-badge,
  .agent-os-shell--light .publish-save-badge {
    border-color: #cbd5e1;
    background: #f8fafc;
    color: #0f172a;
  }

  .agent-os-shell--light .chat-bubble.user,
  .agent-os-shell--light .status-dot.running,
  .agent-os-shell--light .runtime-status.running,
  .agent-os-shell--light .runtime-status.resumable {
    border-color: #93c5fd;
    background: #dbeafe;
    color: #1d4ed8;
  }

  .agent-os-shell--light .mode-action.active {
    border-color: #c4b5fd;
    background: #ede9fe;
    color: #6d28d9;
  }

  .agent-os-shell--light .send-action:disabled {
    border-color: #cbd5e1;
    background: #e2e8f0;
    color: #64748b;
  }

  .agent-os-shell--light .agent-run-state.saved,
  .agent-os-shell--light .status-dot.succeeded,
  .agent-os-shell--light .runtime-status.succeeded,
  .agent-os-shell--light .publish-status-badge.published {
    border-color: #86efac;
    background: #dcfce7;
    color: #166534;
  }

  .agent-os-shell--light .agent-run-state.failed,
  .agent-os-shell--light .runtime-status.blocked {
    border-color: #fca5a5;
    background: #fee2e2;
    color: #991b1b;
  }

  .agent-os-shell--light .runtime-status.approval_required,
  .agent-os-shell--light .runtime-status.waiting_for_user,
  .agent-os-shell--light .runtime-status.waiting_for_data,
  .agent-os-shell--light .runtime-status.skipped,
  .agent-os-shell--light .publish-status-badge.paused {
    border-color: #fcd34d;
    background: #fef3c7;
    color: #92400e;
  }

  .agent-os-shell--light * {
    scrollbar-color: #94a3b8 transparent;
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
    .module-layout,
    .run-inspector-layout,
    .wizard-layout,
    .backstage-layout {
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

    .backstage-metrics,
    .workbench-metrics,
    .workbench-two-column,
    .agent-skill-list,
    .artifact-module-grid,
    .backstage-grid.two,
    .artifact-grid,
    .climate-ops-metrics,
    .climate-dedup-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .climate-ops-grid {
      grid-template-columns: 1fr;
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
      overflow: visible;
    }

    .topbar-title {
      display: none;
    }

    .topbar-actions {
      display: flex;
      width: 100%;
      min-width: 0;
    }

    .workspace-switch {
      flex: 1 1 auto;
      max-width: calc(100vw - 150px);
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .workspace-switch::-webkit-scrollbar {
      display: none;
    }

    .workspace-switch button {
      flex: 0 0 auto;
      padding: 0 8px;
    }

    .language-mode-switch {
      flex: 0 0 auto;
    }

    .portal-mode-switch {
      flex: 0 0 34px;
      justify-content: center;
      min-width: 34px;
      padding: 0;
      font-size: 0;
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
    .backstage-metrics,
    .workbench-metrics,
    .workbench-two-column,
    .agent-skill-list,
    .wizard-skill-select,
    .wizard-permissions,
    .artifact-module-grid,
    .backstage-grid.two,
    .artifact-grid,
    .climate-ops-metrics,
    .climate-ops-grid,
    .climate-dedup-grid,
    .climate-run-options,
    .memory-map {
      grid-template-columns: 1fr;
    }

    .climate-report-card,
    .climate-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .climate-report-meta {
      justify-items: start;
      text-align: left;
    }

    .backstage-header,
    .agent-detail-header,
    .artifact-pipeline-heading,
    .event-row {
      align-items: stretch;
      grid-template-columns: 1fr;
    }

    .backstage-header,
    .agent-detail-header,
    .artifact-pipeline-heading {
      flex-direction: column;
    }

    .run-step-row {
      grid-template-columns: 28px minmax(0, 1fr);
      align-items: start;
    }

    .agent-catalog-row {
      grid-template-columns: 1fr;
      gap: 0;
    }

    .agent-catalog-run {
      margin: 0 10px 10px 52px;
    }

    .run-step-row b,
    .run-step-row code {
      grid-column: 2 / -1;
      width: fit-content;
      max-width: 100%;
    }

    .event-row p {
      grid-column: auto;
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
