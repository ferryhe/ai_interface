import type { TFunction } from "i18next";

import { enUS } from "../../../../i18n/locales/en-US";
import type {
  AgentManifestPreview,
  AgentReadiness,
  AgentTask,
  FileChange,
  InspectorFile,
  RuntimeSignal,
  TimelineEvent,
  WorkbenchArtifactPipelineGroup,
  WorkbenchRunInspection,
  WorkbenchSkillOption,
} from "./types";

type LegacyAiValues = Record<string, string | number>;

type AgentTaskSeed = Omit<AgentTask, "title" | "updatedAt" | "model"> & {
  titleKey: string;
  updatedAtKey: string;
  modelKey: string;
};

type TimelineEventSeed = Omit<
  TimelineEvent,
  "title" | "detail" | "time" | "artifact"
> & {
  titleKey: string;
  detailKey: string;
  time?: string;
  timeKey?: string;
  artifactKey?: string;
};

type FileChangeSeed = Omit<FileChange, "summary"> & {
  summaryKey: string;
};

type RuntimeSignalSeed = Omit<RuntimeSignal, "label" | "value"> & {
  labelKey: string;
  valueKey: string;
};

function lookupEnglishLegacyAi(path: string): string {
  const value = path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, enUS.translation);

  return typeof value === "string" ? value : path;
}

