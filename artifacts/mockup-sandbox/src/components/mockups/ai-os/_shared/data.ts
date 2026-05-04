import type {
  AgentTask,
  FileChange,
  InspectorFile,
  RuntimeSignal,
  TimelineEvent,
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
