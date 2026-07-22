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

interface AgentFirstWorkbenchDemoData {
  workbenchSkillOptions: WorkbenchSkillOption[];
  demoAgentReadiness: AgentReadiness[];
  demoAgentManifests: AgentManifestPreview[];
  demoRunInspections: WorkbenchRunInspection[];
  demoArtifactGroups: WorkbenchArtifactPipelineGroup[];
}

export function createAgentFirstWorkbenchDemoData(
  t: TFunction,
): AgentFirstWorkbenchDemoData {
  const demoRunTitle = t("agentFirst.workbenchDemo.runs.knowledgeBuilder.title");

  return {
    workbenchSkillOptions: [
      {
        skillId: "web_listening",
        name: "web_listening",
        description: t(
          "agentFirst.workbenchDemo.skills.web_listening.description",
        ),
      },
      {
        skillId: "doc_to_md",
        name: "doc_to_md",
        description: t("agentFirst.workbenchDemo.skills.doc_to_md.description"),
      },
      {
        skillId: "md_to_rag",
        name: "md_to_rag",
        description: t("agentFirst.workbenchDemo.skills.md_to_rag.description"),
      },
      {
        skillId: "rag_to_agent",
        name: "rag_to_agent",
        description: t(
          "agentFirst.workbenchDemo.skills.rag_to_agent.description",
        ),
      },
      {
        skillId: "climate_monitor",
        name: "climate_monitor",
        description: t(
          "agentFirst.workbenchDemo.skills.climate_monitor.description",
        ),
      },
      {
        skillId: "ai_actuary",
        name: "ai_actuary",
        description: t("agentFirst.workbenchDemo.skills.ai_actuary.description"),
      },
      {
        skillId: "example_reporter",
        name: "example_reporter",
        description: t(
          "agentFirst.workbenchDemo.skills.example_reporter.description",
        ),
      },
    ],
    demoAgentReadiness: [
      {
        agentId: "knowledge_builder",
        status: "ready",
        missingSkillIds: [],
        enabledSkillIds: [
          "web_listening",
          "doc_to_md",
          "md_to_rag",
        ],
      },
      {
        agentId: "climate_briefing_agent",
        status: "ready",
        missingSkillIds: [],
        enabledSkillIds: ["climate_monitor", "rag_to_agent"],
      },
    ],
    demoAgentManifests: [
      {
        agentId: "knowledge_builder",
        name: t("agentFirst.workbenchDemo.agents.knowledgeBuilder.name"),
        description: t(
          "agentFirst.workbenchDemo.agents.knowledgeBuilder.description",
        ),
        source: "builtin",
        instructions: t(
          "agentFirst.workbenchDemo.agents.knowledgeBuilder.instructions",
        ),
        skills: [
          { skillId: "web_listening", required: false },
          { skillId: "doc_to_md", required: false },
          { skillId: "md_to_rag", required: true },
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
            prompt: t(
              "agentFirst.workbenchDemo.agents.knowledgeBuilder.tests.buildFromMarkdown",
            ),
            expectedSkillIds: ["md_to_rag"],
          },
        ],
      },
      {
        agentId: "climate_briefing_agent",
        name: t("agentFirst.workbenchDemo.agents.climateBriefing.name"),
        description: t(
          "agentFirst.workbenchDemo.agents.climateBriefing.description",
        ),
        source: "custom",
        instructions: t(
          "agentFirst.workbenchDemo.agents.climateBriefing.instructions",
        ),
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
            description: t(
              "agentFirst.workbenchDemo.agents.climateBriefing.handoffs.refreshSources",
            ),
          },
        ],
        tests: [],
      },
    ],
    demoRunInspections: [
      {
        pipelineRunId: "pipe_demo_knowledge_001",
        title: demoRunTitle,
        agentId: "knowledge_builder",
        status: "running",
        activeSkillId: "md_to_rag",
        updatedAt: t("agentFirst.workbenchDemo.common.now"),
        moduleSteps: [
          {
            id: "run_web_listening_demo",
            order: 1,
            moduleId: "web_listening",
            title: t("agentFirst.workbenchDemo.runSteps.collectSources.title"),
            status: "succeeded",
            summary: t(
              "agentFirst.workbenchDemo.runSteps.collectSources.summary",
            ),
            completedAt: "09:42",
          },
          {
            id: "run_doc_to_md_demo",
            order: 2,
            moduleId: "doc_to_md",
            title: t("agentFirst.workbenchDemo.runSteps.convertDocuments.title"),
            status: "succeeded",
            summary: t(
              "agentFirst.workbenchDemo.runSteps.convertDocuments.summary",
            ),
            completedAt: "09:45",
          },
          {
            id: "run_md_to_rag_demo",
            order: 3,
            moduleId: "md_to_rag",
            title: t("agentFirst.workbenchDemo.runSteps.prepareRag.title"),
            status: "running",
            summary: t("agentFirst.workbenchDemo.runSteps.prepareRag.summary"),
            activeSkillId: "md_to_rag",
            startedAt: "09:46",
          },
        ],
        events: [
          {
            id: "event_plan",
            time: "09:40",
            type: "plan",
            status: "succeeded",
            title: t("agentFirst.workbenchDemo.events.plan.title"),
            detail: t("agentFirst.workbenchDemo.events.plan.detail"),
          },
          {
            id: "event_artifacts",
            time: "09:45",
            type: "artifact",
            status: "succeeded",
            title: t("agentFirst.workbenchDemo.events.artifacts.title"),
            detail: t("agentFirst.workbenchDemo.events.artifacts.detail"),
          },
          {
            id: "event_active",
            time: t("agentFirst.workbenchDemo.common.now"),
            type: "module",
            status: "running",
            title: t("agentFirst.workbenchDemo.events.active.title"),
            detail: t("agentFirst.workbenchDemo.events.active.detail"),
          },
        ],
        raw: {
          source: "demo",
          pipelineRunId: "pipe_demo_knowledge_001",
          metadata: { agentId: "knowledge_builder" },
        },
      },
    ],
    demoArtifactGroups: [
      {
        pipelineRunId: "pipe_demo_knowledge_001",
        title: demoRunTitle,
        moduleGroups: [
          {
            moduleRunId: "run_web_listening_demo",
            moduleId: "web_listening",
            artifacts: [
              {
                id: "snap_018",
                title: t("agentFirst.workbenchDemo.artifacts.snapshot.title"),
                kind: "web_snapshot",
                summary: t(
                  "agentFirst.workbenchDemo.artifacts.snapshot.summary",
                ),
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
                summary: t(
                  "agentFirst.workbenchDemo.artifacts.markdown.summary",
                ),
                moduleRunId: "run_doc_to_md_demo",
                moduleId: "doc_to_md",
                createdAt: "09:45",
                content: t(
                  "agentFirst.workbenchDemo.artifacts.markdown.content",
                ),
              },
            ],
          },
        ],
      },
    ],
  };
}

export const {
  workbenchSkillOptions,
  demoAgentReadiness,
  demoAgentManifests,
  demoRunInspections,
  demoArtifactGroups,
} = createAgentFirstWorkbenchDemoData(defaultLegacyAiT);