function interpolateLegacyAiText(
  text: string,
  values: LegacyAiValues = {},
): string {
  return text.replace(/{{\s*([^}\s]+)\s*}}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

const defaultLegacyAiT = ((key: string, values?: LegacyAiValues) =>
  interpolateLegacyAiText(lookupEnglishLegacyAi(key), values)) as TFunction;

const legacyTaskSeeds: AgentTaskSeed[] = [
  {
    id: "auth-api",
    titleKey: "legacyAi.data.tasks.authApi.title",
    project: "my-rest-api",
    status: "running",
    progress: 72,
    updatedAtKey: "legacyAi.data.tasks.authApi.updatedAt",
    modelKey: "legacyAi.data.tasks.authApi.model",
    priority: "high",
  },
  {
    id: "dashboard",
    titleKey: "legacyAi.data.tasks.dashboard.title",
    project: "react-dashboard",
    status: "waiting",
    progress: 48,
    updatedAtKey: "legacyAi.data.tasks.dashboard.updatedAt",
    modelKey: "legacyAi.data.tasks.dashboard.model",
    priority: "normal",
  },
  {
    id: "deploy",
    titleKey: "legacyAi.data.tasks.deploy.title",
    project: "stripe-webhook-test",
    status: "done",
    progress: 100,
    updatedAtKey: "legacyAi.data.tasks.deploy.updatedAt",
    modelKey: "legacyAi.data.tasks.deploy.model",
    priority: "low",
  },
];

const legacyTimelineEventSeeds: Record<string, TimelineEventSeed[]> = {
  "auth-api": [
    {
      id: "plan",
      kind: "plan",
      status: "done",
      titleKey: "legacyAi.data.timeline.authApi.plan.title",
      detailKey: "legacyAi.data.timeline.authApi.plan.detail",
      time: "09:41",
      artifactKey: "legacyAi.data.timeline.authApi.plan.artifact",
    },
    {
      id: "deps",
      kind: "tool",
      status: "done",
      titleKey: "legacyAi.data.timeline.authApi.deps.title",
      detailKey: "legacyAi.data.timeline.authApi.deps.detail",
      time: "09:44",
      files: ["package.json", "pnpm-lock.yaml"],
    },
    {
      id: "routes",
      kind: "change",
      status: "active",
      titleKey: "legacyAi.data.timeline.authApi.routes.title",
      detailKey: "legacyAi.data.timeline.authApi.routes.detail",
      time: "09:47",
      files: ["src/routes/auth.ts", "src/middleware/jwt.ts"],
    },
    {
      id: "approval",
      kind: "decision",
      status: "waiting",
      titleKey: "legacyAi.data.timeline.authApi.approval.title",
      detailKey: "legacyAi.data.timeline.authApi.approval.detail",
      time: "09:49",
      requiresApproval: true,
      artifactKey: "legacyAi.data.timeline.authApi.approval.artifact",
    },
    {
      id: "tests",
      kind: "test",
      status: "queued",
      titleKey: "legacyAi.data.timeline.authApi.tests.title",
      detailKey: "legacyAi.data.timeline.authApi.tests.detail",
      timeKey: "legacyAi.data.timeline.authApi.tests.time",
    },
  ],
  dashboard: [
    {
      id: "audit",
      kind: "plan",
      status: "done",
      titleKey: "legacyAi.data.timeline.dashboard.audit.title",
      detailKey: "legacyAi.data.timeline.dashboard.audit.detail",
      time: "08:18",
    },
    {
      id: "review",
      kind: "decision",
      status: "waiting",
      titleKey: "legacyAi.data.timeline.dashboard.review.title",
      detailKey: "legacyAi.data.timeline.dashboard.review.detail",
      time: "08:25",
      requiresApproval: true,
    },
  ],
  deploy: [
    {
      id: "build",
      kind: "test",
      status: "done",
      titleKey: "legacyAi.data.timeline.deploy.build.title",
      detailKey: "legacyAi.data.timeline.deploy.build.detail",
      time: "07:12",
    },
    {
      id: "preview",
      kind: "preview",
      status: "done",
      titleKey: "legacyAi.data.timeline.deploy.preview.title",
      detailKey: "legacyAi.data.timeline.deploy.preview.detail",
      time: "07:16",
    },
  ],
};

const legacyFileChangeSeeds: FileChangeSeed[] = [
  {
    path: "src/routes/auth.ts",
    summaryKey: "legacyAi.data.fileChanges.authRoutes.summary",
    additions: 126,
    deletions: 8,
    status: "modified",
  },
  {
    path: "src/middleware/jwt.ts",
    summaryKey: "legacyAi.data.fileChanges.jwtMiddleware.summary",
    additions: 58,
    deletions: 0,
    status: "created",
  },
  {
    path: "src/lib/tokens.ts",
    summaryKey: "legacyAi.data.fileChanges.tokenLib.summary",
    additions: 84,
    deletions: 11,
    status: "review",
  },
];

const legacyRuntimeSignalSeeds: RuntimeSignalSeed[] = [
  {
    labelKey: "legacyAi.data.runtimeSignals.apiServer.label",
    valueKey: "legacyAi.data.runtimeSignals.apiServer.value",
    state: "good",
  },
  {
    labelKey: "legacyAi.data.runtimeSignals.tests.label",
    valueKey: "legacyAi.data.runtimeSignals.tests.value",
    state: "neutral",
  },
  {
    labelKey: "legacyAi.data.runtimeSignals.secrets.label",
    valueKey: "legacyAi.data.runtimeSignals.secrets.value",
    state: "warn",
  },
  {
    labelKey: "legacyAi.data.runtimeSignals.preview.label",
    valueKey: "legacyAi.data.runtimeSignals.preview.value",
    state: "good",
  },
];

export function createLegacyAiAgentTasks(t: TFunction): AgentTask[] {
  return legacyTaskSeeds.map(
    ({ titleKey, updatedAtKey, modelKey, ...task }) => ({
      ...task,
      title: t(titleKey),
      updatedAt: t(updatedAtKey),
      model: t(modelKey),
    }),
  );
}

export function createLegacyAiTimelineEvents(
  t: TFunction,
): Record<string, TimelineEvent[]> {
  return Object.fromEntries(
    Object.entries(legacyTimelineEventSeeds).map(([taskId, events]) => [
      taskId,
      events.map(
        ({
          titleKey,
          detailKey,
          time,
          timeKey,
          artifactKey,
          ...event
        }) => ({
          ...event,
          title: t(titleKey),
          detail: t(detailKey),
          time: timeKey ? t(timeKey) : (time ?? ""),
          ...(artifactKey ? { artifact: t(artifactKey) } : {}),
        }),
      ),
    ]),
  );
}

export function createLegacyAiFileChanges(t: TFunction): FileChange[] {
  return legacyFileChangeSeeds.map(({ summaryKey, ...change }) => ({
    ...change,
    summary: t(summaryKey),
  }));
}

export function createLegacyAiRuntimeSignals(t: TFunction): RuntimeSignal[] {
  return legacyRuntimeSignalSeeds.map(({ labelKey, valueKey, ...signal }) => ({
    ...signal,
    label: t(labelKey),
    value: t(valueKey),
  }));
}

export const agentTasks = createLegacyAiAgentTasks(defaultLegacyAiT);

export const timelineEvents = createLegacyAiTimelineEvents(defaultLegacyAiT);

export const fileChanges = createLegacyAiFileChanges(defaultLegacyAiT);

export const runtimeSignals = createLegacyAiRuntimeSignals(defaultLegacyAiT);

export const inspectorFile: InspectorFile = {
  path: "src/routes/auth.ts",
  language: "ts",
  lines: [
    "import { Router } from 'express';",
    "import rateLimit from 'express-rate-limit';",
    "import { issueTokens, rotateRefreshToken } from '../lib/tokens';",
    "",
    "const router = Router();",
    "",
    "const authLimiter = rateLimit({",
    "  windowMs: 15 * 60 * 1000,",
    "  max: 100,",
    "});",
    "",
    "router.post('/login', authLimiter, async (req, res) => {",
    "  const user = await verifyCredentials(req.body);",
    "  const tokens = await issueTokens(user.id);",
    "  res.json(tokens);",
    "});",
  ],
};

export const inspectorLogs = [
  "09:44 pnpm install express-rate-limit jsonwebtoken bcrypt",
  "09:45 generated src/middleware/jwt.ts",
  "09:47 updated src/routes/auth.ts",
  "09:48 warning refresh token transport needs approval",
  "09:49 paused before auth contract tests",
];

export const workbenchSkillOptions: WorkbenchSkillOption[] = [
  {
    skillId: "web_listening",
    name: "web_listening",
    description: "Monitor URLs, create snapshots, extract text, and detect changes.",
  },
  {
    skillId: "doc_to_md",
    name: "doc_to_md",
    description: "Convert source documents into Markdown with warnings and assets.",
  },
  {
    skillId: "md_to_rag",
    name: "md_to_rag",
    description: "Chunk Markdown and prepare RAG index records.",
  },
  {
    skillId: "rag_to_agent",
    name: "rag_to_agent",
    description: "Generate agent configuration, prompts, and validation output.",
  },
  {
    skillId: "climate_monitor",
    name: "climate_monitor",
    description: "Track climate and actuarial monitor reports and source coverage.",
  },
  {
    skillId: "ai_actuary",
    name: "ai_actuary",
    description: "Invoke the reserving pipeline through the safe CLI executor.",
  },
  {
    skillId: "example_reporter",
    name: "example_reporter",
    description: "Community manifest example for custom skill validation.",
  },
];

export const demoAgentReadiness: AgentReadiness[] = [
  {
    agentId: "knowledge_builder",
    status: "ready",
    missingSkillIds: [],
    enabledSkillIds: ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
  },
  {
    agentId: "climate_briefing_agent",
    status: "ready",
    missingSkillIds: [],
    enabledSkillIds: ["climate_monitor", "rag_to_agent"],
  },
];

export const demoAgentManifests: AgentManifestPreview[] = [
  {
    agentId: "knowledge_builder",
    name: "Knowledge Builder",
    description: "Turn approved web and document sources into a RAG-backed agent configuration.",
    source: "builtin",
    instructions:
      "Build an inspectable knowledge pipeline from approved sources. Plan with the smallest set of enabled skills that can monitor sources, convert documents, prepare RAG records, and generate an agent configuration. Preserve intermediate artifacts for review.",
    skills: [
      { skillId: "web_listening", required: false },
      { skillId: "doc_to_md", required: false },
      { skillId: "md_to_rag", required: true },
      { skillId: "rag_to_agent", required: true },
    ],
    planner: {
      mode: "dag",
      failureStrategy: "fail_fast",
    },
    permissions: {
      approvalRequired: true,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
    memory: {
      promotionMode: "run_summary",
    },
    handoffs: [],
    tests: [
      {
        name: "build_from_markdown",
        prompt: "Build an agent from approved Markdown source material.",
        expectedSkillIds: ["md_to_rag", "rag_to_agent"],
      },
    ],
  },
  {
    agentId: "climate_briefing_agent",
    name: "Climate Briefing Agent",
    description: "Summarize climate monitor outputs and prepare review-ready briefings.",
    source: "custom",
    instructions:
      "Use climate monitor artifacts as the source of truth, preserve source coverage notes, and hand draft briefings to the publishing agent only after validation.",
    skills: [
      { skillId: "climate_monitor", required: true },
      { skillId: "rag_to_agent", required: false },
    ],
    planner: {
      mode: "linear",
      failureStrategy: "fail_fast",
    },
    permissions: {
      approvalRequired: true,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
    memory: {
      promotionMode: "run_summary",
    },
    handoffs: [
      {
        targetAgentId: "knowledge_builder",
        description: "Refresh source material when coverage changes.",
      },
    ],
    tests: [],
  },
];

export const demoRunInspections: WorkbenchRunInspection[] = [
  {
    pipelineRunId: "pipe_demo_knowledge_001",
    title: "Knowledge Builder demo run",
    agentId: "knowledge_builder",
    status: "running",
    activeSkillId: "md_to_rag",
    updatedAt: "Now",
    moduleSteps: [
      {
        id: "run_web_listening_demo",
        order: 1,
        moduleId: "web_listening",
        title: "Collect approved sources",
        status: "succeeded",
        summary: "18 snapshots and 3 change events stored.",
        completedAt: "09:42",
      },
      {
        id: "run_doc_to_md_demo",
        order: 2,
        moduleId: "doc_to_md",
        title: "Convert documents",
        status: "succeeded",
        summary: "6 Markdown documents with one warning.",
        completedAt: "09:45",
      },
      {
        id: "run_md_to_rag_demo",
        order: 3,
        moduleId: "md_to_rag",
        title: "Prepare RAG records",
        status: "running",
        summary: "96 of 124 chunks indexed.",
        activeSkillId: "md_to_rag",
        startedAt: "09:46",
      },
      {
        id: "run_rag_to_agent_demo",
        order: 4,
        moduleId: "rag_to_agent",
        title: "Draft agent config",
        status: "queued",
        summary: "Waiting for the RAG index artifact.",
      },
    ],
    events: [
      {
        id: "event_plan",
        time: "09:40",
        type: "plan",
        status: "succeeded",
        title: "Plan created",
        detail: "DAG plan selected four bound skills.",
      },
      {
        id: "event_artifacts",
        time: "09:45",
        type: "artifact",
        status: "succeeded",
        title: "Markdown artifacts stored",
        detail: "doc_to_md wrote 6 displayable Markdown artifacts.",
      },
      {
        id: "event_active",
        time: "Now",
        type: "module",
        status: "running",
        title: "md_to_rag running",
        detail: "Chunk metadata is being normalized for retrieval.",
      },
    ],
    raw: {
      source: "demo",
      pipelineRunId: "pipe_demo_knowledge_001",
      metadata: { agentId: "knowledge_builder" },
    },
  },
];

export const demoArtifactGroups: WorkbenchArtifactPipelineGroup[] = [
  {
    pipelineRunId: "pipe_demo_knowledge_001",
    title: "Knowledge Builder demo run",
    moduleGroups: [
      {
        moduleRunId: "run_web_listening_demo",
        moduleId: "web_listening",
        artifacts: [
          {
            id: "snap_018",
            title: "Latest page snapshot",
            kind: "web_snapshot",
            summary: "Approved source page snapshot with extracted text metadata.",
            moduleRunId: "run_web_listening_demo",
            moduleId: "web_listening",
            createdAt: "09:42",
            content: {
              url: "https://docs.example.com/getting-started",
              status: 200,
              extractedTextBytes: 18442,
            },
          },
        ],
      },
      {
        moduleRunId: "run_doc_to_md_demo",
        moduleId: "doc_to_md",
        artifacts: [
          {
            id: "md_006",
            title: "onboarding.md",
            kind: "markdown_document",
            summary: "Markdown conversion output with provenance retained.",
            moduleRunId: "run_doc_to_md_demo",
            moduleId: "doc_to_md",
            createdAt: "09:45",
            content:
              "# Onboarding\n\nUse the guided setup to connect sources, confirm document quality, and publish a searchable assistant.",
          },
        ],
      },
    ],
  },
];
