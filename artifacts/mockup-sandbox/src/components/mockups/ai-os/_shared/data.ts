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

export const agentTasks: AgentTask[] = [
  {
    id: "auth-api",
    title: "Ship JWT auth API",
    project: "my-rest-api",
    status: "running",
    progress: 72,
    updatedAt: "Now",
    model: "Power / GPT-4o",
    priority: "high",
  },
  {
    id: "dashboard",
    title: "Review admin dashboard",
    project: "react-dashboard",
    status: "waiting",
    progress: 48,
    updatedAt: "12m ago",
    model: "Lite / Claude Haiku",
    priority: "normal",
  },
  {
    id: "deploy",
    title: "Deploy staging preview",
    project: "stripe-webhook-test",
    status: "done",
    progress: 100,
    updatedAt: "1h ago",
    model: "Power / GPT-4o",
    priority: "low",
  },
];

export const timelineEvents: Record<string, TimelineEvent[]> = {
  "auth-api": [
    {
      id: "plan",
      kind: "plan",
      status: "done",
      title: "Plan approved",
      detail:
        "Create Express auth routes, JWT middleware, refresh-token rotation, and request throttling.",
      time: "09:41",
      artifact: "6 implementation steps",
    },
    {
      id: "deps",
      kind: "tool",
      status: "done",
      title: "Installed runtime dependencies",
      detail: "Added express-rate-limit, jsonwebtoken, bcrypt, and validation helpers.",
      time: "09:44",
      files: ["package.json", "pnpm-lock.yaml"],
    },
    {
      id: "routes",
      kind: "change",
      status: "active",
      title: "Writing route handlers",
      detail:
        "Login and refresh endpoints are wired. The agent is validating token expiry and response shapes before moving on.",
      time: "09:47",
      files: ["src/routes/auth.ts", "src/middleware/jwt.ts"],
    },
    {
      id: "approval",
      kind: "decision",
      status: "waiting",
      title: "Needs approval",
      detail:
        "Use httpOnly cookies for refresh tokens instead of returning both tokens in JSON?",
      time: "09:49",
      requiresApproval: true,
      artifact: "Security-sensitive decision",
    },
    {
      id: "tests",
      kind: "test",
      status: "queued",
      title: "Run auth contract tests",
      detail: "Queued after the refresh-token decision is confirmed.",
      time: "Next",
    },
  ],
  dashboard: [
    {
      id: "audit",
      kind: "plan",
      status: "done",
      title: "Audit finished",
      detail: "Checked chart hierarchy, loading states, and keyboard focus order.",
      time: "08:18",
    },
    {
      id: "review",
      kind: "decision",
      status: "waiting",
      title: "Waiting for review",
      detail: "Two layout choices are ready for approval before code changes.",
      time: "08:25",
      requiresApproval: true,
    },
  ],
  deploy: [
    {
      id: "build",
      kind: "test",
      status: "done",
      title: "Production build passed",
      detail: "Static assets compiled and smoke checks passed.",
      time: "07:12",
    },
    {
      id: "preview",
      kind: "preview",
      status: "done",
      title: "Preview deployed",
      detail: "Staging URL is live with webhook replay enabled.",
      time: "07:16",
    },
  ],
};

export const fileChanges: FileChange[] = [
  {
    path: "src/routes/auth.ts",
    summary: "Login, refresh, and logout endpoints",
    additions: 126,
    deletions: 8,
    status: "modified",
  },
  {
    path: "src/middleware/jwt.ts",
    summary: "Bearer token guard and typed request user",
    additions: 58,
    deletions: 0,
    status: "created",
  },
  {
    path: "src/lib/tokens.ts",
    summary: "Token signing and refresh rotation helpers",
    additions: 84,
    deletions: 11,
    status: "review",
  },
];

export const runtimeSignals: RuntimeSignal[] = [
  { label: "API server", value: "running :3000", state: "good" },
  { label: "Tests", value: "queued", state: "neutral" },
  { label: "Secrets", value: "2 required", state: "warn" },
  { label: "Preview", value: "healthy", state: "good" },
];

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
