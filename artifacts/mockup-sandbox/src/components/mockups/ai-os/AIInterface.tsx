import { useState, useRef, useCallback, useEffect } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const PREDEFINED_TASKS = [
  "Build a REST API with auth",
  "Create a React dashboard",
  "Set up a PostgreSQL database",
  "Deploy to production",
  "Write unit tests",
  "Add dark mode",
];

type AgentFrameworkId = "replit" | "hermes" | "openai-fn" | "anthropic-tools" | "custom";

const PAST_TASKS: {
  id: number; title: string; time: string; status: "done" | "running" | "failed";
  aiConfig: { providerId: string; modelId: string; modelName: string; framework: AgentFrameworkId };
}[] = [
  { id: 1, title: "Build a landing page for SaaS", time: "2h ago", status: "done", aiConfig: { providerId: "nous", modelId: "hermes-3-llama-3.1-405b", modelName: "Hermes 3 405B", framework: "hermes" } },
  { id: 2, title: "Add Stripe payment integration", time: "Yesterday", status: "done", aiConfig: { providerId: "openai", modelId: "gpt-4o", modelName: "GPT-4o", framework: "openai-fn" } },
  { id: 3, title: "Fix authentication bug in Express", time: "2 days ago", status: "done", aiConfig: { providerId: "anthropic", modelId: "claude-3-5-sonnet", modelName: "Claude 3.5 Sonnet", framework: "anthropic-tools" } },
  { id: 4, title: "Create admin dashboard with charts", time: "3 days ago", status: "done", aiConfig: { providerId: "nous", modelId: "hermes-3-llama-3.1-70b", modelName: "Hermes 3 70B", framework: "hermes" } },
  { id: 5, title: "Set up CI/CD with GitHub Actions", time: "5 days ago", status: "done", aiConfig: { providerId: "openai", modelId: "gpt-4o-mini", modelName: "GPT-4o mini", framework: "replit" } },
];

type AgentFramework = {
  id: AgentFrameworkId;
  name: string;
  tagline: string;
  color: string;
  bg: string;
  logo: string;
  description: string;
  systemFormat: string;
  toolCallFormat: string;
  toolResultFormat: string;
  loopSteps: string[];
  pros: string[];
  native: boolean;
};

const AGENT_FRAMEWORKS: AgentFramework[] = [
  {
    id: "replit",
    name: "Replit Agent",
    tagline: "Orchestrated planning loop",
    color: "#f26522",
    bg: "#1a1008",
    logo: "R",
    description: "Replit's own agent framework. Uses a structured planning loop where the agent reasons about the task, uses tools via a custom parse step, verifies the result, and checkpoints progress.",
    systemFormat: `You are an AI coding agent.
Available tools:
- shell(cmd): run shell command
- read_file(path): read file
- write_file(path, content): write file
- browser(url): open web page
- deploy(): deploy project

Respond with tool calls using:
<tool>tool_name: argument</tool>`,
    toolCallFormat: `<tool>shell: pnpm install express</tool>
<tool>write_file: src/index.ts
import express from 'express'...
</tool>`,
    toolResultFormat: `<tool_result>
{"status": "ok", "output": "added 47 packages"}
</tool_result>`,
    loopSteps: ["Plan task", "Call tools", "Parse response", "Execute tool", "Feed result back", "Verify + checkpoint"],
    pros: ["Deep Replit integration", "Automatic checkpoints", "File system access", "Streaming output"],
    native: false,
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    tagline: "Native <tool_call> tokens",
    color: "#bc8cff",
    bg: "#120a20",
    logo: "H",
    description: "Nous Research Hermes models are trained natively on tool calling with special XML tokens. No prompt engineering needed — the model intrinsically understands function calling format.",
    systemFormat: `<tools>
[
  {
    "name": "shell",
    "description": "Run a shell command",
    "parameters": {
      "type": "object",
      "properties": {
        "cmd": {"type": "string"}
      },
      "required": ["cmd"]
    }
  }
]
</tools>
You are a helpful coding assistant.`,
    toolCallFormat: `<tool_call>
{"name": "shell", "arguments": {"cmd": "pnpm install express"}}
</tool_call>`,
    toolResultFormat: `<tool_response>
{"name": "shell", "content": {"status": "ok", "output": "added 47 packages"}}
</tool_response>`,
    loopSteps: ["Send <tools> schema", "Model outputs <tool_call>", "Parse XML token", "Execute function", "Inject <tool_response>", "Model continues"],
    pros: ["Natively trained format", "Parallel tool calls", "Low hallucination rate", "Open weights"],
    native: true,
  },
  {
    id: "openai-fn",
    name: "OpenAI Functions",
    tagline: "tools[] + finish_reason",
    color: "#3fb950",
    bg: "#0a1a0e",
    logo: "⊕",
    description: "OpenAI's structured tool calling via the Chat Completions API. Pass tool definitions as JSON Schema — the model returns structured tool_calls that you execute and feed back as role: tool messages.",
    systemFormat: `// Request body
{
  "model": "gpt-4o",
  "tools": [{
    "type": "function",
    "function": {
      "name": "shell",
      "description": "Run shell command",
      "parameters": {
        "type": "object",
        "properties": {
          "cmd": {"type": "string"}
        }
      }
    }
  }],
  "tool_choice": "auto"
}`,
    toolCallFormat: `// Response (finish_reason: "tool_calls")
{
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "shell",
      "arguments": "{\"cmd\":\"pnpm install\"}"
    }
  }]
}`,
    toolResultFormat: `// Follow-up message
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "added 47 packages"
}`,
    loopSteps: ["Send tools[] schema", "Receive tool_calls", "Parse JSON args", "Execute function", "Post role:tool message", "Loop until done"],
    pros: ["Industry standard", "Parallel calls", "Structured args", "Works with all OpenAI models"],
    native: false,
  },
  {
    id: "anthropic-tools",
    name: "Anthropic Tools",
    tagline: "tool_use content blocks",
    color: "#d97706",
    bg: "#1a1206",
    logo: "✦",
    description: "Anthropic Claude's tool use via content blocks. Tools are defined with input_schema, and the model returns tool_use blocks in the content array when it wants to call a function.",
    systemFormat: `// Request body
{
  "model": "claude-3-5-sonnet",
  "tools": [{
    "name": "shell",
    "description": "Run a shell command",
    "input_schema": {
      "type": "object",
      "properties": {
        "cmd": {"type": "string"}
      },
      "required": ["cmd"]
    }
  }]
}`,
    toolCallFormat: `// Response (stop_reason: "tool_use")
{
  "content": [{
    "type": "tool_use",
    "id": "toolu_01A09q90qw90lq",
    "name": "shell",
    "input": {"cmd": "pnpm install express"}
  }]
}`,
    toolResultFormat: `// Follow-up user message
{
  "role": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_01A09q90qw90lq",
    "content": "added 47 packages"
  }]
}`,
    loopSteps: ["Send tools + input_schema", "Receive tool_use block", "Extract input JSON", "Execute function", "Post tool_result block", "Continue until text"],
    pros: ["Clean content blocks", "Built-in thinking", "Extended context", "Vision + tools combined"],
    native: false,
  },
];

const CHAT_MESSAGES = [
  { id: 1, role: "user", content: "Build a REST API with authentication using Express and JWT" },
  {
    id: 2, role: "agent",
    content: "I'll build a complete REST API with JWT authentication. Let me set up the project structure.",
    steps: [
      { label: "Setting up Express server", done: true },
      { label: "Installing dependencies", done: true },
      { label: "Creating auth middleware", done: true },
      { label: "Writing route handlers", done: false, active: true },
    ],
  },
  { id: 3, role: "user", content: "Also add rate limiting and refresh tokens" },
];

const FILE_TREE: { name: string; type: "folder" | "file"; depth: number; open?: boolean; ext?: string; active?: boolean }[] = [
  { name: "src", type: "folder", depth: 0, open: true },
  { name: "index.ts", type: "file", depth: 1, ext: "ts" },
  { name: "routes", type: "folder", depth: 1, open: true },
  { name: "auth.ts", type: "file", depth: 2, ext: "ts", active: true },
  { name: "users.ts", type: "file", depth: 2, ext: "ts" },
  { name: "middleware", type: "folder", depth: 1, open: true },
  { name: "jwt.ts", type: "file", depth: 2, ext: "ts" },
  { name: "rateLimit.ts", type: "file", depth: 2, ext: "ts" },
  { name: "package.json", type: "file", depth: 0, ext: "json" },
  { name: ".env", type: "file", depth: 0, ext: "env" },
];

const CODE_CONTENT = `import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email });
  if (!user || !await user.comparePassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  res.json({ accessToken, refreshToken });
});

export default router;`;

// ─── AI API DATA ──────────────────────────────────────────────────────────────

type ModelProvider = {
  id: string;
  name: string;
  logo: string;
  color: string;
  bg: string;
  models: {
    id: string;
    name: string;
    description: string;
    context: string;
    tags: string[];
    featured?: boolean;
  }[];
};

const AI_PROVIDERS: ModelProvider[] = [
  {
    id: "nous",
    name: "Nous Research",
    logo: "N",
    color: "#a78bfa",
    bg: "#1e1535",
    models: [
      { id: "hermes-3-llama-3.1-405b", name: "Hermes 3 — Llama 3.1 405B", description: "Most capable Hermes model. Excels at complex reasoning, agentic tasks, and long-context understanding.", context: "128k", tags: ["Agentic", "Reasoning"], featured: true },
      { id: "hermes-3-llama-3.1-70b", name: "Hermes 3 — Llama 3.1 70B", description: "Fast and capable. Great balance of speed and intelligence for production workloads.", context: "128k", tags: ["Fast", "Balanced"] },
      { id: "hermes-2-pro-llama-3-8b", name: "Hermes 2 Pro — Llama 3 8B", description: "Optimized for function calling and structured JSON output.", context: "8k", tags: ["Function Calling", "JSON"] },
      { id: "hermes-2-mixtral-8x7b", name: "Hermes 2 — Mixtral 8×7B", description: "MoE architecture tuned for instruction following and code generation.", context: "32k", tags: ["Code", "MoE"] },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    logo: "⬡",
    color: "#10a37f",
    bg: "#0a1f1a",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Most capable multimodal model. Handles text, images, and audio natively.", context: "128k", tags: ["Multimodal", "Vision"], featured: true },
      { id: "gpt-4o-mini", name: "GPT-4o mini", description: "Fast and cost-efficient. Ideal for high-throughput tasks and real-time applications.", context: "128k", tags: ["Fast", "Cheap"] },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "High intelligence with an updated knowledge cutoff and vision support.", context: "128k", tags: ["Vision", "Reasoning"] },
      { id: "o1-preview", name: "o1 Preview", description: "Frontier model designed for complex multi-step reasoning and science.", context: "128k", tags: ["Reasoning", "Science"] },
      { id: "o1-mini", name: "o1 mini", description: "Smaller, faster reasoning model optimized for STEM tasks.", context: "64k", tags: ["Reasoning", "STEM"] },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    logo: "◈",
    color: "#d97757",
    bg: "#1e1108",
    models: [
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", description: "Best combination of speed and intelligence. Excellent at coding and analysis.", context: "200k", tags: ["Coding", "Analysis"], featured: true },
      { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", description: "Fastest and most compact Claude model for near-instant responsiveness.", context: "200k", tags: ["Fast", "Cheap"] },
      { id: "claude-3-opus", name: "Claude 3 Opus", description: "Top-level intelligence for highly complex tasks requiring deep understanding.", context: "200k", tags: ["Reasoning", "Creative"] },
    ],
  },
  {
    id: "google",
    name: "Google",
    logo: "G",
    color: "#4285f4",
    bg: "#080e1f",
    models: [
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Multimodal model with the longest context window. Processes text, images, video, and audio.", context: "2M", tags: ["Multimodal", "Long Context"], featured: true },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fast and versatile performance across a diverse variety of tasks.", context: "1M", tags: ["Fast", "Multimodal"] },
      { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash-8B", description: "High volume, lower intelligence tasks. Optimized for cost efficiency.", context: "1M", tags: ["Cheap", "High Volume"] },
    ],
  },
  {
    id: "meta",
    name: "Meta",
    logo: "∞",
    color: "#0866ff",
    bg: "#040d1f",
    models: [
      { id: "llama-3.1-405b", name: "Llama 3.1 405B", description: "Most capable open-weight model. Approaches frontier closed-source models.", context: "128k", tags: ["Open Source", "Reasoning"], featured: true },
      { id: "llama-3.1-70b", name: "Llama 3.1 70B", description: "Great balance of capability and speed for most tasks.", context: "128k", tags: ["Open Source", "Balanced"] },
      { id: "llama-3.1-8b", name: "Llama 3.1 8B", description: "Lightweight model for on-device and edge deployments.", context: "128k", tags: ["Open Source", "Fast"] },
      { id: "llama-3.2-vision-11b", name: "Llama 3.2 Vision 11B", description: "Multimodal model supporting image understanding tasks.", context: "128k", tags: ["Open Source", "Vision"] },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    logo: "M",
    color: "#ff7000",
    bg: "#1a0d00",
    models: [
      { id: "mistral-large", name: "Mistral Large 2", description: "Top-tier reasoning for complex tasks. Fluent in English, French, Spanish, German, Italian.", context: "128k", tags: ["Multilingual", "Reasoning"], featured: true },
      { id: "mistral-small", name: "Mistral Small 3", description: "State-of-the-art small model optimized for low-latency workloads.", context: "32k", tags: ["Fast", "Cheap"] },
      { id: "mixtral-8x22b", name: "Mixtral 8×22B", description: "High-capability sparse MoE model. Excels at code and math.", context: "64k", tags: ["MoE", "Code", "Math"] },
      { id: "codestral", name: "Codestral", description: "Purpose-built for code generation, completion, and fill-in-the-middle tasks.", context: "32k", tags: ["Code"] },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    logo: "D",
    color: "#4f8ef7",
    bg: "#060f22",
    models: [
      { id: "deepseek-v3", name: "DeepSeek V3", description: "Latest flagship model excelling at coding, math, and reasoning tasks.", context: "64k", tags: ["Coding", "Math"], featured: true },
      { id: "deepseek-r1", name: "DeepSeek R1", description: "Reasoning model matching OpenAI o1 performance on math and coding benchmarks.", context: "64k", tags: ["Reasoning", "Math"] },
      { id: "deepseek-coder-v2", name: "DeepSeek Coder V2", description: "Specialized for code completion with support for 338 programming languages.", context: "128k", tags: ["Code"] },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    logo: "X",
    color: "#e1e4e8",
    bg: "#0e0e0e",
    models: [
      { id: "grok-2", name: "Grok 2", description: "State-of-the-art model with real-time knowledge via X/Twitter integration.", context: "128k", tags: ["Real-time", "Reasoning"], featured: true },
      { id: "grok-2-vision", name: "Grok 2 Vision", description: "Multimodal version with image understanding capabilities.", context: "32k", tags: ["Vision", "Real-time"] },
    ],
  },
  {
    id: "cohere",
    name: "Cohere",
    logo: "C",
    color: "#39d353",
    bg: "#041209",
    models: [
      { id: "command-r-plus", name: "Command R+", description: "Optimized for RAG and tool use. Best-in-class retrieval augmented generation.", context: "128k", tags: ["RAG", "Tool Use"], featured: true },
      { id: "command-r", name: "Command R", description: "Highly performant generative model for enterprise production use cases.", context: "128k", tags: ["Enterprise", "Balanced"] },
    ],
  },
  {
    id: "together",
    name: "Together AI",
    logo: "T",
    color: "#f5a623",
    bg: "#1a1000",
    models: [
      { id: "qwen-2.5-72b", name: "Qwen 2.5 72B Instruct", description: "Alibaba's latest frontier model. Strong multilingual and coding performance.", context: "128k", tags: ["Multilingual", "Code"], featured: true },
      { id: "yi-large", name: "Yi Large", description: "01.AI's top model with strong performance across reasoning and knowledge tasks.", context: "32k", tags: ["Reasoning"] },
      { id: "dbrx-instruct", name: "DBRX Instruct", description: "Databricks' mixture-of-experts model for enterprise AI applications.", context: "32k", tags: ["MoE", "Enterprise"] },
    ],
  },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Tab = "tasks" | "new" | "account";
type PanelId = "console" | "shell" | "webview" | "git" | "packages" | "secrets" | "database" | "search" | "debugger" | "deploy";

const ALL_PANELS: PanelId[] = ["console", "shell", "webview", "git", "packages", "secrets", "database", "search", "debugger", "deploy"];
const PANEL_ICONS: Record<PanelId, string> = {
  console: "▸", shell: "$", webview: "◉", git: "⎇", packages: "⬡",
  secrets: "🔑", database: "◫", search: "⌕", debugger: "⬤", deploy: "↑",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function FileIcon({ ext }: { ext?: string }) {
  const colors: Record<string, string> = { ts: "#3178c6", js: "#f7df1e", json: "#cbcb41", env: "#8bc34a", md: "#519aba" };
  const labels: Record<string, string> = { ts: "TS", js: "JS", json: "{}", env: "ENV", md: "MD" };
  const color = ext ? colors[ext] || "#888" : "#888";
  const label = ext ? labels[ext] || ext.toUpperCase() : "";
  return (
    <span style={{ fontSize: "9px", color, fontWeight: 700, fontFamily: "monospace", width: 20, display: "inline-block", textAlign: "center" }}>
      {label}
    </span>
  );
}

function syntaxHighlight(line: string): string {
  const keywords = ["import", "from", "const", "let", "async", "await", "return", "if", "export", "default", "function"];
  let r = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  r = r.replace(/('.*?'|".*?")/g, '<span style="color:#a5d6ff">$1</span>');
  r = r.replace(/\/\/.*/g, '<span style="color:#8b949e">$&</span>');
  r = r.replace(/\b(\d+)\b/g, '<span style="color:#f2cc60">$1</span>');
  keywords.forEach(kw => { r = r.replace(new RegExp(`\\b(${kw})\\b`, "g"), '<span style="color:#ff7b72">$1</span>'); });
  return r;
}

// ─── PANEL COMPONENTS ─────────────────────────────────────────────────────────

function ConsolePanel() {
  const [lines, setLines] = useState([
    { type: "info", text: "> pnpm install" },
    { type: "success", text: "Packages: +124" },
    { type: "info", text: "> node src/index.ts" },
    { type: "success", text: "Server running on port 3000" },
    { type: "info", text: "GET /api/health 200 2ms" },
    { type: "error", text: "POST /api/auth/login 401 Unauthorized" },
    { type: "success", text: "POST /api/auth/login 200 45ms" },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const run = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    const responses: Record<string, { type: string; text: string }[]> = {
      "clear": [],
      "ls": [{ type: "info", text: "src/  package.json  .env  node_modules/" }],
      "pwd": [{ type: "info", text: "/home/runner/project" }],
      "node --version": [{ type: "success", text: "v20.11.0" }],
      "pnpm --version": [{ type: "success", text: "9.1.0" }],
    };
    if (cmd === "clear") { setLines([]); setInput(""); return; }
    const out = responses[cmd] || [{ type: "error", text: `bash: ${cmd}: command not found` }];
    setLines(prev => [...prev, { type: "info", text: `> ${cmd}` }, ...out]);
    setInput("");
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ lineHeight: 1.8, color: l.type === "success" ? "#3fb950" : l.type === "error" ? "#f85149" : "#8b949e", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#484f58" }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ flex: 1 }}>{l.text}</span>
            {l.type === "error" && (
              <button title="Ask Agent to fix this error"
                style={{ background: "#f2652222", border: "1px solid #f2652266", borderRadius: 4, padding: "1px 8px", color: "#f26522", fontSize: 10, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f2652244"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f2652222"; }}>
                <span>✦</span> Fix with Agent
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ borderTop: "1px solid #21262d", padding: "6px 12px", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: "#f26522" }}>▸</span>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
          placeholder="Run a command…"
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, fontFamily: "monospace" }}
        />
      </div>
    </div>
  );
}

function ShellPanel() {
  const [history, setHistory] = useState([
    { prompt: true, text: "" },
    { prompt: false, text: "Welcome to the Shell. Type commands below." },
    { prompt: true, text: "ls -la" },
    { prompt: false, text: "total 32\ndrwxr-xr-x  5 runner runner 4096 May  3 10:00 .\ndrwxr-xr-x 15 runner runner 4096 May  3 09:55 ..\n-rw-r--r--  1 runner runner  234 May  3 10:00 .env\n-rw-r--r--  1 runner runner 1204 May  3 09:58 package.json\ndrwxr-xr-x  3 runner runner 4096 May  3 09:57 src" },
    { prompt: true, text: "cat .env" },
    { prompt: false, text: "PORT=3000\nJWT_SECRET=super_secret_key\nREFRESH_SECRET=refresh_key\nDB_URL=postgresql://localhost:5432/mydb" },
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>(["ls -la", "cat .env"]);
  const [histIdx, setHistIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);

  const run = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    const responses: Record<string, string> = {
      "pwd": "/home/runner/project",
      "whoami": "runner",
      "date": new Date().toString(),
      "echo hello": "hello",
      "node --version": "v20.11.0",
      "git status": "On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  modified:   src/routes/auth.ts\n\nno changes added to commit",
      "git log --oneline -5": "7141ff8 Add auth middleware\na3b2c1d Setup Express server\n9f8e7d6 Initial commit",
      "clear": "__clear__",
    };
    if (cmd === "clear") { setHistory([]); setInput(""); setCmdHistory(p => [cmd, ...p]); return; }
    const out = responses[cmd] || `bash: ${cmd}: command not found`;
    setHistory(prev => [...prev, { prompt: true, text: cmd }, { prompt: false, text: out }]);
    setCmdHistory(p => [cmd, ...p]);
    setHistIdx(-1);
    setInput("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") run();
    else if (e.key === "ArrowUp") {
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx] || "");
    } else if (e.key === "ArrowDown") {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : cmdHistory[idx]);
    }
  };

  useEffect(() => { endRef.current?.scrollIntoView(); }, [history]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {history.map((h, i) => (
          <div key={i}>
            {h.prompt ? (
              <div style={{ display: "flex", gap: 6, color: "#e1e4e8", lineHeight: 1.8 }}>
                <span style={{ color: "#3fb950" }}>runner@ai-os</span>
                <span>:</span>
                <span style={{ color: "#58a6ff" }}>~/project</span>
                <span>$ {h.text}</span>
              </div>
            ) : (
              h.text.split("\n").map((line, j) => (
                <div key={j} style={{ color: "#8b949e", lineHeight: 1.7 }}>{line}</div>
              ))
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, color: "#e1e4e8", alignItems: "center" }}>
          <span style={{ color: "#3fb950" }}>runner@ai-os</span><span>:</span>
          <span style={{ color: "#58a6ff" }}>~/project</span><span>$</span>
          <input
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, fontFamily: "monospace" }}
            autoFocus
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}

function WebviewPanel() {
  const [url, setUrl] = useState("http://localhost:3000");
  const [editingUrl, setEditingUrl] = useState(url);
  const [loading, setLoading] = useState(false);
  const [status] = useState<"running" | "stopped">("running");

  const navigate = () => {
    setLoading(true);
    setUrl(editingUrl);
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, padding: "6px 10px", borderBottom: "1px solid #21262d", alignItems: "center" }}>
        <button onClick={() => {}} style={btnStyle("#21262d")}>←</button>
        <button onClick={() => {}} style={btnStyle("#21262d")}>→</button>
        <button onClick={navigate} style={btnStyle("#21262d")}>{loading ? "✕" : "↺"}</button>
        <div style={{ flex: 1, background: "#0e1117", border: "1px solid #30363d", borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: status === "running" ? "#3fb950" : "#f85149", fontSize: 10 }}>●</span>
          <input
            value={editingUrl} onChange={e => setEditingUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && navigate()}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#8b949e", fontSize: 12, fontFamily: "monospace" }}
          />
        </div>
        <button style={btnStyle("#1f6feb22", "#58a6ff", "#1f6feb")}>Open ↗</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0d11" }}>
        {loading ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f26522", fontSize: 20, marginBottom: 8 }}>◌</div>
            <div style={{ color: "#8b949e", fontSize: 12 }}>Loading…</div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#3fb950", fontSize: 32, marginBottom: 12 }}>◉</div>
            <div style={{ color: "#e1e4e8", fontWeight: 600, marginBottom: 4 }}>Server running</div>
            <div style={{ color: "#8b949e", fontSize: 12, fontFamily: "monospace" }}>{url}</div>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
              {["/api/health → 200", "/api/users → 200", "/api/auth/login → 401"].map(r => (
                <div key={r} style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>{r}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const GIT_FILES = [
  { path: "src/routes/auth.ts", status: "M", lines: "+47 -12" },
  { path: "src/middleware/jwt.ts", status: "M", lines: "+23 -5" },
  { path: "src/middleware/rateLimit.ts", status: "A", lines: "+38" },
  { path: ".env", status: "M", lines: "+2 -1" },
];

const GIT_LOG = [
  { hash: "7141ff8", msg: "Add auth middleware", author: "You", time: "2h ago", branch: "main" },
  { hash: "a3b2c1d", msg: "Setup Express server", author: "You", time: "4h ago" },
  { hash: "9f8e7d6", msg: "Add rate limiting", author: "You", time: "Yesterday" },
  { hash: "3c4d5e6", msg: "Initial project setup", author: "You", time: "2 days ago" },
];

const DIFF_CONTENT = `@@ -1,8 +1,12 @@
 import express from 'express';
 import jwt from 'jsonwebtoken';
+import rateLimit from 'express-rate-limit';
 
 const router = express.Router();
 
+const limiter = rateLimit({
+  windowMs: 15 * 60 * 1000,
+  max: 100,
+});
+
-router.post('/login', async (req, res) => {
+router.post('/login', limiter, async (req, res) => {`;

function GitPanel() {
  const [view, setView] = useState<"changes" | "log" | "diff" | "branches">("changes");
  const [staged, setStaged] = useState<string[]>([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [committed, setCommitted] = useState(false);

  const toggleStage = (path: string) =>
    setStaged(s => s.includes(path) ? s.filter(p => p !== path) : [...s, path]);

  const commit = () => {
    if (!commitMsg.trim() || staged.length === 0) return;
    setCommitted(true);
    setTimeout(() => { setCommitted(false); setCommitMsg(""); setStaged([]); }, 2000);
  };

  const statusColor = (s: string) => s === "M" ? "#f2cc60" : s === "A" ? "#3fb950" : s === "D" ? "#f85149" : "#8b949e";
  const statusLabel = (s: string) => s === "M" ? "modified" : s === "A" ? "added" : s === "D" ? "deleted" : s;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #21262d", padding: "0 12px" }}>
        {(["changes", "log", "diff", "branches"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "6px 12px", background: "none", border: "none",
            borderBottom: view === v ? "2px solid #f26522" : "2px solid transparent",
            color: view === v ? "#e1e4e8" : "#8b949e", cursor: "pointer",
            fontSize: 12, fontFamily: "inherit", textTransform: "capitalize",
          }}>{v}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8b949e" }}>
          <span style={{ color: "#3fb950" }}>⎇</span> main
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {view === "changes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
              Changed files ({GIT_FILES.length})
            </div>
            {GIT_FILES.map(f => (
              <div key={f.path} onClick={() => toggleStage(f.path)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                borderRadius: 4, cursor: "pointer",
                background: staged.includes(f.path) ? "#1f6feb11" : "transparent",
                border: staged.includes(f.path) ? "1px solid #1f6feb33" : "1px solid transparent",
              }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${staged.includes(f.path) ? "#1f6feb" : "#30363d"}`, background: staged.includes(f.path) ? "#1f6feb" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                  {staged.includes(f.path) && <span style={{ color: "#fff" }}>✓</span>}
                </div>
                <span style={{ color: statusColor(f.status), fontWeight: 700, fontSize: 11, width: 14 }}>{f.status}</span>
                <span style={{ flex: 1, color: "#e1e4e8", fontSize: 12, fontFamily: "monospace" }}>{f.path}</span>
                <span style={{ color: "#3fb950", fontSize: 11 }}>{f.lines}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>Commit message</span>
                <span style={{ color: staged.length > 0 ? "#3fb950" : "#484f58" }}>{staged.length} staged</span>
              </div>
              <textarea
                value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
                placeholder="Describe your changes…"
                style={{ width: "100%", background: "#21262d", border: "1px solid #30363d", borderRadius: 6, color: "#e1e4e8", fontSize: 12, padding: 8, resize: "none", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                rows={2}
              />
              <button
                onClick={commit}
                disabled={!commitMsg.trim() || staged.length === 0}
                style={{ marginTop: 6, width: "100%", background: committed ? "#238636" : (staged.length > 0 && commitMsg.trim() ? "#1f6feb" : "#21262d"), border: "none", borderRadius: 6, color: committed ? "#fff" : (staged.length > 0 && commitMsg.trim() ? "#fff" : "#484f58"), padding: "7px 0", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
              >
                {committed ? "✓ Committed!" : `Commit ${staged.length > 0 ? staged.length + " file" + (staged.length > 1 ? "s" : "") : ""}`}
              </button>
            </div>
          </div>
        )}

        {view === "log" && (
          <div>
            {GIT_LOG.map((c, i) => (
              <div key={c.hash} style={{ padding: "8px 0", borderBottom: "1px solid #21262d22", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "#3fb950" : "#30363d", marginTop: 5, flexShrink: 0, border: i === 0 ? "2px solid #3fb95055" : "none" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ color: "#e1e4e8", fontSize: 12 }}>{c.msg}</span>
                    {c.branch && <span style={{ background: "#3fb95022", border: "1px solid #3fb95055", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "#3fb950" }}>{c.branch}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                    <span style={{ color: "#58a6ff", fontFamily: "monospace" }}>{c.hash}</span>
                    <span style={{ color: "#8b949e" }}>{c.author}</span>
                    <span style={{ color: "#484f58" }}>{c.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "diff" && (
          <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.7 }}>
            <div style={{ color: "#58a6ff", marginBottom: 8, fontSize: 11 }}>src/routes/auth.ts</div>
            {DIFF_CONTENT.split("\n").map((line, i) => (
              <div key={i} style={{ paddingLeft: 8, background: line.startsWith("+") ? "#23863620" : line.startsWith("-") ? "#f8514920" : "transparent", color: line.startsWith("@@") ? "#d2a8ff" : line.startsWith("+") ? "#3fb950" : line.startsWith("-") ? "#f85149" : "#8b949e" }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {view === "branches" && (
          <div>
            {[
              { name: "main", current: true, updated: "2h ago" },
              { name: "feature/rate-limiting", current: false, updated: "Yesterday" },
              { name: "feature/refresh-tokens", current: false, updated: "3 days ago" },
            ].map(b => (
              <div key={b.name} style={{ padding: "8px", borderRadius: 6, marginBottom: 4, background: b.current ? "#1f6feb11" : "transparent", border: b.current ? "1px solid #1f6feb33" : "1px solid transparent", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: b.current ? "#3fb950" : "#8b949e" }}>⎇</span>
                <span style={{ flex: 1, color: b.current ? "#e1e4e8" : "#8b949e", fontSize: 12 }}>{b.name}</span>
                {b.current && <span style={{ background: "#3fb95022", color: "#3fb950", fontSize: 10, padding: "1px 6px", borderRadius: 4, border: "1px solid #3fb95044" }}>current</span>}
                <span style={{ color: "#484f58", fontSize: 11 }}>{b.updated}</span>
              </div>
            ))}
            <button style={{ marginTop: 8, width: "100%", background: "#21262d", border: "1px solid #30363d", borderRadius: 6, color: "#8b949e", padding: "6px 0", fontSize: 12, cursor: "pointer" }}>
              + New branch
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type PackageRow = {
  name: string;
  version: string;
  type: "prod" | "dev";
  size: string;
  isNew?: boolean;
};

const PACKAGES: PackageRow[] = [
  { name: "express", version: "4.18.2", type: "prod", size: "208 kB" },
  { name: "jsonwebtoken", version: "9.0.2", type: "prod", size: "48 kB" },
  { name: "express-rate-limit", version: "7.1.5", type: "prod", size: "32 kB" },
  { name: "bcryptjs", version: "2.4.3", type: "prod", size: "44 kB" },
  { name: "@types/express", version: "4.17.21", type: "dev", size: "118 kB" },
  { name: "typescript", version: "5.4.2", type: "dev", size: "68 MB" },
  { name: "vitest", version: "1.4.0", type: "dev", size: "2.1 MB" },
];

function PackagesPanel() {
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [addPkg, setAddPkg] = useState("");

  const filtered = PACKAGES.filter(p => p.name.includes(search));
  const packageRows: PackageRow[] = [
    ...installed.map((n): PackageRow => ({ name: n, version: "latest", type: "prod", size: "—", isNew: true })),
    ...filtered,
  ];

  const addPackage = () => {
    if (!addPkg.trim()) return;
    setInstalling(addPkg.trim());
    setTimeout(() => { setInstalled(p => [...p, addPkg.trim()]); setInstalling(null); setAddPkg(""); }, 1500);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d", display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: "#21262d", border: "1px solid #30363d", borderRadius: 6, display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
          <span style={{ color: "#484f58" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search packages…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={addPkg} onChange={e => setAddPkg(e.target.value)} onKeyDown={e => e.key === "Enter" && addPackage()} placeholder="Add package…"
            style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, color: "#e1e4e8", fontSize: 12, padding: "4px 10px", outline: "none", fontFamily: "inherit", width: 130 }} />
          <button onClick={addPackage} style={btnStyle(addPkg ? "#1f6feb" : "#21262d", addPkg ? "#fff" : "#484f58")}>
            {installing ? "…" : "+ Install"}
          </button>
        </div>
      </div>
      {installing && (
        <div style={{ padding: "6px 12px", background: "#1f6feb11", borderBottom: "1px solid #1f6feb33", fontSize: 11, color: "#58a6ff", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
          Installing {installing}…
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "4px 12px 2px", display: "grid", gridTemplateColumns: "1fr 100px 60px 80px", gap: 8, fontSize: 10, color: "#484f58", textTransform: "uppercase", letterSpacing: 1 }}>
          <span>Package</span><span>Version</span><span>Type</span><span>Size</span>
        </div>
        {packageRows.map(pkg => (
          <div key={pkg.name} style={{ padding: "5px 12px", display: "grid", gridTemplateColumns: "1fr 100px 60px 80px", gap: 8, alignItems: "center", borderBottom: "1px solid #21262d22" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#e1e4e8", fontSize: 12 }}>{pkg.name}</span>
              {pkg.isNew && <span style={{ background: "#3fb95022", color: "#3fb950", fontSize: 9, padding: "1px 5px", borderRadius: 4, border: "1px solid #3fb95044" }}>new</span>}
            </div>
            <span style={{ color: "#8b949e", fontSize: 12, fontFamily: "monospace" }}>{pkg.version}</span>
            <span style={{ fontSize: 10, color: pkg.type === "dev" ? "#d2a8ff" : "#58a6ff", background: pkg.type === "dev" ? "#d2a8ff11" : "#58a6ff11", borderRadius: 3, padding: "1px 5px", textAlign: "center" }}>{pkg.type}</span>
            <span style={{ color: "#484f58", fontSize: 11 }}>{pkg.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const INITIAL_SECRETS = [
  { key: "JWT_SECRET", value: "super_secret_key_xyz", revealed: false },
  { key: "REFRESH_SECRET", value: "refresh_key_abc_123", revealed: false },
  { key: "DB_URL", value: "postgresql://localhost:5432/mydb", revealed: false },
  { key: "PORT", value: "3000", revealed: true },
  { key: "NODE_ENV", value: "development", revealed: true },
];

function SecretsPanel() {
  const [secrets, setSecrets] = useState(INITIAL_SECRETS);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = (key: string) => setSecrets(s => s.map(x => x.key === key ? { ...x, revealed: !x.revealed } : x));
  const remove = (key: string) => setSecrets(s => s.filter(x => x.key !== key));
  const add = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    setSecrets(s => [...s, { key: newKey.trim(), value: newVal.trim(), revealed: false }]);
    setNewKey(""); setNewVal("");
  };
  const copy = (key: string) => { setCopied(key); setTimeout(() => setCopied(null), 1500); };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d", display: "flex", gap: 6 }}>
        <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="KEY"
          style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 6, color: "#e1e4e8", fontSize: 12, padding: "4px 10px", outline: "none", fontFamily: "monospace", width: 130 }} />
        <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value"
          onKeyDown={e => e.key === "Enter" && add()}
          style={{ flex: 1, background: "#21262d", border: "1px solid #30363d", borderRadius: 6, color: "#e1e4e8", fontSize: 12, padding: "4px 10px", outline: "none", fontFamily: "monospace" }} />
        <button onClick={add} style={btnStyle(newKey && newVal ? "#1f6feb" : "#21262d", newKey && newVal ? "#fff" : "#484f58")}>+ Add</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {secrets.map(s => (
          <div key={s.key} style={{ padding: "8px 12px", borderBottom: "1px solid #21262d22", display: "flex", gap: 8, alignItems: "center" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#21262d22")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ width: 14, height: 14, borderRadius: 3, background: "#21262d", border: "1px solid #30363d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#3fb950" }}>✓</div>
            <span style={{ width: 140, color: "#e1e4e8", fontSize: 12, fontFamily: "monospace", fontWeight: 500 }}>{s.key}</span>
            <div style={{ flex: 1, background: "#0e1117", borderRadius: 4, padding: "3px 8px", fontFamily: "monospace", fontSize: 12, color: s.revealed ? "#a5d6ff" : "#484f58" }}>
              {s.revealed ? s.value : "●".repeat(Math.min(s.value.length, 20))}
            </div>
            <button onClick={() => toggle(s.key)} style={iconBtn}>{s.revealed ? "👁" : "🔒"}</button>
            <button onClick={() => copy(s.key)} style={iconBtn}>{copied === s.key ? "✓" : "⎘"}</button>
            <button onClick={() => remove(s.key)} style={{ ...iconBtn, color: "#f85149" }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatabasePanel() {
  const [query, setQuery] = useState("SELECT id, email, created_at FROM users LIMIT 10;");
  const [results, setResults] = useState<null | { cols: string[]; rows: (string | number)[][] }>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"query" | "tables">("query");

  const MOCK_RESULTS: Record<string, { cols: string[]; rows: (string | number)[][] }> = {
    "SELECT id, email, created_at FROM users LIMIT 10;": {
      cols: ["id", "email", "created_at"],
      rows: [
        [1, "alice@example.com", "2024-01-15 10:23:00"],
        [2, "bob@example.com", "2024-01-16 14:05:00"],
        [3, "charlie@example.com", "2024-02-01 09:11:00"],
        [4, "diana@example.com", "2024-02-10 17:42:00"],
        [5, "eve@example.com", "2024-03-05 08:30:00"],
      ],
    },
    "SELECT COUNT(*) FROM users;": { cols: ["count"], rows: [[42]] },
  };

  const run = () => {
    setRunning(true); setError(null); setResults(null);
    setTimeout(() => {
      const q = query.trim();
      if (MOCK_RESULTS[q]) setResults(MOCK_RESULTS[q]);
      else if (q.toLowerCase().startsWith("select")) setResults({ cols: ["result"], rows: [["Query executed — 0 rows returned"]] });
      else if (q.toLowerCase().startsWith("insert") || q.toLowerCase().startsWith("update") || q.toLowerCase().startsWith("delete")) setResults({ cols: ["result"], rows: [["1 row affected"]] });
      else setError("ERROR: syntax error at or near \"" + q.split(" ")[0] + "\"");
      setRunning(false);
    }, 600);
  };

  const TABLES = [
    { name: "users", rows: 42, cols: ["id", "email", "password_hash", "created_at"] },
    { name: "sessions", rows: 127, cols: ["id", "user_id", "token", "expires_at"] },
    { name: "refresh_tokens", rows: 89, cols: ["id", "user_id", "token", "revoked"] },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #21262d", padding: "0 12px" }}>
        {(["query", "tables"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 12px", background: "none", border: "none", borderBottom: tab === t ? "2px solid #f26522" : "2px solid transparent", color: tab === t ? "#e1e4e8" : "#8b949e", cursor: "pointer", fontSize: 12, fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#3fb950", gap: 4 }}>
          <span>●</span> postgresql://localhost:5432/mydb
        </div>
      </div>

      {tab === "query" && (
        <>
          <div style={{ padding: 10, borderBottom: "1px solid #21262d", position: "relative" }}>
            <textarea value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
              style={{ width: "100%", background: "#0e1117", border: "1px solid #30363d", borderRadius: 6, color: "#a5d6ff", fontSize: 12, padding: "8px 10px", resize: "none", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
              rows={3}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
              <button onClick={run} disabled={running} style={btnStyle("#1f6feb", "#fff")}>
                {running ? "⟳ Running…" : "▶ Run (⌘↵)"}
              </button>
              <span style={{ fontSize: 11, color: "#484f58" }}>Ctrl+Enter to run</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {error && <div style={{ color: "#f85149", fontSize: 12, fontFamily: "monospace", background: "#f8514911", border: "1px solid #f8514933", borderRadius: 4, padding: 8 }}>{error}</div>}
            {results && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>{results.cols.map(c => <th key={c} style={{ padding: "5px 10px", textAlign: "left", color: "#8b949e", borderBottom: "1px solid #30363d", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {results.rows.map((row, i) => (
                    <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      {row.map((cell, j) => <td key={j} style={{ padding: "5px 10px", borderBottom: "1px solid #21262d22", color: "#e1e4e8", fontFamily: "monospace" }}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!results && !error && !running && <div style={{ color: "#484f58", fontSize: 12, textAlign: "center", marginTop: 20 }}>Run a query to see results</div>}
          </div>
        </>
      )}

      {tab === "tables" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {TABLES.map(t => (
            <div key={t.name} style={{ marginBottom: 12, border: "1px solid #21262d", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ padding: "6px 10px", background: "#21262d", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#e3b341" }}>◫</span>
                <span style={{ color: "#e1e4e8", fontSize: 12, fontWeight: 500 }}>{t.name}</span>
                <span style={{ color: "#484f58", fontSize: 11, marginLeft: "auto" }}>{t.rows} rows</span>
              </div>
              <div style={{ padding: "6px 10px" }}>
                {t.cols.map(c => <span key={c} style={{ display: "inline-block", background: "#0e1117", border: "1px solid #30363d", borderRadius: 3, padding: "1px 6px", fontSize: 11, color: "#8b949e", fontFamily: "monospace", margin: "2px" }}>{c}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ file: string; line: number; text: string; match: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [replaceVal, setReplaceVal] = useState("");
  const [showReplace, setShowReplace] = useState(false);

  const SEARCH_DB = [
    { file: "src/routes/auth.ts", line: 4, text: "const router = express.Router();", match: "router" },
    { file: "src/routes/auth.ts", line: 12, text: "router.post('/login', limiter, async (req, res) => {", match: "router" },
    { file: "src/routes/users.ts", line: 3, text: "const router = express.Router();", match: "router" },
    { file: "src/index.ts", line: 8, text: "app.use('/auth', authRouter);", match: "router" },
    { file: "src/middleware/jwt.ts", line: 1, text: "import jwt from 'jsonwebtoken';", match: "jwt" },
    { file: "src/routes/auth.ts", line: 2, text: "import jwt from 'jsonwebtoken';", match: "jwt" },
  ];

  const search = () => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    setTimeout(() => {
      const q = caseSensitive ? query : query.toLowerCase();
      const found = SEARCH_DB.filter(r => (caseSensitive ? r.text : r.text.toLowerCase()).includes(q) || r.match.includes(q.split("").slice(0, 3).join("")));
      setResults(found);
      setSearching(false);
    }, 300);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1, background: "#21262d", border: "1px solid #30363d", borderRadius: 6, display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
            <span style={{ color: "#484f58", fontSize: 13 }}>⌕</span>
            <input value={query} onChange={e => { setQuery(e.target.value); }} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Search in files… (Enter)"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, fontFamily: "inherit" }} />
          </div>
          <button onClick={() => setCaseSensitive(c => !c)} style={btnStyle(caseSensitive ? "#1f6feb22" : "#21262d", caseSensitive ? "#58a6ff" : "#8b949e", caseSensitive ? "#1f6feb" : "#30363d")} title="Case sensitive">Aa</button>
          <button onClick={() => setRegex(r => !r)} style={btnStyle(regex ? "#1f6feb22" : "#21262d", regex ? "#58a6ff" : "#8b949e", regex ? "#1f6feb" : "#30363d")} title="Regex">.*</button>
          <button onClick={() => setShowReplace(s => !s)} style={btnStyle(showReplace ? "#1f6feb22" : "#21262d", showReplace ? "#58a6ff" : "#8b949e", showReplace ? "#1f6feb" : "#30363d")}>⇄</button>
        </div>
        {showReplace && (
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, background: "#21262d", border: "1px solid #30363d", borderRadius: 6, display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
              <span style={{ color: "#484f58", fontSize: 11 }}>→</span>
              <input value={replaceVal} onChange={e => setReplaceVal(e.target.value)} placeholder="Replace with…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, fontFamily: "inherit" }} />
            </div>
            <button style={btnStyle("#21262d")}>Replace</button>
            <button style={btnStyle("#21262d")}>Replace All</button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {searching && <div style={{ color: "#8b949e", fontSize: 12, textAlign: "center", padding: 12 }}>Searching…</div>}
        {!searching && results.length === 0 && query && <div style={{ color: "#484f58", fontSize: 12, textAlign: "center", padding: 12 }}>No results for "{query}"</div>}
        {!searching && !query && <div style={{ color: "#484f58", fontSize: 12, textAlign: "center", padding: 12 }}>Type to search across all files</div>}
        {results.map((r, i) => (
          <div key={i} style={{ padding: "4px 12px", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#21262d22")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {(i === 0 || results[i - 1].file !== r.file) && (
              <div style={{ color: "#58a6ff", fontSize: 11, fontFamily: "monospace", marginTop: i > 0 ? 8 : 0, marginBottom: 3 }}>{r.file}</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: "#484f58", fontSize: 10, fontFamily: "monospace", width: 24, textAlign: "right", flexShrink: 0 }}>{r.line}</span>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#8b949e" }}
                dangerouslySetInnerHTML={{ __html: r.text.replace(query, `<span style="background:#f2cc6033;color:#f2cc60">${query}</span>`) }}
              />
            </div>
          </div>
        ))}
        {results.length > 0 && <div style={{ color: "#484f58", fontSize: 11, padding: "8px 12px" }}>{results.length} result{results.length !== 1 ? "s" : ""}</div>}
      </div>
    </div>
  );
}

const BREAKPOINTS = [
  { file: "src/routes/auth.ts", line: 13, active: true, condition: "" },
  { file: "src/middleware/jwt.ts", line: 7, active: false, condition: "token === null" },
];

const CALL_STACK = [
  { fn: "authenticateUser", file: "auth.ts", line: 13 },
  { fn: "POST /login", file: "auth.ts", line: 12 },
  { fn: "Layer.handle", file: "express/router/layer.js", line: 95 },
  { fn: "next", file: "express/router/route.js", line: 137 },
];

const VARIABLES = [
  { name: "req.body", value: '{ email: "alice@…", password: "…" }', type: "object" },
  { name: "user", value: "{ id: 1, email: 'alice@example.com' }", type: "object" },
  { name: "accessToken", value: '"eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp…"', type: "string" },
];

function DebuggerPanel() {
  const [paused, setPaused] = useState(true);
  const [bps, setBps] = useState(BREAKPOINTS);
  const [tab, setTab] = useState<"vars" | "stack" | "breakpoints">("vars");

  const toggleBp = (i: number) => setBps(b => b.map((x, j) => j === i ? { ...x, active: !x.active } : x));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { icon: "▶", label: "Continue", color: paused ? "#3fb950" : "#484f58", action: () => setPaused(false) },
            { icon: "⬤", label: "Pause", color: !paused ? "#f2cc60" : "#484f58", action: () => setPaused(true) },
            { icon: "↷", label: "Step over", color: "#8b949e", action: () => {} },
            { icon: "↳", label: "Step into", color: "#8b949e", action: () => {} },
            { icon: "↑", label: "Step out", color: "#8b949e", action: () => {} },
            { icon: "↺", label: "Restart", color: "#8b949e", action: () => setPaused(true) },
            { icon: "■", label: "Stop", color: "#f85149", action: () => setPaused(false) },
          ].map(({ icon, label, color, action }) => (
            <button key={label} onClick={action} title={label}
              style={{ background: "none", border: "none", color, cursor: "pointer", fontSize: 16, padding: "2px 6px", borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >{icon}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: paused ? "#f2cc60" : "#3fb950", display: "flex", gap: 4, alignItems: "center" }}>
          <span>●</span>{paused ? "Paused at auth.ts:13" : "Running"}
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #21262d", padding: "0 12px" }}>
        {(["vars", "stack", "breakpoints"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "5px 10px", background: "none", border: "none", borderBottom: tab === t ? "2px solid #f26522" : "2px solid transparent", color: tab === t ? "#e1e4e8" : "#8b949e", cursor: "pointer", fontSize: 11, fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {tab === "vars" && (
          <div>
            {VARIABLES.map(v => (
              <div key={v.name} style={{ padding: "4px 8px", borderBottom: "1px solid #21262d22", display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: "#d2a8ff", fontSize: 12, fontFamily: "monospace", width: 140, flexShrink: 0 }}>{v.name}</span>
                <span style={{ color: v.type === "string" ? "#a5d6ff" : "#e1e4e8", fontSize: 11, fontFamily: "monospace", flex: 1 }}>{v.value}</span>
                <span style={{ color: "#484f58", fontSize: 10 }}>{v.type}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "stack" && (
          <div>
            {CALL_STACK.map((f, i) => (
              <div key={i} style={{ padding: "5px 8px", cursor: "pointer", borderBottom: "1px solid #21262d22", background: i === 0 ? "#1f6feb11" : "transparent" }}
                onMouseEnter={e => { if (i !== 0) e.currentTarget.style.background = "#21262d22"; }}
                onMouseLeave={e => { e.currentTarget.style.background = i === 0 ? "#1f6feb11" : "transparent"; }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  {i === 0 && <span style={{ color: "#f2cc60", fontSize: 10 }}>▶</span>}
                  {i !== 0 && <span style={{ color: "#484f58", fontSize: 10 }}>○</span>}
                  <span style={{ color: i === 0 ? "#e1e4e8" : "#8b949e", fontSize: 12 }}>{f.fn}</span>
                </div>
                <div style={{ marginLeft: 14, fontSize: 11, color: "#484f58", fontFamily: "monospace" }}>{f.file}:{f.line}</div>
              </div>
            ))}
          </div>
        )}
        {tab === "breakpoints" && (
          <div>
            {bps.map((bp, i) => (
              <div key={i} style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #21262d22" }}>
                <button onClick={() => toggleBp(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: bp.active ? "#f85149" : "#484f58", padding: 0 }}>⬤</button>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e1e4e8", fontSize: 12, fontFamily: "monospace" }}>{bp.file}:{bp.line}</div>
                  {bp.condition && <div style={{ color: "#8b949e", fontSize: 11 }}>if: {bp.condition}</div>}
                </div>
                <button onClick={() => setBps(b => b.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            ))}
            <button style={{ margin: "8px", background: "#21262d", border: "1px solid #30363d", borderRadius: 4, color: "#8b949e", padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>+ Add breakpoint</button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeployPanel() {
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(true);
  const [logs, setLogs] = useState([
    "✓ Build completed in 3.2s",
    "✓ Tests passed (47/47)",
    "✓ Docker image pushed",
    "✓ Deployment successful",
  ]);
  const [tab, setTab] = useState<"overview" | "logs" | "settings">("overview");

  const deploy = () => {
    setDeploying(true);
    setLogs(["⟳ Building…"]);
    const steps = ["✓ Installing dependencies", "✓ Running tests", "✓ Building Docker image", "✓ Pushing to registry", "✓ Updating deployment", "✓ Health check passed — live!"];
    steps.forEach((s, i) => setTimeout(() => {
      setLogs(prev => [...prev, s]);
      if (i === steps.length - 1) { setDeploying(false); setDeployed(true); }
    }, (i + 1) * 700));
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #21262d", padding: "0 12px" }}>
        {(["overview", "logs", "settings"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 12px", background: "none", border: "none", borderBottom: tab === t ? "2px solid #f26522" : "2px solid transparent", color: tab === t ? "#e1e4e8" : "#8b949e", cursor: "pointer", fontSize: 12, fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {tab === "overview" && (
          <div>
            <div style={{ background: deployed ? "#3fb95011" : "#21262d", border: `1px solid ${deployed ? "#3fb95044" : "#30363d"}`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: deployed ? "#3fb950" : "#8b949e", boxShadow: deployed ? "0 0 8px #3fb95066" : "none" }} />
                <span style={{ color: "#e1e4e8", fontWeight: 600 }}>Production</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#484f58" }}>Deployed 2h ago</span>
              </div>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  ["URL", "https://my-api.replit.app"],
                  ["Region", "US East (Virginia)"],
                  ["Instance", "512 MB RAM · 0.5 vCPU"],
                  ["Uptime", "99.9% (30d)"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: "#484f58", width: 70 }}>{k}</span>
                    <span style={{ color: k === "URL" ? "#58a6ff" : "#8b949e" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Traffic (last 24h)</div>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 40 }}>
                {[30, 45, 60, 35, 80, 55, 90, 70, 65, 85, 95, 75, 60, 50, 70, 88, 92, 78, 65, 82, 90, 95, 88, 72].map((h, i) => (
                  <div key={i} style={{ flex: 1, background: `rgba(31, 111, 235, ${0.3 + h / 200})`, borderRadius: "2px 2px 0 0", height: `${h}%` }} />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={deploy} disabled={deploying} style={{ flex: 1, background: "#1f6feb", border: "none", borderRadius: 6, color: "#fff", padding: "8px 0", fontSize: 13, cursor: deploying ? "default" : "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                {deploying ? "⟳ Deploying…" : "↑ Deploy"}
              </button>
              <button style={btnStyle("#21262d")}>Rollback</button>
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>
            {logs.map((l, i) => (
              <div key={i} style={{ color: l.startsWith("✓") ? "#3fb950" : l.startsWith("✗") ? "#f85149" : "#8b949e" }}>{l}</div>
            ))}
            {deploying && <div style={{ color: "#f26522", animation: "blink 1s step-end infinite" }}>_</div>}
          </div>
        )}

        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Auto-deploy on push", value: true },
              { label: "Run tests before deploy", value: true },
              { label: "Rollback on failure", value: true },
              { label: "Always-on (prevent sleep)", value: false },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#e1e4e8" }}>{s.label}</span>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: s.value ? "#1f6feb" : "#30363d", position: "relative", cursor: "pointer" }}>
                  <div style={{ position: "absolute", top: 3, left: s.value ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ACCOUNT PANEL ────────────────────────────────────────────────────────────

type AccountPage = "profile" | "settings" | "billing" | "ai-apis" | "api-keys" | "agent-config";

function AccountPanel() {
  const [page, setPage] = useState<AccountPage>("ai-apis");
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>("nous");
  const [connectedKeys, setConnectedKeys] = useState<Record<string, string>>({
    openai: "sk-proj-••••••••••••••••••••••••••••••XZ9k",
    anthropic: "sk-ant-••••••••••••••••••••••••••••••4Yp2",
  });
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set([
    "hermes-3-llama-3.1-405b", "gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "claude-3-5-haiku",
  ]));
  const [activeModel, setActiveModel] = useState("hermes-3-llama-3.1-405b");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const saveKey = (providerId: string) => {
    const val = keyInputs[providerId];
    if (!val?.trim()) return;
    setSaving(providerId);
    setTimeout(() => {
      setConnectedKeys(prev => ({ ...prev, [providerId]: val.trim() }));
      setKeyInputs(prev => { const n = { ...prev }; delete n[providerId]; return n; });
      setSaving(null); setSaved(providerId);
      setTimeout(() => setSaved(null), 2000);
    }, 900);
  };

  const removeKey = (providerId: string) => {
    setConnectedKeys(prev => { const n = { ...prev }; delete n[providerId]; return n; });
  };

  const toggleModel = (modelId: string) => {
    setEnabledModels(prev => {
      const n = new Set(prev);
      if (n.has(modelId)) { n.delete(modelId); if (activeModel === modelId) setActiveModel(""); }
      else n.add(modelId);
      return n;
    });
  };

  const allTags = Array.from(new Set(AI_PROVIDERS.flatMap(p => p.models.flatMap(m => m.tags))));

  const filteredProviders = AI_PROVIDERS.map(p => ({
    ...p,
    models: p.models.filter(m =>
      (!search || m.name.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase())) &&
      (!filterTag || m.tags.includes(filterTag))
    ),
  })).filter(p => p.models.length > 0);

  const NAV: { id: AccountPage; label: string; icon: string }[] = [
    { id: "profile", label: "Profile", icon: "○" },
    { id: "settings", label: "Settings", icon: "⚙" },
    { id: "billing", label: "Billing", icon: "◫" },
    { id: "ai-apis", label: "AI APIs", icon: "✦" },
    { id: "api-keys", label: "API Keys", icon: "🔑" },
    { id: "agent-config", label: "Agent Config", icon: "⬡" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "#0e1117" }}>
      {/* Account sidebar */}
      <div style={{ width: 220, background: "#161b22", borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #21262d" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6e40c9,#1f6feb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>U</div>
            <div>
              <div style={{ fontWeight: 600, color: "#e1e4e8", fontSize: 13 }}>User</div>
              <div style={{ fontSize: 11, color: "#8b949e" }}>user@example.com</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, padding: "8px 8px" }}>
          {NAV.map(n => (
            <div key={n.id} onClick={() => setPage(n.id)}
              style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 9, marginBottom: 2, background: page === n.id ? "#1f6feb18" : "transparent", border: page === n.id ? "1px solid #1f6feb33" : "1px solid transparent" }}
              onMouseEnter={e => { if (page !== n.id) (e.currentTarget as HTMLElement).style.background = "#21262d"; }}
              onMouseLeave={e => { if (page !== n.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 13, color: page === n.id ? "#58a6ff" : "#8b949e" }}>{n.icon}</span>
              <span style={{ fontSize: 13, color: page === n.id ? "#e1e4e8" : "#8b949e", fontWeight: page === n.id ? 500 : 400 }}>{n.label}</span>
              {n.id === "ai-apis" && (
                <span style={{ marginLeft: "auto", background: "#1f6feb", borderRadius: 10, fontSize: 10, color: "#fff", padding: "1px 6px", fontWeight: 600 }}>
                  {enabledModels.size}
                </span>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 8px", borderTop: "1px solid #21262d" }}>
          <div style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", color: "#f85149", fontSize: 13, display: "flex", gap: 9, alignItems: "center" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f8514911")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span>↪</span> Sign out
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* ── AI APIs page ── */}
        {page === "ai-apis" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #21262d", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#e1e4e8", marginBottom: 4 }}>AI Model APIs</div>
                  <div style={{ fontSize: 12, color: "#8b949e" }}>Connect your API keys to enable models. {Object.keys(connectedKeys).length} provider{Object.keys(connectedKeys).length !== 1 ? "s" : ""} connected · {enabledModels.size} models active.</div>
                </div>
                {activeModel && (
                  <div style={{ background: "#1f6feb11", border: "1px solid #1f6feb44", borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 6px #3fb95077" }} />
                    <span style={{ fontSize: 11, color: "#8b949e" }}>Active:</span>
                    <span style={{ fontSize: 12, color: "#58a6ff", fontWeight: 500 }}>{AI_PROVIDERS.flatMap(p => p.models).find(m => m.id === activeModel)?.name || activeModel}</span>
                  </div>
                )}
              </div>
              {/* Search + filter */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
                <div style={{ flex: 1, minWidth: 200, background: "#21262d", border: "1px solid #30363d", borderRadius: 7, display: "flex", alignItems: "center", gap: 7, padding: "6px 12px" }}>
                  <span style={{ color: "#484f58" }}>⌕</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models or providers…"
                    style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e1e4e8", fontSize: 13, fontFamily: "inherit" }} />
                  {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer" }}>✕</button>}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                  {["Agentic", "Coding", "Reasoning", "Vision", "Fast", "Open Source", "RAG"].map(tag => (
                    <button key={tag} onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                      style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: filterTag === tag ? "#1f6feb22" : "#21262d", border: filterTag === tag ? "1px solid #1f6feb" : "1px solid #30363d", color: filterTag === tag ? "#58a6ff" : "#8b949e" }}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Provider list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredProviders.map(provider => {
                const isConnected = !!connectedKeys[provider.id];
                const isExpanded = expandedProvider === provider.id;
                const providerEnabledCount = provider.models.filter(m => enabledModels.has(m.id)).length;

                return (
                  <div key={provider.id} style={{ border: `1px solid ${isConnected ? "#30363d" : "#21262d"}`, borderRadius: 10, overflow: "hidden", background: "#161b22" }}>
                    {/* Provider header */}
                    <div
                      onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                      style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: isExpanded ? "#1a2030" : "#161b22", borderBottom: isExpanded ? "1px solid #21262d" : "none" }}
                      onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "#1a2030"; }}
                      onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "#161b22"; }}
                    >
                      {/* Provider logo */}
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: provider.bg, border: `1px solid ${provider.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: provider.color, fontWeight: 800, flexShrink: 0 }}>
                        {provider.logo}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#e1e4e8", fontSize: 14 }}>{provider.name}</span>
                          {isConnected && (
                            <span style={{ background: "#3fb95022", border: "1px solid #3fb95055", borderRadius: 10, fontSize: 10, color: "#3fb950", padding: "1px 7px" }}>● Connected</span>
                          )}
                          {providerEnabledCount > 0 && (
                            <span style={{ background: "#1f6feb22", border: "1px solid #1f6feb44", borderRadius: 10, fontSize: 10, color: "#58a6ff", padding: "1px 7px" }}>{providerEnabledCount} active</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>{provider.models.length} model{provider.models.length !== 1 ? "s" : ""}</div>
                      </div>
                      {/* Connect / key status */}
                      {isConnected ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <div style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 5, padding: "4px 10px", fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>
                            {connectedKeys[provider.id]}
                          </div>
                          <button onClick={e => { e.stopPropagation(); removeKey(provider.id); }}
                            style={{ background: "none", border: "1px solid #f8514933", borderRadius: 5, color: "#f85149", cursor: "pointer", padding: "4px 8px", fontSize: 11 }}>Remove</button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setExpandedProvider(provider.id); }}
                          style={{ background: "#1f6feb", border: "none", borderRadius: 6, color: "#fff", padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                          + Connect
                        </button>
                      )}
                      <span style={{ color: "#484f58", marginLeft: 6, fontSize: 14 }}>{isExpanded ? "▾" : "▸"}</span>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div style={{ padding: 16 }}>
                        {/* API key input (if not connected) */}
                        {!isConnected && (
                          <div style={{ marginBottom: 14, padding: 14, background: provider.bg, border: `1px solid ${provider.color}22`, borderRadius: 8 }}>
                            <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8 }}>
                              Enter your <span style={{ color: provider.color }}>{provider.name}</span> API key to unlock all {provider.models.length} models.
                              <span style={{ color: "#484f58" }}> Keys are stored locally and never shared.</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1, background: "#0e1117", border: `1px solid ${provider.color}44`, borderRadius: 6, display: "flex", alignItems: "center", padding: "6px 10px", gap: 7 }}>
                                <span style={{ color: "#484f58", fontSize: 12 }}>🔑</span>
                                <input
                                  value={keyInputs[provider.id] || ""}
                                  onChange={e => setKeyInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                  onKeyDown={e => e.key === "Enter" && saveKey(provider.id)}
                                  placeholder={`Paste your ${provider.name} API key…`}
                                  type="password"
                                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, fontFamily: "monospace" }}
                                />
                              </div>
                              <button onClick={() => saveKey(provider.id)}
                                disabled={!keyInputs[provider.id]?.trim() || saving === provider.id}
                                style={{ background: provider.color, border: "none", borderRadius: 6, color: "#fff", padding: "6px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, minWidth: 90 }}>
                                {saving === provider.id ? "Saving…" : saved === provider.id ? "✓ Saved!" : "Save Key"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Model cards grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                          {provider.models.map(model => {
                            const isEnabled = enabledModels.has(model.id);
                            const isActive = activeModel === model.id;
                            return (
                              <div key={model.id}
                                style={{ padding: 12, borderRadius: 8, border: isActive ? `1px solid ${provider.color}88` : isEnabled ? "1px solid #30363d" : "1px solid #21262d", background: isActive ? provider.bg : isEnabled ? "#1a1f2a" : "#0e1117", position: "relative" as const, opacity: isConnected ? 1 : 0.55 }}>
                                {model.featured && (
                                  <div style={{ position: "absolute" as const, top: 8, right: 8, background: "#f2cc6022", border: "1px solid #f2cc6044", borderRadius: 10, fontSize: 9, color: "#f2cc60", padding: "1px 6px" }}>★ Featured</div>
                                )}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6, paddingRight: model.featured ? 52 : 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? provider.color : "#e1e4e8", lineHeight: 1.3 }}>{model.name}</div>
                                </div>
                                <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.5, marginBottom: 8 }}>{model.description}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                                  <span style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 4, fontSize: 10, color: "#58a6ff", padding: "1px 6px", fontFamily: "monospace" }}>ctx {model.context}</span>
                                  {model.tags.map(tag => (
                                    <span key={tag} style={{ background: "#21262d", borderRadius: 4, fontSize: 10, color: "#8b949e", padding: "1px 6px" }}>{tag}</span>
                                  ))}
                                  <div style={{ flex: 1 }} />
                                  {isConnected && (
                                    <div style={{ display: "flex", gap: 5 }}>
                                      {isActive ? (
                                        <span style={{ background: `${provider.color}22`, border: `1px solid ${provider.color}55`, borderRadius: 10, fontSize: 10, color: provider.color, padding: "2px 8px" }}>● Active</span>
                                      ) : (
                                        <button onClick={() => { setActiveModel(model.id); setEnabledModels(prev => new Set([...prev, model.id])); }}
                                          style={{ background: "none", border: `1px solid ${provider.color}44`, borderRadius: 5, color: provider.color, fontSize: 10, cursor: "pointer", padding: "2px 8px" }}>Set active</button>
                                      )}
                                      <button onClick={() => toggleModel(model.id)}
                                        style={{ background: isEnabled ? "#3fb95022" : "#21262d", border: isEnabled ? "1px solid #3fb95055" : "1px solid #30363d", borderRadius: 5, color: isEnabled ? "#3fb950" : "#484f58", fontSize: 10, cursor: "pointer", padding: "2px 8px" }}>
                                        {isEnabled ? "✓ On" : "Off"}
                                      </button>
                                    </div>
                                  )}
                                  {!isConnected && (
                                    <span style={{ fontSize: 10, color: "#484f58" }}>Requires API key</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Profile page ── */}
        {page === "profile" && (
          <div style={{ padding: 28, maxWidth: 560 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e1e4e8", marginBottom: 20 }}>Profile</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: 16, background: "#161b22", border: "1px solid #21262d", borderRadius: 10 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#6e40c9,#1f6feb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>U</div>
              <div>
                <div style={{ fontWeight: 600, color: "#e1e4e8", marginBottom: 4 }}>User</div>
                <div style={{ fontSize: 12, color: "#8b949e" }}>user@example.com</div>
                <div style={{ fontSize: 11, color: "#484f58", marginTop: 4 }}>Member since January 2024</div>
              </div>
            </div>
            {[["Display name", "User"], ["Email", "user@example.com"], ["Username", "user"]].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 5 }}>{label}</div>
                <input defaultValue={val} style={{ width: "100%", background: "#21262d", border: "1px solid #30363d", borderRadius: 6, color: "#e1e4e8", fontSize: 13, padding: "8px 12px", outline: "none", boxSizing: "border-box" as const }} />
              </div>
            ))}
            <button style={{ background: "#1f6feb", border: "none", borderRadius: 6, color: "#fff", padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>Save changes</button>
          </div>
        )}

        {/* ── Settings page ── */}
        {page === "settings" && (
          <div style={{ padding: 28, maxWidth: 560 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e1e4e8", marginBottom: 20 }}>Settings</div>
            {[
              { label: "Dark mode", desc: "Use dark theme across the interface", on: true },
              { label: "Send anonymous usage data", desc: "Help improve the product", on: false },
              { label: "Auto-save files", desc: "Save files automatically on change", on: true },
              { label: "Show inline AI suggestions", desc: "Display model suggestions in the editor", on: true },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #21262d" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#e1e4e8" }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{s.desc}</div>
                </div>
                <div style={{ width: 38, height: 22, borderRadius: 11, background: s.on ? "#1f6feb" : "#30363d", position: "relative" as const, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ position: "absolute" as const, top: 4, left: s.on ? 20 : 4, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Billing page ── */}
        {page === "billing" && (
          <div style={{ padding: 28, maxWidth: 560 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e1e4e8", marginBottom: 20 }}>Billing</div>
            <div style={{ padding: 16, background: "#161b22", border: "1px solid #1f6feb44", borderRadius: 10, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#58a6ff" }}>Pro Plan</div>
                  <div style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>$20 / month · Renews June 3, 2026</div>
                </div>
                <span style={{ background: "#3fb95022", border: "1px solid #3fb95055", borderRadius: 10, fontSize: 11, color: "#3fb950", padding: "2px 10px" }}>Active</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 10 }}>Usage this month</div>
            {[["AI tokens", "1.2M / 5M", 24], ["Storage", "2.3 GB / 10 GB", 23], ["Deployments", "4 / 10", 40]].map(([label, val, pct]) => (
              <div key={label as string} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "#e1e4e8" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>{val}</span>
                </div>
                <div style={{ height: 4, background: "#21262d", borderRadius: 2 }}>
                  <div style={{ height: "100%", background: "#1f6feb", borderRadius: 2, width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── API Keys page ── */}
        {page === "api-keys" && (
          <div style={{ padding: 28, maxWidth: 600 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e1e4e8", marginBottom: 6 }}>API Keys</div>
            <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 20 }}>Use these keys to access AI OS programmatically.</div>
            <button style={{ background: "#1f6feb", border: "none", borderRadius: 6, color: "#fff", padding: "7px 16px", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>+ Generate new key</button>
            {[
              { name: "Production key", key: "aios-sk-prod-••••••••••••••••••••••••••••XKp9", created: "Jan 15, 2024", last: "2h ago" },
              { name: "Dev key", key: "aios-sk-dev-••••••••••••••••••••••••••••3Wr1", created: "Feb 8, 2024", last: "Yesterday" },
            ].map(k => (
              <div key={k.name} style={{ padding: 14, background: "#161b22", border: "1px solid #21262d", borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#e1e4e8", marginBottom: 4 }}>{k.name}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "#8b949e" }}>{k.key}</div>
                  <div style={{ fontSize: 11, color: "#484f58", marginTop: 4 }}>Created {k.created} · Last used {k.last}</div>
                </div>
                <button style={{ background: "none", border: "1px solid #f8514933", borderRadius: 5, color: "#f85149", cursor: "pointer", padding: "4px 10px", fontSize: 11 }}>Revoke</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Agent Config page ── */}
        {page === "agent-config" && <AgentConfigPage />}

      </div>
    </div>
  );
}

// ─── AGENT CONFIG PAGE ─────────────────────────────────────────────────────────

function AgentConfigPage() {
  const [activePkg, setActivePkg] = useState("langchain");
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [taskConfigs, setTaskConfigs] = useState<Record<number, { pkg: string; model: string; protocol: AgentFrameworkId }>>(() =>
    Object.fromEntries(PAST_TASKS.map(t => [t.id, {
      pkg: t.aiConfig.framework === "hermes" ? "hermes-native" : t.aiConfig.framework === "openai-fn" ? "langchain" : t.aiConfig.framework === "anthropic-tools" ? "langchain" : "langchain",
      model: t.aiConfig.modelName,
      protocol: t.aiConfig.framework,
    }]))
  );
  const [defaultPkg, setDefaultPkg] = useState("langchain");
  const pkg = AGENT_PACKAGES.find(p => p.id === activePkg)!;

  const ARCH_LAYERS = [
    { label: "Task Input", sub: "user prompt + context + history", color: "#8b949e", icon: "💬" },
    { label: "Agent Framework", sub: pkg.name + " — orchestration loop, memory, tools", color: pkg.color, icon: pkg.logo },
    { label: "Tool Calling Protocol", sub: pkg.protocols.map(p => AGENT_FRAMEWORKS.find(f => f.id === p)?.name).join(" / "), color: "#e3b341", icon: "⬡" },
    { label: "LLM Provider API", sub: "OpenAI / Anthropic / Together AI / Ollama", color: "#58a6ff", icon: "◈" },
    { label: "Tool Executor", sub: "shell · file_read · file_write · browser · deploy", color: "#3fb950", icon: "▶" },
  ];

  const PKG_MODELS: Record<string, string[]> = {
    "langchain":          ["GPT-4o", "GPT-4o mini", "Claude 3.5 Sonnet", "Gemini 1.5 Pro", "Hermes 3 70B"],
    "vercel-ai":          ["GPT-4o", "GPT-4o mini", "Claude 3.5 Sonnet", "Claude 3.5 Haiku", "Gemini 1.5 Flash"],
    "hermes-native":      ["Hermes 3 405B", "Hermes 3 70B", "Hermes 3 8B", "Hermes 2 Pro"],
    "openai-assistants":  ["GPT-4o", "GPT-4o mini", "GPT-4 Turbo"],
    "crewai":             ["GPT-4o", "Claude 3.5 Sonnet", "Gemini 1.5 Pro", "Llama 3.1 70B"],
    "autogen":            ["GPT-4o", "GPT-4o mini", "Claude 3.5 Sonnet"],
  };

  const highlightCode = (code: string, color: string) =>
    code
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/(\/\/ .*)/g, '<span style="color:#484f58;font-style:italic">$1</span>')
      .replace(/(#.*)/g, '<span style="color:#484f58;font-style:italic">$1</span>')
      .replace(/\b(import|from|const|let|async|await|new|return|while|if|break|for|of|true|false|class)\b/g, `<span style="color:${color}">$1</span>`)
      .replace(/("[^"]*")/g, '<span style="color:#a5d6ff">$1</span>')
      .replace(/(`[^`]*`)/g, '<span style="color:#a5d6ff">$1</span>')
      .replace(/(&lt;\/?[\w_]+&gt;)/g, `<span style="color:#bc8cff">$1</span>`);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #21262d", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e1e4e8", marginBottom: 4 }}>Agent = Package</div>
        <div style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.6 }}>
          An agent is not just a prompt — it's a software package: an orchestration loop, tool registry, memory management, and error handling.
          The LLM API is just one layer. Pick the framework package that fits your stack.
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Architecture Stack ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>
            Agent Architecture Stack
          </div>
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
            {ARCH_LAYERS.map((layer, i) => (
              <div key={layer.label}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${layer.color}18`, border: `1.5px solid ${layer.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                    {layer.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: layer.color }}>{layer.label}</div>
                    <div style={{ fontSize: 11, color: "#484f58", marginTop: 1 }}>{layer.sub}</div>
                  </div>
                  {i === 1 && (
                    <span style={{ background: `${pkg.color}18`, border: `1px solid ${pkg.color}44`, borderRadius: 6, fontSize: 10, color: pkg.color, padding: "2px 8px" }}>
                      selected: {pkg.name}
                    </span>
                  )}
                </div>
                {i < ARCH_LAYERS.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", paddingLeft: 15 }}>
                    <div style={{ width: 2, height: 14, background: `linear-gradient(${layer.color}44, ${ARCH_LAYERS[i+1].color}44)` }} />
                    <span style={{ marginLeft: 8, fontSize: 9, color: "#484f58" }}>↓</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Package cards ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>
            Framework Packages
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {AGENT_PACKAGES.map(p => (
              <div key={p.id} onClick={() => setActivePkg(p.id)}
                style={{ background: activePkg === p.id ? p.bg : "#161b22", border: `1.5px solid ${activePkg === p.id ? p.color : "#21262d"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}
                onMouseEnter={e => { if (activePkg !== p.id) (e.currentTarget as HTMLElement).style.borderColor = `${p.color}44`; }}
                onMouseLeave={e => { if (activePkg !== p.id) (e.currentTarget as HTMLElement).style.borderColor = "#21262d"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: `${p.color}22`, border: `1px solid ${p.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: p.color, fontWeight: 800, flexShrink: 0 }}>
                    {p.logo}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: activePkg === p.id ? "#e1e4e8" : "#c9d1d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "#484f58" }}>{p.stars} · {p.language === "ts" ? "TypeScript" : p.language === "py" ? "Python" : "TS + Python"}</div>
                  </div>
                  {defaultPkg === p.id && <span style={{ fontSize: 8, color: p.color }}>● default</span>}
                </div>
                <div style={{ fontSize: 10, color: "#484f58", lineHeight: 1.4 }}>{p.tagline}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Selected package detail ── */}
        <div style={{ background: "#161b22", border: `1px solid ${pkg.color}33`, borderRadius: 10, overflow: "hidden" }}>
          {/* Package header */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #21262d", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: `${pkg.color}22`, border: `1px solid ${pkg.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: pkg.color, fontWeight: 800, flexShrink: 0 }}>
              {pkg.logo}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e1e4e8" }}>{pkg.name}</span>
                <span style={{ background: "#21262d", borderRadius: 4, fontSize: 10, color: "#8b949e", padding: "1px 6px", fontFamily: "monospace" }}>{pkg.stars}</span>
                <span style={{ background: pkg.language === "py" ? "#3a7a5022" : "#1f6feb22", border: `1px solid ${pkg.language === "py" ? "#3a7a5044" : "#1f6feb44"}`, borderRadius: 4, fontSize: 10, color: pkg.language === "py" ? "#3fb950" : "#58a6ff", padding: "1px 6px" }}>
                  {pkg.language === "ts" ? "TypeScript" : pkg.language === "py" ? "Python" : "TS + Python"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.5, marginBottom: 8 }}>{pkg.description}</div>
              {/* Install command */}
              <div style={{ background: "#0e1117", border: "1px solid #30363d", borderRadius: 6, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#484f58", fontSize: 11 }}>$</span>
                <code style={{ fontSize: 11, color: `${pkg.color}`, fontFamily: "'Fira Code', monospace", flex: 1 }}>{pkg.install}</code>
                <button style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 11 }}>⎘</button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 0 }}>
            {/* Left: code snippet */}
            <div style={{ borderRight: "1px solid #21262d" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 500 }}>agent.{pkg.language === "py" ? "py" : "ts"}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#484f58" }}>complete agent implementation</span>
              </div>
              <div style={{ position: "relative" as const, maxHeight: 360, overflow: "auto" }}>
                <pre style={{ margin: 0, padding: "14px 16px", fontFamily: "'Fira Code', monospace", fontSize: 10.5, color: "#8b949e", lineHeight: 1.65, background: "#0a0d11" }}>
                  <code dangerouslySetInnerHTML={{ __html: highlightCode(pkg.codeSnippet, pkg.color) }} />
                </pre>
              </div>
            </div>

            {/* Right: layers + capabilities + packages */}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Internal layers */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Package Layers</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pkg.layers.map((layer, i) => (
                    <div key={i} style={{ display: "flex", gap: 8 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: `${pkg.color}22`, border: `1px solid ${pkg.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: pkg.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "#c9d1d9" }}>{layer.name}</div>
                        <div style={{ fontSize: 10, color: "#484f58", lineHeight: 1.3 }}>{layer.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* npm packages */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>npm packages</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {pkg.pkgs.map(p => (
                    <code key={p} style={{ fontSize: 10, color: pkg.color, background: `${pkg.color}0d`, border: `1px solid ${pkg.color}22`, borderRadius: 4, padding: "2px 7px", fontFamily: "'Fira Code', monospace", display: "block" }}>{p}</code>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Capabilities</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
                  {pkg.capabilities.map(c => (
                    <span key={c} style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 4, fontSize: 10, color: "#8b949e", padding: "2px 7px" }}>✓ {c}</span>
                  ))}
                </div>
              </div>

              {/* Set as default */}
              {defaultPkg !== pkg.id ? (
                <button onClick={() => setDefaultPkg(pkg.id)}
                  style={{ background: `${pkg.color}18`, border: `1px solid ${pkg.color}44`, borderRadius: 6, color: pkg.color, fontSize: 11, padding: "6px 0", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                  ★ Set as default framework
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: `${pkg.color}11`, border: `1px solid ${pkg.color}33`, borderRadius: 6 }}>
                  <span style={{ fontSize: 8, color: pkg.color }}>●</span>
                  <span style={{ fontSize: 11, color: pkg.color, fontWeight: 500 }}>Default framework</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Per-task configuration ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>
            Per-task Configuration
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PAST_TASKS.map(task => {
              const cfg = taskConfigs[task.id];
              const taskPkg = AGENT_PACKAGES.find(p => p.id === cfg.pkg) || AGENT_PACKAGES[0];
              const isEditing = editingTask === task.id;
              return (
                <div key={task.id} style={{ background: "#161b22", border: `1px solid ${isEditing ? taskPkg.color + "55" : "#21262d"}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                    onClick={() => setEditingTask(isEditing ? null : task.id)}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3fb950", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "#e1e4e8" }}>{task.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ background: `${taskPkg.color}18`, border: `1px solid ${taskPkg.color}44`, borderRadius: 10, fontSize: 10, color: taskPkg.color, padding: "1px 7px" }}>
                        {taskPkg.logo} {taskPkg.name}
                      </span>
                      <span style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 10, fontSize: 10, color: "#8b949e", padding: "1px 7px" }}>
                        {cfg.model}
                      </span>
                      <span style={{ color: "#484f58", fontSize: 11 }}>{isEditing ? "▾" : "▸"}</span>
                    </div>
                  </div>

                  {isEditing && (
                    <div style={{ padding: "14px 14px", borderTop: "1px solid #21262d", background: "#0e1117" }}>
                      {/* Package row */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 7 }}>Framework Package</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                          {AGENT_PACKAGES.map(p => (
                            <button key={p.id} onClick={() => setTaskConfigs(prev => ({ ...prev, [task.id]: { ...prev[task.id], pkg: p.id, model: PKG_MODELS[p.id]?.[0] || cfg.model } }))}
                              style={{ background: cfg.pkg === p.id ? `${p.color}22` : "#161b22", border: `1px solid ${cfg.pkg === p.id ? p.color : "#30363d"}`, borderRadius: 6, padding: "5px 11px", fontSize: 11, color: cfg.pkg === p.id ? p.color : "#8b949e", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                              <span>{p.logo}</span> {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Model row */}
                      <div>
                        <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 7 }}>Model</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                          {(PKG_MODELS[cfg.pkg] || PKG_MODELS["langchain"]).map(m => (
                            <button key={m} onClick={() => setTaskConfigs(prev => ({ ...prev, [task.id]: { ...prev[task.id], model: m } }))}
                              style={{ background: cfg.model === m ? `${taskPkg.color}22` : "#161b22", border: `1px solid ${cfg.model === m ? taskPkg.color : "#30363d"}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: cfg.model === m ? taskPkg.color : "#8b949e", cursor: "pointer", fontFamily: "inherit" }}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── AGENT PACKAGES ───────────────────────────────────────────────────────────

type AgentPackage = {
  id: string; name: string; color: string; bg: string; logo: string;
  tagline: string; description: string; install: string; language: "ts" | "py" | "both";
  pkgs: string[]; stars: string;
  codeSnippet: string;
  protocols: AgentFrameworkId[];
  capabilities: string[];
  layers: { name: string; detail: string }[];
};

const AGENT_PACKAGES: AgentPackage[] = [
  {
    id: "langchain",
    name: "LangChain",
    color: "#1db954",
    bg: "#071410",
    logo: "🦜",
    tagline: "Provider-agnostic chains & agents",
    description: "The most widely-used agent framework. Ships with tool abstractions, memory backends, RAG chains, and a massive ecosystem of integrations.",
    install: "npm install langchain @langchain/core @langchain/openai",
    language: "both",
    pkgs: ["langchain", "@langchain/core", "@langchain/openai", "@langchain/anthropic", "@langchain/community"],
    stars: "96k ★",
    codeSnippet: `import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { DynamicTool } from "@langchain/core/tools";
import { BufferMemory } from "langchain/memory";

// 1. LLM backend
const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

// 2. Tool registry
const tools = [
  new DynamicTool({
    name: "shell",
    description: "Run a shell command and return output",
    func: async (cmd: string) => exec(cmd).toString(),
  }),
  new DynamicTool({
    name: "write_file",
    description: "Write content to a file. Input: 'path|content'",
    func: async (input: string) => {
      const [path, content] = input.split("|");
      fs.writeFileSync(path, content);
      return "Written: " + path;
    },
  }),
];

// 3. Memory
const memory = new BufferMemory({ memoryKey: "chat_history" });

// 4. Orchestration loop (built into AgentExecutor)
const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools, memory, maxIterations: 15 });

// 5. Run
const result = await executor.invoke({ input: "Build a REST API with auth" });
console.log(result.output);`,
    protocols: ["openai-fn", "anthropic-tools"],
    capabilities: ["Memory", "RAG chains", "Multi-agent", "Streaming", "LangSmith tracing", "Tool calling", "Structured output"],
    layers: [
      { name: "Orchestration", detail: "AgentExecutor runs the plan→act→observe loop" },
      { name: "Tool Registry", detail: "DynamicTool / StructuredTool with JSON schema" },
      { name: "Memory", detail: "BufferMemory / ConversationSummaryMemory / VectorStoreMemory" },
      { name: "LLM Interface", detail: "ChatOpenAI / ChatAnthropic / ChatGoogleGenerativeAI" },
    ],
  },
  {
    id: "vercel-ai",
    name: "Vercel AI SDK",
    color: "#e1e4e8",
    bg: "#0d0f12",
    logo: "▲",
    tagline: "Type-safe streaming agents for TypeScript",
    description: "Vercel's modern AI SDK. Best-in-class streaming with RSC, Zod-typed tool parameters, multi-step agent loops, and React hooks out of the box.",
    install: "npm install ai @ai-sdk/openai zod",
    language: "ts",
    pkgs: ["ai", "@ai-sdk/openai", "@ai-sdk/anthropic", "@ai-sdk/google", "zod"],
    stars: "13k ★",
    codeSnippet: `import { generateText, tool, type CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

// 1. Zod-typed tool definitions (the "package" of capabilities)
const agentTools = {
  shell: tool({
    description: "Run a shell command",
    parameters: z.object({ cmd: z.string().describe("Shell command to execute") }),
    execute: async ({ cmd }) => execSync(cmd, { encoding: "utf-8" }),
  }),
  readFile: tool({
    description: "Read a file",
    parameters: z.object({ path: z.string() }),
    execute: async ({ path }) => readFileSync(path, "utf-8"),
  }),
  writeFile: tool({
    description: "Write content to a file",
    parameters: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path, content }) => {
      writeFileSync(path, content);
      return "Saved: " + path;
    },
  }),
};

// 2. Multi-step agent loop (maxSteps handles the loop automatically)
const { text, steps, toolCalls } = await generateText({
  model: openai("gpt-4o"),
  maxSteps: 20,           // auto-loops until done or max steps
  tools: agentTools,
  system: "You are a coding agent. Use tools to complete the task.",
  prompt: "Build a REST API with JWT authentication",
  onStepFinish: ({ toolCalls, toolResults }) => {
    console.log("Step complete:", toolCalls, toolResults);
  },
});`,
    protocols: ["openai-fn", "anthropic-tools"],
    capabilities: ["Streaming RSC", "Type-safe Zod tools", "Multi-step loop", "React hooks (useChat)", "Edge runtime", "Structured output"],
    layers: [
      { name: "Orchestration", detail: "generateText/streamText with maxSteps auto-loops" },
      { name: "Tool Registry", detail: "tool() with Zod schemas — fully type-safe" },
      { name: "Streaming", detail: "Server-sent events, RSC, useChat / useCompletion hooks" },
      { name: "LLM Interface", detail: "@ai-sdk/openai | @ai-sdk/anthropic | @ai-sdk/google" },
    ],
  },
  {
    id: "hermes-native",
    name: "Hermes Native",
    color: "#bc8cff",
    bg: "#0e0818",
    logo: "H",
    tagline: "Raw loop + <tool_call> tokens — no framework",
    description: "No framework at all. Hermes models are natively trained on tool calling tokens. Write the orchestration loop yourself in ~50 lines. Full control, zero overhead.",
    install: "npm install openai  # via Together AI or any OpenAI-compatible endpoint",
    language: "ts",
    pkgs: ["openai"],
    stars: "— (raw API)",
    codeSnippet: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.together.xyz/v1",
  apiKey: process.env.TOGETHER_API_KEY,
});

// 1. Tool definitions as JSON schema (in system prompt)
const TOOLS = [
  { name: "shell", description: "Run shell command",
    parameters: { type: "object", properties: { cmd: { type: "string" } }, required: ["cmd"] } },
  { name: "write_file", description: "Write a file",
    parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path","content"] } },
];

const messages: any[] = [
  { role: "system", content: \`<tools>\n\${JSON.stringify(TOOLS, null, 2)}\n</tools>\nYou are a coding agent.\` },
  { role: "user", content: "Build a REST API with auth" },
];

// 2. Orchestration loop — YOU own this
while (true) {
  const res = await client.chat.completions.create({
    model: "NousResearch/Hermes-3-Llama-3.1-405B-Turbo",
    messages, temperature: 0, max_tokens: 4096,
  });
  const text = res.choices[0].message.content ?? "";
  messages.push({ role: "assistant", content: text });

  // 3. Parse native <tool_call> tokens
  const match = text.match(/<tool_call>([\\s\\S]*?)<\\/tool_call>/);
  if (!match) break; // no tool call → agent is done

  const { name, arguments: args } = JSON.parse(match[1]);

  // 4. Execute tool
  const result = await executeTool(name, args);

  // 5. Inject <tool_response> and loop
  messages.push({ role: "user", content:
    \`<tool_response>{"name":"\${name}","content":\${JSON.stringify(result)}}</tool_response>\` });
}`,
    protocols: ["hermes"],
    capabilities: ["Native token format", "Zero overhead", "Full loop control", "Open weights", "Self-hostable", "Parallel tool calls"],
    layers: [
      { name: "Orchestration", detail: "Your own while-loop — full control" },
      { name: "Tool Registry", detail: "Plain array of JSON Schema objects in system prompt" },
      { name: "Protocol", detail: "Native <tool_call> / <tool_response> XML tokens" },
      { name: "LLM Interface", detail: "OpenAI-compatible client → Together AI / vLLM / Ollama" },
    ],
  },
  {
    id: "openai-assistants",
    name: "OpenAI Assistants",
    color: "#3fb950",
    bg: "#061410",
    logo: "⊕",
    tagline: "Managed threads, runs & built-in tools",
    description: "OpenAI's managed agent infrastructure. Persistent threads handle context automatically. Built-in code interpreter, file search, and function calling with no loop to manage.",
    install: "npm install openai",
    language: "ts",
    pkgs: ["openai"],
    stars: "— (managed)",
    codeSnippet: `import OpenAI from "openai";

const openai = new OpenAI();

// 1. Create assistant with tool package
const assistant = await openai.beta.assistants.create({
  name: "Coding Agent",
  model: "gpt-4o",
  instructions: "You are an expert coding agent. Complete tasks fully.",
  tools: [
    { type: "code_interpreter" },          // built-in: runs Python
    { type: "file_search" },               // built-in: RAG over uploaded files
    {
      type: "function",                    // custom function tools
      function: {
        name: "shell",
        description: "Run a shell command",
        parameters: {
          type: "object",
          properties: { cmd: { type: "string" } },
          required: ["cmd"],
        },
      },
    },
  ],
});

// 2. Thread = persistent conversation (auto context management)
const thread = await openai.beta.threads.create();
await openai.beta.threads.messages.create(thread.id, {
  role: "user",
  content: "Build a REST API with auth",
});

// 3. Run = OpenAI manages the loop
const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
  assistant_id: assistant.id,
});

// 4. Handle required_action (function tool calls)
if (run.status === "requires_action") {
  const toolOutputs = await Promise.all(
    run.required_action!.submit_tool_outputs.tool_calls.map(async tc => ({
      tool_call_id: tc.id,
      output: await executeTool(tc.function.name, JSON.parse(tc.function.arguments)),
    }))
  );
  await openai.beta.threads.runs.submitToolOutputsAndPoll(thread.id, run.id, { tool_outputs: toolOutputs });
}`,
    protocols: ["openai-fn"],
    capabilities: ["Managed threads", "Auto context", "Code interpreter", "File search", "Persistent state", "Streaming runs"],
    layers: [
      { name: "Orchestration", detail: "OpenAI-managed run loop — no while-loop needed" },
      { name: "Tool Registry", detail: "functions[] + built-in code_interpreter + file_search" },
      { name: "Memory", detail: "Threads = persistent conversation, managed automatically" },
      { name: "LLM Interface", detail: "OpenAI models only (gpt-4o, o1, etc.)" },
    ],
  },
  {
    id: "crewai",
    name: "CrewAI",
    color: "#f2cc60",
    bg: "#141008",
    logo: "⚓",
    tagline: "Multi-agent crews with role-based delegation",
    description: "Multi-agent framework where specialized agents collaborate in crews. Define a Coder, Reviewer, and Tester — each with their own LLM, tools, and goal.",
    install: "pip install crewai crewai-tools",
    language: "py",
    pkgs: ["crewai", "crewai-tools", "langchain-openai", "langchain-anthropic"],
    stars: "25k ★",
    codeSnippet: `from crewai import Agent, Task, Crew, Process
from crewai_tools import FileReadTool, FileWriterTool, CodeInterpreterTool

# 1. Define specialized agents (each is its own LLM + tools package)
coder = Agent(
  role="Senior Software Engineer",
  goal="Write clean, production-ready TypeScript code",
  backstory="10 years building Node.js APIs. Expert in Express and JWT.",
  tools=[CodeInterpreterTool(), FileWriterTool()],
  llm="gpt-4o",
  verbose=True,
  allow_delegation=True,
)

reviewer = Agent(
  role="Code Reviewer & Security Auditor",
  goal="Ensure code quality, security, and test coverage",
  backstory="Former FAANG security engineer. Zero tolerance for vulnerabilities.",
  tools=[FileReadTool()],
  llm="claude-3-5-sonnet-20241022",
)

# 2. Define tasks
build = Task(
  description="Build a complete REST API with JWT auth in TypeScript",
  expected_output="Working src/ directory with all route handlers and tests",
  agent=coder,
)
review = Task(
  description="Review the code for security issues and suggest fixes",
  expected_output="Security report + fixed code if issues found",
  agent=reviewer,
  context=[build],   # reviewer gets coder's output
)

# 3. Crew = orchestrated multi-agent system
crew = Crew(
  agents=[coder, reviewer],
  tasks=[build, review],
  process=Process.sequential,   # or Process.hierarchical
  memory=True,
  verbose=True,
)
result = crew.kickoff()`,
    protocols: ["openai-fn", "anthropic-tools"],
    capabilities: ["Multi-agent", "Role-based", "Task context passing", "Process.sequential/hierarchical", "Memory", "Delegation"],
    layers: [
      { name: "Orchestration", detail: "Crew.kickoff() — sequential or hierarchical process" },
      { name: "Agent Layer", detail: "Each Agent has its own LLM, tools, goal, memory" },
      { name: "Task Graph", detail: "Tasks with context[] — outputs flow between agents" },
      { name: "LLM Interface", detail: "Any LangChain-supported LLM per agent" },
    ],
  },
  {
    id: "autogen",
    name: "AutoGen",
    color: "#58a6ff",
    bg: "#060e1a",
    logo: "◈",
    tagline: "Microsoft: conversational multi-agent + code exec",
    description: "Microsoft's framework for building multi-agent conversations. Human-in-the-loop, automated code execution, and nested conversations between specialized agents.",
    install: "pip install autogen-agentchat autogen-ext[openai]",
    language: "py",
    pkgs: ["autogen-agentchat", "autogen-ext[openai]", "autogen-ext[anthropic]"],
    stars: "39k ★",
    codeSnippet: `from autogen_agentchat.agents import AssistantAgent, CodeExecutorAgent
from autogen_agentchat.teams import RoundRobinGroupChat, SelectorGroupChat
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor

# 1. LLM client
model = OpenAIChatCompletionClient(model="gpt-4o", temperature=0)

# 2. Specialized agents — each is a full sub-package
assistant = AssistantAgent(
  name="coding_assistant",
  model_client=model,
  system_message="""You are a senior software engineer.
Write code and use the code executor to run it.
Always verify your code works before reporting done.""",
)

executor = CodeExecutorAgent(
  name="code_executor",
  code_executor=LocalCommandLineCodeExecutor(work_dir="./workspace"),
)

# 3. Team = orchestrated group conversation
team = RoundRobinGroupChat(
  participants=[assistant, executor],
  termination_condition=MaxMessageTermination(max_messages=20),
)

# 4. Run the multi-agent task
async for message in team.run_stream(task="Build a REST API with auth"):
  print(f"[{message.source}]: {message.content}")`,
    protocols: ["openai-fn"],
    capabilities: ["Multi-agent chat", "Code executor", "Human-in-loop", "Group orchestration", "Streaming", "Nested conversations"],
    layers: [
      { name: "Orchestration", detail: "RoundRobinGroupChat / SelectorGroupChat team loop" },
      { name: "Agent Layer", detail: "AssistantAgent + CodeExecutorAgent + UserProxyAgent" },
      { name: "Code Execution", detail: "LocalCommandLineCodeExecutor / DockerCommandLineExecutor" },
      { name: "LLM Interface", detail: "OpenAIChatCompletionClient / AnthropicChatCompletionClient" },
    ],
  },
];

// ─── BUTTON STYLES ────────────────────────────────────────────────────────────

function btnStyle(bg: string, color = "#8b949e", border = "#30363d"): React.CSSProperties {
  return { background: bg, border: `1px solid ${border}`, borderRadius: 6, color, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const };
}
const iconBtn: React.CSSProperties = { background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 13, padding: "2px 4px" };

// ─── STATUS BAR ────────────────────────────────────────────────────────────────

type Metrics = { cpu: number; ram: number; netUp: number; netDown: number; ping: number };

function MiniSparkline({ value, color }: { value: number; color: string }) {
  const bars = [value * 0.6, value * 0.8, value * 0.5, value * 0.9, value * 0.7, value];
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1, height: 10, verticalAlign: "middle" }}>
      {bars.map((h, i) => (
        <span key={i} style={{ width: 2, background: color, borderRadius: 1, height: `${Math.max(2, (h / 100) * 10)}px`, opacity: 0.5 + i * 0.08 }} />
      ))}
    </span>
  );
}

function StatusBar({ metrics, running, errors, warnings, activePanel, setActivePanel, visiblePanels }:
  { metrics: Metrics; running: boolean; errors: number; warnings: number; activePanel: PanelId; setActivePanel: (p: PanelId) => void; visiblePanels: PanelId[] }
) {
  const s: React.CSSProperties = { display: "flex", alignItems: "center", gap: 2, padding: "0 8px", height: "100%", cursor: "pointer", borderRadius: 2, fontSize: 11, color: "#8b949e", whiteSpace: "nowrap" as const };
  const sep = <span style={{ color: "#21262d", margin: "0 2px" }}>│</span>;

  return (
    <div style={{ height: 22, background: "#0d1117", borderTop: "1px solid #21262d", display: "flex", alignItems: "center", flexShrink: 0, overflowX: "auto", scrollbarWidth: "none" as const }}>
      {/* Left cluster */}
      <div style={{ display: "flex", alignItems: "center", height: "100%", borderRight: "1px solid #21262d", paddingRight: 4 }}>
        {/* Git branch + GitHub sync */}
        <div style={s} onClick={() => setActivePanel("git")} title="GitHub: 3 ahead · 1 behind" onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span style={{ color: "#3fb950" }}>⎇</span>&nbsp;main
          &nbsp;<span style={{ color: "#3fb950" }}>↑3</span>
          &nbsp;<span style={{ color: "#f2cc60" }}>↓1</span>
          &nbsp;<span style={{ color: "#484f58", fontSize: 9 }}>GitHub</span>
        </div>
        {sep}
        {/* Errors / warnings */}
        <div style={{ ...s, color: errors > 0 ? "#f85149" : "#8b949e" }} onClick={() => setActivePanel("console")} onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span style={{ color: errors > 0 ? "#f85149" : "#484f58" }}>✗</span>&nbsp;{errors}
          &nbsp;<span style={{ color: warnings > 0 ? "#f2cc60" : "#484f58" }}>⚠</span>&nbsp;{warnings}
        </div>
        {sep}
        {/* Language */}
        <div style={{ ...s, color: "#58a6ff" }}>TypeScript</div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right cluster — resource metrics */}
      <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
        {/* Run status */}
        <div style={{ ...s, color: running ? "#3fb950" : "#484f58", paddingLeft: 10 }}>
          <span style={{ fontSize: 8, marginRight: 4, color: running ? "#3fb950" : "#484f58" }}>●</span>
          {running ? "Running" : "Stopped"}
        </div>
        {sep}

        {/* Port + Live URL */}
        <div style={{ ...s, color: "#58a6ff" }} title="Port 3000 → my-rest-api.you.repl.co">
          <span style={{ fontSize: 9 }}>◉</span>&nbsp;PORT&nbsp;3000
          &nbsp;<span style={{ color: "#3fb950", fontSize: 9 }}>● Live</span>
        </div>
        {sep}

        {/* CPU */}
        <div style={s} title="CPU usage" onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span title="CPU">⬡</span>&nbsp;
          <span style={{ color: metrics.cpu > 70 ? "#f85149" : metrics.cpu > 40 ? "#f2cc60" : "#8b949e" }}>{metrics.cpu.toFixed(0)}%</span>
          &nbsp;<MiniSparkline value={metrics.cpu} color={metrics.cpu > 70 ? "#f85149" : metrics.cpu > 40 ? "#f2cc60" : "#3fb950"} />
        </div>
        {sep}

        {/* RAM */}
        <div style={s} title="Memory usage" onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span>▣</span>&nbsp;
          <span style={{ color: metrics.ram > 80 ? "#f85149" : "#8b949e" }}>{(metrics.ram * 5.12).toFixed(0)} MB</span>
          &nbsp;<MiniSparkline value={metrics.ram} color="#58a6ff" />
        </div>
        {sep}

        {/* Network */}
        <div style={s} title="Network I/O" onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span style={{ color: "#3fb950" }}>↑</span>&nbsp;<span>{metrics.netUp.toFixed(1)}&nbsp;KB/s</span>
          &nbsp;<span style={{ color: "#58a6ff" }}>↓</span>&nbsp;<span>{metrics.netDown.toFixed(1)}&nbsp;KB/s</span>
        </div>
        {sep}

        {/* Disk */}
        <div style={s} title="Disk usage" onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span>◫</span>&nbsp;2.3&nbsp;GB
        </div>
        {sep}

        {/* Connection / ping */}
        <div style={{ ...s, color: "#3fb950" }} title="Connection status" onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span style={{ fontSize: 8 }}>●</span>&nbsp;{metrics.ping}&nbsp;ms
        </div>
        {sep}

        {/* Cursor pos */}
        <div style={s}>Ln&nbsp;13,&nbsp;Col&nbsp;8</div>
        {sep}

        {/* Encoding */}
        <div style={s}>UTF-8</div>
        {sep}

        {/* Indentation */}
        <div style={s}>Spaces:&nbsp;2</div>
        {sep}

        {/* Line endings */}
        <div style={{ ...s, paddingRight: 12 }}>LF</div>
      </div>
    </div>
  );
}

// ─── MINIMAP ───────────────────────────────────────────────────────────────────

function Minimap({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div style={{ width: 60, background: "#0a0d11", borderLeft: "1px solid #21262d", overflow: "hidden", flexShrink: 0, opacity: 0.7 }}>
      {lines.map((line, i) => {
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const content = line.trim();
        return (
          <div key={i} style={{ height: 3, paddingLeft: indent * 1.2, display: "flex", alignItems: "center" }}>
            {content && (
              <div style={{
                height: 1.5,
                width: Math.min(content.length * 1.4, 50 - indent * 1.2),
                background: content.startsWith("//") ? "#484f58" :
                  /^(import|export|const|let|return|router)/.test(content) ? "#ff7b72" :
                  /^(\{|\})/.test(content) ? "#e3b341" :
                  "#8b949e",
                borderRadius: 1,
                opacity: 0.7,
              }} />
            )}
          </div>
        );
      })}
      {/* Viewport indicator */}
      <div style={{ position: "absolute" as const, top: 8, right: 0, width: 60, height: 60, background: "#58a6ff11", border: "1px solid #58a6ff22", pointerEvents: "none" }} />
    </div>
  );
}

// ─── LEFT ICON RAIL ────────────────────────────────────────────────────────────

type RailItem = { icon: string; label: string; panel?: PanelId; action?: string };

const RAIL_TOP: RailItem[] = [
  { icon: "☰", label: "Files" },
  { icon: "⌕", label: "Search", panel: "search" },
  { icon: "⎇", label: "Source Control", panel: "git" },
  { icon: "⬤", label: "Debugger", panel: "debugger" },
  { icon: "⬡", label: "Packages", panel: "packages" },
];
const RAIL_BOTTOM: RailItem[] = [
  { icon: "◫", label: "Database", panel: "database" },
  { icon: "🔑", label: "Secrets", panel: "secrets" },
  { icon: "↑", label: "Deploy", panel: "deploy" },
];

function LeftRail({ activePanel, setActivePanel, visiblePanels }:
  { activePanel: PanelId; setActivePanel: (p: PanelId) => void; visiblePanels: PanelId[] }
) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const railBtn = (item: RailItem) => {
    const isActive = item.panel && item.panel === activePanel && visiblePanels.includes(item.panel);
    return (
      <div key={item.label} style={{ position: "relative" as const }}>
        <div
          onClick={() => item.panel && setActivePanel(item.panel)}
          onMouseEnter={() => setTooltip(item.label)}
          onMouseLeave={() => setTooltip(null)}
          style={{
            width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 16, color: isActive ? "#e1e4e8" : "#8b949e",
            background: isActive ? "#21262d" : "transparent",
            borderLeft: isActive ? "2px solid #f26522" : "2px solid transparent",
            transition: "all 0.1s",
          }}
          onMouseDown={e => { (e.currentTarget as HTMLElement).style.color = "#e1e4e8"; }}
        >
          {item.icon}
        </div>
        {tooltip === item.label && (
          <div style={{ position: "absolute" as const, left: 44, top: "50%", transform: "translateY(-50%)", background: "#30363d", border: "1px solid #444c56", borderRadius: 4, padding: "3px 8px", fontSize: 11, color: "#e1e4e8", whiteSpace: "nowrap" as const, zIndex: 100, pointerEvents: "none" }}>
            {item.label}
          </div>
        )}
      </div>
    );
  };
  return (
    <div style={{ width: 40, background: "#161b22", borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 4 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {RAIL_TOP.map(railBtn)}
      </div>
      <div style={{ paddingBottom: 8, display: "flex", flexDirection: "column" }}>
        {RAIL_BOTTOM.map(railBtn)}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function AIInterface() {
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [activePanel, setActivePanel] = useState<PanelId>("console");
  const [panelHeight, setPanelHeight] = useState(240);
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const [chatInput, setChatInput] = useState("");
  const [chatPlanMode, setChatPlanMode] = useState(false);
  const [chatTier, setChatTier] = useState<"power" | "lite" | "eco">("power");
  const [chatTierOpen, setChatTierOpen] = useState(false);
  const [chatVoiceOn, setChatVoiceOn] = useState(false);
  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [cmdKQuery, setCmdKQuery] = useState("");
  const [replSwitcherOpen, setReplSwitcherOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "midnight" | "high-contrast">("dark");
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [boost, setBoost] = useState(false);
  const [layout, setLayout] = useState<"default" | "minimal" | "focus">("default");
  const [replSwitcherTab, setReplSwitcherTab] = useState<"recent" | "templates">("recent");

  // ⌘K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdKOpen(true); }
      if (e.key === "Escape") { setCmdKOpen(false); setReplSwitcherOpen(false); setHelpOpen(false); setShowQR(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [customizingPanels, setCustomizingPanels] = useState(false);
  const [visiblePanels, setVisiblePanels] = useState<PanelId[]>(ALL_PANELS);
  const [running, setRunning] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifCount] = useState(3);
  const [metrics, setMetrics] = useState<Metrics>({ cpu: 14, ram: 48, netUp: 2.1, netDown: 0.4, ping: 12 });
  const [cursorLine] = useState(13);

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() - 0.5) * 8)),
        ram: Math.max(30, Math.min(90, prev.ram + (Math.random() - 0.5) * 4)),
        netUp: Math.max(0, prev.netUp + (Math.random() - 0.5) * 1.2),
        netDown: Math.max(0, prev.netDown + (Math.random() - 0.5) * 0.6),
        ping: Math.max(8, Math.min(80, prev.ping + (Math.random() - 0.5) * 6)),
      }));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const onPanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY, startH = panelHeight;
    const onMove = (ev: MouseEvent) => setPanelHeight(Math.max(100, Math.min(500, startH + startY - ev.clientY)));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelHeight]);

  const onSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => setSidebarWidth(Math.max(150, Math.min(360, startW + ev.clientX - startX)));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const togglePanel = (p: PanelId) => {
    setVisiblePanels(prev => {
      const next = prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p];
      if (!next.includes(activePanel) && next.length > 0) setActivePanel(next[0]);
      return next;
    });
  };

  const PanelContent = () => {
    switch (activePanel) {
      case "console": return <ConsolePanel />;
      case "shell": return <ShellPanel />;
      case "webview": return <WebviewPanel />;
      case "git": return <GitPanel />;
      case "packages": return <PackagesPanel />;
      case "secrets": return <SecretsPanel />;
      case "database": return <DatabasePanel />;
      case "search": return <SearchPanel />;
      case "debugger": return <DebuggerPanel />;
      case "deploy": return <DeployPanel />;
      default: return null;
    }
  };

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "#0e1117", color: "#e1e4e8", fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 13, overflow: "hidden", userSelect: "none" }}>

      {/* TOP BAR */}
      <div style={{ height: 48, background: "#161b22", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", padding: "0 12px", gap: 10, flexShrink: 0 }}>
        {/* Logo + Repls switcher dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 2, flexShrink: 0, position: "relative" as const }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #f26522, #f5a623)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 }}>A</div>
          <button onClick={() => setReplSwitcherOpen(o => !o)}
            style={{ background: replSwitcherOpen ? "#21262d" : "transparent", border: "none", borderRadius: 5, padding: "4px 7px", color: "#e1e4e8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
            onMouseEnter={e => { if (!replSwitcherOpen) e.currentTarget.style.background = "#21262d"; }}
            onMouseLeave={e => { if (!replSwitcherOpen) e.currentTarget.style.background = "transparent"; }}>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
              <span style={{ fontSize: 9, color: "#8b949e", fontWeight: 400 }}>@you</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>my-rest-api</span>
            </span>
            <span style={{ fontSize: 9, color: "#8b949e" }}>▾</span>
          </button>
          {replSwitcherOpen && (
            <>
              <div onClick={() => setReplSwitcherOpen(false)} style={{ position: "fixed" as const, inset: 0, zIndex: 100 }} />
              <div style={{ position: "absolute" as const, top: "calc(100% + 6px)", left: 0, width: 320, background: "#161b22", border: "1px solid #30363d", borderRadius: 10, zIndex: 101, boxShadow: "0 12px 28px rgba(0,0,0,0.6)", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>⌕</span>
                  <input placeholder="Search Repls & templates…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, fontFamily: "inherit" }} />
                </div>
                {/* Tab switcher: Recent / Templates */}
                <div style={{ display: "flex", borderBottom: "1px solid #21262d" }}>
                  {(["recent", "templates"] as const).map(t => (
                    <button key={t} onClick={() => setReplSwitcherTab(t)} style={{ flex: 1, background: "transparent", border: "none", borderBottom: replSwitcherTab === t ? "2px solid #f26522" : "2px solid transparent", padding: "8px 0", color: replSwitcherTab === t ? "#e1e4e8" : "#8b949e", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" as const, fontWeight: replSwitcherTab === t ? 600 : 400 }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ padding: "6px 0", maxHeight: 280, overflowY: "auto" }}>
                  {replSwitcherTab === "recent" ? (
                    <>
                      <div style={{ padding: "4px 14px", fontSize: 10, color: "#484f58", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Recent</div>
                      {[
                        { name: "my-rest-api", lang: "ts", desc: "REST API with JWT auth", time: "now", active: true },
                        { name: "react-dashboard", lang: "tsx", desc: "Admin dashboard with charts", time: "2h ago" },
                        { name: "discord-bot", lang: "py", desc: "Slash command bot", time: "yesterday" },
                        { name: "stripe-webhook-test", lang: "ts", desc: "Webhook receiver + replay", time: "3d ago" },
                        { name: "ml-classifier", lang: "py", desc: "scikit-learn pipeline", time: "1w ago" },
                      ].map((r) => (
                        <div key={r.name} style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: r.active ? "#1f6feb14" : "transparent", borderLeft: r.active ? "2px solid #1f6feb" : "2px solid transparent" }}
                          onMouseEnter={e => { if (!r.active) (e.currentTarget as HTMLElement).style.background = "#21262d"; }}
                          onMouseLeave={e => { if (!r.active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <FileIcon ext={r.lang} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: r.active ? "#58a6ff" : "#e1e4e8", fontWeight: r.active ? 500 : 400 }}>{r.name}</div>
                            <div style={{ fontSize: 10, color: "#484f58", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.desc}</div>
                          </div>
                          <span style={{ fontSize: 10, color: "#484f58" }}>{r.time}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div style={{ padding: "4px 14px", fontSize: 10, color: "#484f58", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Featured</div>
                      {[
                        { name: "Next.js + Postgres", icon: "▲", color: "#fff", desc: "Full-stack starter with Drizzle", uses: "12.4k" },
                        { name: "FastAPI + React", icon: "🐍", color: "#3fb950", desc: "Python backend + Vite frontend", uses: "8.7k" },
                        { name: "Discord Bot (TS)", icon: "🤖", color: "#5865F2", desc: "Slash commands + Drizzle", uses: "5.2k" },
                        { name: "Telegram Mini App", icon: "✈", color: "#0088cc", desc: "Vue 3 + WebApp SDK", uses: "3.1k" },
                        { name: "AI Agent (LangChain)", icon: "🦜", color: "#bc8cff", desc: "Tools, memory, streaming", uses: "9.8k" },
                        { name: "Stripe Checkout", icon: "💳", color: "#635bff", desc: "Subscriptions + webhooks", uses: "4.6k" },
                        { name: "Static blog (Astro)", icon: "🚀", color: "#f26522", desc: "Markdown + RSS + sitemap", uses: "2.9k" },
                      ].map((tpl) => (
                        <div key={tpl.name} style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#21262d")}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                          <span style={{ width: 24, height: 24, borderRadius: 5, background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: tpl.color, flexShrink: 0 }}>{tpl.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "#e1e4e8" }}>{tpl.name}</div>
                            <div style={{ fontSize: 10, color: "#484f58", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{tpl.desc}</div>
                          </div>
                          <span style={{ fontSize: 10, color: "#484f58" }}>⑂ {tpl.uses}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div style={{ borderTop: "1px solid #21262d", padding: 6, display: "flex", gap: 4 }}>
                  <button style={{ flex: 1, background: "transparent", border: "1px solid #30363d", borderRadius: 5, padding: "5px 8px", color: "#8b949e", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>+ New Repl</button>
                  <button style={{ flex: 1, background: "transparent", border: "1px solid #30363d", borderRadius: 5, padding: "5px 8px", color: "#8b949e", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Import from GitHub</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ⌘K Command palette trigger */}
        <button onClick={() => setCmdKOpen(true)}
          style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "5px 10px", color: "#8b949e", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, minWidth: 200, fontFamily: "inherit", flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#58a6ff")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#30363d")}>
          <span style={{ fontSize: 11 }}>⌕</span>
          <span style={{ flex: 1, textAlign: "left" as const }}>Search files & commands…</span>
          <span style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 3, padding: "0 5px", fontSize: 10, color: "#8b949e", fontFamily: "monospace" }}>⌘K</span>
        </button>
        <div style={{ width: 1, height: 20, background: "#21262d", flexShrink: 0 }} />

        {/* Task chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, scrollbarWidth: "none" as const }}>
          {PREDEFINED_TASKS.map((task, i) => (
            <button key={i} style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 20, padding: "4px 12px", color: "#8b949e", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" as const }}
              onMouseEnter={e => { (e.target as HTMLElement).style.cssText += ";color:#e1e4e8;border-color:#f26522"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.cssText += ";color:#8b949e;border-color:#30363d"; }}
            >{task}</button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>

          {/* Checkpoints chip */}
          <button title="12 checkpoints — click to view history"
            style={{ background: "transparent", border: "1px solid #30363d", borderRadius: 6, padding: "4px 9px", color: "#8b949e", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#3fb950"; e.currentTarget.style.color = "#3fb950"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}>
            <span style={{ color: "#3fb950" }}>✓</span>
            <span>12</span>
            <span style={{ color: "#484f58", fontSize: 10 }}>checkpoints</span>
          </button>

          {/* Cycles chip */}
          <button title="1,247 cycles available · click to top up"
            style={{ background: "transparent", border: "1px solid #30363d", borderRadius: 6, padding: "4px 9px", color: "#8b949e", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#e3b341"; e.currentTarget.style.color = "#e3b341"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}>
            <span style={{ color: "#e3b341" }}>⚡</span>
            <span style={{ fontFamily: "'Fira Code', monospace" }}>1,247</span>
          </button>

          {/* Mobile QR button */}
          <button onClick={() => setShowQR(true)} title="Preview on phone"
            style={{ background: "transparent", border: "1px solid #30363d", borderRadius: 6, width: 28, height: 28, color: "#8b949e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#bc8cff"; e.currentTarget.style.color = "#bc8cff"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.color = "#8b949e"; }}>
            ▢
          </button>

          <div style={{ width: 1, height: 20, background: "#21262d", flexShrink: 0 }} />

          {/* Fork button */}
          <button style={{ background: "transparent", border: "1px solid #30363d", borderRadius: 6, padding: "4px 10px", color: "#8b949e", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={e => { (e.currentTarget.style.borderColor = "#58a6ff"); (e.currentTarget.style.color = "#58a6ff"); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = "#30363d"); (e.currentTarget.style.color = "#8b949e"); }}>
            <span style={{ fontSize: 11 }}>⑂</span> Fork
          </button>

          {/* Share / Invite */}
          <button style={{ background: "transparent", border: "1px solid #30363d", borderRadius: 6, padding: "4px 10px", color: "#8b949e", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={e => { (e.currentTarget.style.borderColor = "#3fb950"); (e.currentTarget.style.color = "#3fb950"); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = "#30363d"); (e.currentTarget.style.color = "#8b949e"); }}>
            <span>⤡</span> Share
          </button>

          {/* Multiplayer avatars */}
          <div style={{ display: "flex", alignItems: "center" }}>
            {[["#1f6feb","J"],["#3fb950","S"],["#bc8cff","M"]].map(([bg, initl], i) => (
              <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", cursor: "pointer", border: "2px solid #161b22", marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i, boxShadow: "0 0 0 1px #30363d" }}
                title={`User ${initl}`}>{initl}</div>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: "#21262d" }} />

          {/* Run / Stop */}
          <button
            onClick={() => setRunning(r => !r)}
            style={{ background: running ? "#1a3a1a" : "#0d3a1a", border: `1px solid ${running ? "#3fb95066" : "#3fb950"}`, borderRadius: 6, padding: "5px 14px", color: running ? "#f85149" : "#3fb950", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, minWidth: 80, justifyContent: "center" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            {running ? <><span style={{ fontSize: 10 }}>■</span> Stop</> : <><span style={{ fontSize: 10 }}>▶</span> Run</>}
          </button>

          <div style={{ width: 1, height: 20, background: "#21262d" }} />

          {/* Panels toggle */}
          <button onClick={() => setCustomizingPanels(c => !c)} style={{ background: customizingPanels ? "#1f6feb22" : "transparent", border: customizingPanels ? "1px solid #1f6feb" : "1px solid #30363d", borderRadius: 6, padding: "5px 10px", color: customizingPanels ? "#58a6ff" : "#8b949e", fontSize: 12, cursor: "pointer" }}>⚙ Panels</button>

          {/* Settings ⚙ */}
          <div style={{ position: "relative" as const }}>
            <button onClick={() => setSettingsOpen(o => !o)} title="Workspace settings"
              style={{ background: settingsOpen ? "#21262d" : "transparent", border: settingsOpen ? "1px solid #30363d" : "1px solid transparent", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 14, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
              onMouseLeave={e => { if (!settingsOpen) e.currentTarget.style.background = "transparent"; }}>
              ⚙
            </button>
            {settingsOpen && (
              <>
                <div onClick={() => setSettingsOpen(false)} style={{ position: "fixed" as const, inset: 0, zIndex: 100 }} />
                <div style={{ position: "absolute" as const, right: 0, top: 36, width: 300, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, zIndex: 101, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #21262d", fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1 }}>Workspace</div>

                  {/* Always-On */}
                  <div style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1a1f26" }}>
                    <span style={{ fontSize: 14 }}>⏻</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#e1e4e8" }}>Always-On</div>
                      <div style={{ fontSize: 10, color: "#484f58" }}>Keep Repl running 24/7 · 5 cycles/day</div>
                    </div>
                    <button onClick={() => setAlwaysOn(a => !a)} style={{ width: 32, height: 18, background: alwaysOn ? "#3fb950" : "#30363d", border: "none", borderRadius: 9, cursor: "pointer", position: "relative" as const, padding: 0 }}>
                      <span style={{ position: "absolute" as const, top: 2, left: alwaysOn ? 16 : 2, width: 14, height: 14, background: "#fff", borderRadius: "50%", transition: "left 0.15s" }} />
                    </button>
                  </div>

                  {/* Boost */}
                  <div style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1a1f26" }}>
                    <span style={{ fontSize: 14, color: boost ? "#f26522" : "#8b949e" }}>⚡</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#e1e4e8" }}>Boost</div>
                      <div style={{ fontSize: 10, color: "#484f58" }}>4 vCPU · 8 GB RAM · 20 cycles/hr</div>
                    </div>
                    <button onClick={() => setBoost(b => !b)} style={{ width: 32, height: 18, background: boost ? "#f26522" : "#30363d", border: "none", borderRadius: 9, cursor: "pointer", position: "relative" as const, padding: 0 }}>
                      <span style={{ position: "absolute" as const, top: 2, left: boost ? 16 : 2, width: 14, height: 14, background: "#fff", borderRadius: "50%", transition: "left 0.15s" }} />
                    </button>
                  </div>

                  {/* Theme */}
                  <div style={{ padding: "9px 14px", borderBottom: "1px solid #1a1f26" }}>
                    <div style={{ fontSize: 12, color: "#e1e4e8", marginBottom: 6 }}>Theme</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["dark", "midnight", "high-contrast"] as const).map(t => (
                        <button key={t} onClick={() => setTheme(t)} style={{ flex: 1, background: theme === t ? "#1f6feb22" : "#21262d", border: theme === t ? "1px solid #1f6feb" : "1px solid #30363d", borderRadius: 5, padding: "5px 6px", color: theme === t ? "#58a6ff" : "#8b949e", fontSize: 10, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" as const }}>
                          {t === "high-contrast" ? "Contrast" : t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layout */}
                  <div style={{ padding: "9px 14px", borderBottom: "1px solid #1a1f26" }}>
                    <div style={{ fontSize: 12, color: "#e1e4e8", marginBottom: 6 }}>Layout</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["default", "minimal", "focus"] as const).map(l => (
                        <button key={l} onClick={() => setLayout(l)} style={{ flex: 1, background: layout === l ? "#1f6feb22" : "#21262d", border: layout === l ? "1px solid #1f6feb" : "1px solid #30363d", borderRadius: 5, padding: "5px 6px", color: layout === l ? "#58a6ff" : "#8b949e", fontSize: 10, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" as const }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column" as const, gap: 4 }}>
                    {["Account & Billing", "Editor preferences", "Connected services", "Privacy & data", "Sign out"].map(it => (
                      <div key={it} style={{ fontSize: 12, color: it === "Sign out" ? "#f85149" : "#c9d1d9", padding: "4px 0", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#58a6ff")}
                        onMouseLeave={e => (e.currentTarget.style.color = it === "Sign out" ? "#f85149" : "#c9d1d9")}>
                        {it}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Help / Shortcuts */}
          <div style={{ position: "relative" as const }}>
            <button onClick={() => setHelpOpen(o => !o)} title="Help & keyboard shortcuts"
              style={{ background: helpOpen ? "#21262d" : "transparent", border: helpOpen ? "1px solid #30363d" : "1px solid transparent", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 14, cursor: "pointer", fontWeight: 600 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
              onMouseLeave={e => { if (!helpOpen) e.currentTarget.style.background = "transparent"; }}>
              ?
            </button>
            {helpOpen && (
              <>
                <div onClick={() => setHelpOpen(false)} style={{ position: "fixed" as const, inset: 0, zIndex: 100 }} />
                <div style={{ position: "absolute" as const, right: 0, top: 36, width: 280, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, zIndex: 101, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #21262d", fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1 }}>Keyboard shortcuts</div>
                  {[
                    { keys: ["⌘", "K"], label: "Command palette" },
                    { keys: ["⌘", "P"], label: "Quick file open" },
                    { keys: ["⌘", "I"], label: "Inline AI edit" },
                    { keys: ["⌘", "S"], label: "Save file" },
                    { keys: ["⌘", "↵"], label: "Run / send" },
                    { keys: ["⌘", "/"], label: "Toggle comment" },
                    { keys: ["⌘", "B"], label: "Toggle sidebar" },
                    { keys: ["⌘", "J"], label: "Toggle bottom panels" },
                    { keys: ["⇧", "⌘", "P"], label: "Command (alt)" },
                  ].map(s => (
                    <div key={s.label} style={{ padding: "7px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1f26" }}>
                      <span style={{ fontSize: 12, color: "#c9d1d9" }}>{s.label}</span>
                      <span style={{ display: "flex", gap: 3 }}>
                        {s.keys.map((k, i) => (
                          <kbd key={i} style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 3, padding: "0 6px", fontSize: 10, color: "#8b949e", fontFamily: "monospace", minWidth: 18, textAlign: "center" as const }}>{k}</kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                  <div style={{ padding: "8px 14px", display: "flex", gap: 12, borderTop: "1px solid #21262d" }}>
                    <a style={{ fontSize: 11, color: "#58a6ff", cursor: "pointer", textDecoration: "none" }}>📖 Docs</a>
                    <a style={{ fontSize: 11, color: "#58a6ff", cursor: "pointer", textDecoration: "none" }}>💬 Support</a>
                    <a style={{ fontSize: 11, color: "#58a6ff", cursor: "pointer", textDecoration: "none" }}>↻ Tour</a>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Notification bell */}
          <div style={{ position: "relative" as const }}>
            <button onClick={() => setShowNotifs(s => !s)} style={{ background: showNotifs ? "#21262d" : "transparent", border: showNotifs ? "1px solid #30363d" : "1px solid transparent", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 15, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
              onMouseLeave={e => { if (!showNotifs) e.currentTarget.style.background = "transparent"; }}>
              🔔
            </button>
            {notifCount > 0 && (
              <div style={{ position: "absolute" as const, top: 3, right: 3, width: 14, height: 14, background: "#f85149", borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, border: "2px solid #161b22", pointerEvents: "none" }}>{notifCount}</div>
            )}
            {showNotifs && (
              <div style={{ position: "absolute" as const, right: 0, top: 36, width: 280, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, zIndex: 200, boxShadow: "0 8px 24px #00000066", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #21262d", fontSize: 12, fontWeight: 600, color: "#e1e4e8", display: "flex", justifyContent: "space-between" }}>
                  Notifications <span style={{ color: "#8b949e", fontWeight: 400, cursor: "pointer" }} onClick={() => setShowNotifs(false)}>✕</span>
                </div>
                {[
                  { icon: "✦", text: "Agent finished writing route handlers", time: "2m ago", color: "#f26522" },
                  { icon: "⬡", text: "express@4.19.2 available (update)", time: "15m ago", color: "#58a6ff" },
                  { icon: "⎇", text: "main branch pushed — 3 commits ahead", time: "1h ago", color: "#3fb950" },
                ].map((n, i) => (
                  <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #21262d", display: "flex", gap: 10, cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ fontSize: 14, color: n.color, flexShrink: 0, marginTop: 1 }}>{n.icon}</div>
                    <div>
                      <div style={{ fontSize: 12, color: "#e1e4e8", lineHeight: 1.4 }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6e40c9,#1f6feb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>U</div>
        </div>
      </div>

      {/* PANEL CUSTOMIZER */}
      {customizingPanels && (
        <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "8px 16px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const, flexShrink: 0 }}>
          <span style={{ color: "#8b949e", fontSize: 11, marginRight: 4 }}>Toggle panels:</span>
          {ALL_PANELS.map(p => (
            <button key={p} onClick={() => togglePanel(p)} style={{ background: visiblePanels.includes(p) ? "#1f6feb22" : "#21262d", border: visiblePanels.includes(p) ? "1px solid #1f6feb" : "1px solid #30363d", borderRadius: 4, padding: "3px 10px", color: visiblePanels.includes(p) ? "#58a6ff" : "#8b949e", fontSize: 11, cursor: "pointer", textTransform: "capitalize" as const, display: "flex", alignItems: "center", gap: 4 }}>
              <span>{PANEL_ICONS[p]}</span> {p}
            </button>
          ))}
        </div>
      )}

      {/* CONTENT */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <div style={{ flex: 1, background: "#0e1117", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1 }}>Task History</span>
              <button
                onClick={() => setActiveTab("account")}
                style={{ background: "transparent", border: "1px solid #30363d", borderRadius: 5, color: "#8b949e", fontSize: 11, padding: "3px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                onMouseEnter={e => { (e.currentTarget.style.borderColor = "#bc8cff"); (e.currentTarget.style.color = "#bc8cff"); }}
                onMouseLeave={e => { (e.currentTarget.style.borderColor = "#30363d"); (e.currentTarget.style.color = "#8b949e"); }}
              >
                <span>⬡</span> Agent Config
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {PAST_TASKS.map(t => {
                const fw = AGENT_FRAMEWORKS.find(f => f.id === t.aiConfig.framework)!;
                return (
                  <div key={t.id} style={{ padding: "11px 16px", borderBottom: "1px solid #21262d" }}>
                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                      onClick={() => setActiveTab("new")}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.cursor = "pointer"}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.status === "done" ? "#3fb950" : t.status === "running" ? "#f26522" : "#f85149", flexShrink: 0 }} />
                      <span style={{ color: "#e1e4e8", fontSize: 13, flex: 1 }}>{t.title}</span>
                      <span style={{ color: "#484f58", fontSize: 11, flexShrink: 0 }}>{t.time}</span>
                    </div>
                    {/* AI config badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 14 }}>
                      {/* Framework badge */}
                      <span style={{ background: `${fw.color}18`, border: `1px solid ${fw.color}44`, borderRadius: 10, fontSize: 10, color: fw.color, padding: "1px 7px", display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontWeight: 700 }}>{fw.logo}</span> {fw.name}
                      </span>
                      {/* Model badge */}
                      <span style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 10, fontSize: 10, color: "#8b949e", padding: "1px 7px" }}>
                        {t.aiConfig.modelName}
                      </span>
                      {/* Configure button */}
                      <button
                        onClick={() => setActiveTab("account")}
                        style={{ marginLeft: "auto", background: "transparent", border: "1px solid #30363d", borderRadius: 5, color: "#484f58", fontSize: 10, padding: "1px 7px", cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget.style.borderColor = fw.color); (e.currentTarget.style.color = fw.color); }}
                        onMouseLeave={e => { (e.currentTarget.style.borderColor = "#30363d"); (e.currentTarget.style.color = "#484f58"); }}
                      >
                        ⚙ Configure
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ACCOUNT TAB */}
        {activeTab === "account" && <AccountPanel />}

        {/* WORKSPACE */}
        {activeTab === "new" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* LEFT ICON RAIL */}
            <LeftRail activePanel={activePanel} setActivePanel={setActivePanel} visiblePanels={visiblePanels} />

            {/* FILE SIDEBAR */}
            <div style={{ width: sidebarWidth, background: "#161b22", borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d", fontSize: 11, fontWeight: 600, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                Files
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="New File">+</button>
                  <button style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="New Folder">⊞</button>
                  <button style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "0 2px" }} title="Collapse All">⊟</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
                {FILE_TREE.map((item, i) => (
                  <div key={i} style={{ padding: "3px 12px", paddingLeft: 12 + item.depth * 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: item.active ? "#1f6feb18" : "transparent", borderLeft: item.active ? "2px solid #1f6feb" : "2px solid transparent" }}
                    onMouseEnter={e => { if (!item.active) (e.currentTarget as HTMLElement).style.background = "#21262d"; }}
                    onMouseLeave={e => { if (!item.active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {item.type === "folder" ? <span style={{ color: "#e3b341", fontSize: 11 }}>{item.open ? "▾" : "▸"}</span> : <FileIcon ext={item.ext} />}
                    <span style={{ color: item.active ? "#58a6ff" : item.type === "folder" ? "#e1e4e8" : "#8b949e", fontSize: 12, fontWeight: item.active ? 500 : 400 }}>{item.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #21262d", padding: "6px 0" }}>
                {[
                  ["✦", "Agent", null, null],
                  ["⌕", "Search", null, null],
                  ["⎇", "Git", null, "3↑"],
                  ["↑", "Deploy", null, "Live"],
                  ["⬡", "Packages", null, null],
                  ["≡", "Outline", null, "12"],
                  ["💬", "Threads", null, "2"],
                  ["▣", "Storage", null, null],
                  ["☆", "Bounties", null, "$$"],
                ].map(([icon, label, _, badge]) => (
                  <div key={label as string} style={{ padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#8b949e", fontSize: 12 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#21262d"; (e.currentTarget as HTMLElement).style.color = "#e1e4e8"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#8b949e"; }}
                    onClick={() => { const map: Record<string, PanelId> = { Search: "search", Git: "git", Deploy: "deploy", Packages: "packages" }; if (map[label as string]) setActivePanel(map[label as string]); }}
                  >
                    <span style={{ fontSize: 13, width: 14, textAlign: "center" as const }}>{icon}</span>
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge && <span style={{ fontSize: 9, color: label === "Git" ? "#3fb950" : label === "Deploy" ? "#3fb950" : label === "Bounties" ? "#e3b341" : "#58a6ff", background: "#21262d", border: "1px solid #30363d", borderRadius: 8, padding: "0 5px" }}>{badge as string}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar resize handle */}
            <div onMouseDown={onSidebarDragStart} style={{ width: 4, cursor: "col-resize", background: "transparent", flexShrink: 0 }}
              onMouseEnter={e => ((e.target as HTMLElement).style.background = "#1f6feb")}
              onMouseLeave={e => ((e.target as HTMLElement).style.background = "transparent")}
            />

            {/* EDITOR + AGENT */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Editor tabs + Run indicator */}
              <div style={{ height: 36, background: "#161b22", borderBottom: "1px solid #21262d", display: "flex", alignItems: "stretch", flexShrink: 0 }}>
                {["auth.ts", "index.ts", "jwt.ts"].map((tab, i) => (
                  <div key={tab} style={{ padding: "0 14px", display: "flex", alignItems: "center", gap: 6, borderRight: "1px solid #21262d", cursor: "pointer", background: i === 0 ? "#0e1117" : "transparent", borderBottom: i === 0 ? "2px solid #f26522" : "2px solid transparent", color: i === 0 ? "#e1e4e8" : "#8b949e", fontSize: 12 }}>
                    <FileIcon ext="ts" />{tab}<span style={{ color: "#484f58", fontSize: 11, marginLeft: 2 }}>×</span>
                  </div>
                ))}
                {/* New tab + Split editor */}
                <button title="New tab" style={{ width: 30, background: "transparent", border: "none", borderRight: "1px solid #21262d", color: "#8b949e", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>+</button>
                <button title="Split editor right" style={{ width: 30, background: "transparent", border: "none", borderRight: "1px solid #21262d", color: "#8b949e", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>⬒</button>
                {/* Running pill */}
                {running && (
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 12, gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#0d2a0d", border: "1px solid #3fb95044", borderRadius: 10, padding: "2px 10px", fontSize: 11, color: "#3fb950" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                      node src/index.ts
                    </div>
                  </div>
                )}
              </div>

              {/* Breadcrumbs */}
              <div style={{ height: 24, background: "#0e1117", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", padding: "0 12px", gap: 4, flexShrink: 0 }}>
                {["src", "routes", "auth.ts"].map((crumb, i, arr) => (
                  <span key={crumb} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: i === arr.length - 1 ? "#e1e4e8" : "#8b949e", fontSize: 11, cursor: "pointer" }}
                      onMouseEnter={e => { if (i < arr.length - 1) (e.currentTarget as HTMLElement).style.color = "#58a6ff"; }}
                      onMouseLeave={e => { if (i < arr.length - 1) (e.currentTarget as HTMLElement).style.color = "#8b949e"; }}>
                      {i === 0 ? "📁 " : i === 1 ? "📁 " : <FileIcon ext="ts" />}{crumb}
                    </span>
                    {i < arr.length - 1 && <span style={{ color: "#484f58", fontSize: 10 }}>›</span>}
                  </span>
                ))}
              </div>

              {/* Code + Agent split */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Code editor */}
                <div style={{ flex: 1, background: "#0e1117", overflow: "auto", padding: "12px 0", fontFamily: "'Fira Code', monospace", fontSize: 12, lineHeight: 1.7 }}>
                  {CODE_CONTENT.split("\n").map((line, i) => {
                    const ln = i + 1;
                    const collab = ln === 8 ? { color: "#3fb950", name: "Sara" } : ln === 21 ? { color: "#bc8cff", name: "Marcus" } : null;
                    const hasThread = ln === 14;
                    const ghostText = ln === cursorLine ? "  // TODO: validate with zod schema before lookup" : null;
                    return (
                      <div key={i} style={{ display: "flex", paddingRight: 8, background: ln === cursorLine ? "#1f6feb0a" : "transparent", borderLeft: ln === cursorLine ? "2px solid #1f6feb44" : "2px solid transparent", position: "relative" as const }}>
                        <span style={{ width: 40, textAlign: "right", paddingRight: 16, color: ln === cursorLine ? "#8b949e" : "#484f58", flexShrink: 0, userSelect: "none" }}>{ln}</span>
                        <span style={{ position: "relative" as const, flex: 1 }}>
                          <span dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }} />
                          {ghostText && (
                            <span style={{ color: "#484f58", fontStyle: "italic" as const, opacity: 0.75 }}>
                              {ghostText}
                              <span style={{ marginLeft: 10, fontSize: 9, padding: "1px 5px", border: "1px solid #30363d", borderRadius: 3, color: "#8b949e", fontStyle: "normal" as const, background: "#161b22" }}>✦ AI · Tab to accept</span>
                            </span>
                          )}
                          {collab && (
                            <span style={{ position: "absolute" as const, left: `${Math.min(line.length, 30) * 7.2}px`, top: 0, display: "inline-flex", alignItems: "center", pointerEvents: "none" as const }}>
                              <span style={{ width: 2, height: 18, background: collab.color, display: "inline-block", animation: "pulse 1.2s ease-in-out infinite" }} />
                              <span style={{ background: collab.color, color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: "0 3px 3px 3px", fontFamily: "'Inter', sans-serif", fontWeight: 600, marginLeft: 0 }}>{collab.name}</span>
                            </span>
                          )}
                          {hasThread && (
                            <span title="1 comment thread" style={{ position: "absolute" as const, right: 8, top: 0, fontSize: 11, color: "#e3b341", cursor: "pointer", pointerEvents: "auto" as const }}>💬 1</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Minimap */}
                <div style={{ position: "relative" as const }}>
                  <Minimap code={CODE_CONTENT} />
                </div>

                {/* Agent */}
                <div style={{ width: 320, background: "#161b22", borderLeft: "1px solid #21262d", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, background: "linear-gradient(135deg,#f26522,#f5a623)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>✦</div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Agent</span>
                    <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 6px #3fb95088" }} />
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                    {CHAT_MESSAGES.map(msg => (
                      <div key={msg.id}>
                        {msg.role === "user" ? (
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <div style={{ background: "#1f6feb", color: "#fff", padding: "7px 11px", borderRadius: "12px 12px 2px 12px", maxWidth: "85%", fontSize: 12, lineHeight: 1.5 }}>{msg.content}</div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                            <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#f26522,#f5a623)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>✦</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ background: "#21262d", color: "#e1e4e8", padding: "7px 11px", borderRadius: "2px 12px 12px 12px", fontSize: 12, lineHeight: 1.5, marginBottom: 7 }}>{msg.content}</div>
                              {msg.steps && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                  {msg.steps.map((s, si) => (
                                    <div key={si} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 7px", background: s.active ? "#1f6feb11" : "transparent", borderRadius: 4, border: s.active ? "1px solid #1f6feb33" : "1px solid transparent" }}>
                                      <span style={{ fontSize: 11, color: s.done ? "#3fb950" : s.active ? "#f26522" : "#484f58" }}>{s.done ? "✓" : s.active ? "◌" : "○"}</span>
                                      <span style={{ fontSize: 11, color: s.active ? "#e1e4e8" : s.done ? "#8b949e" : "#484f58" }}>{s.label}</span>
                                      {s.active && <span style={{ marginLeft: "auto", fontSize: 10, color: "#f26522" }}>…</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                      <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#f26522,#f5a623)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>✦</div>
                      <div style={{ background: "#21262d", padding: "9px 12px", borderRadius: "2px 12px 12px 12px", display: "flex", gap: 4, alignItems: "center" }}>
                        {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#f26522", opacity: 0.5 + i * 0.2 }} />)}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: 10, borderTop: "1px solid #21262d" }}>
                    <div style={{ background: "#21262d", borderRadius: 10, border: `1px solid ${chatPlanMode ? "#1f6feb55" : "#30363d"}`, display: "flex", flexDirection: "column", gap: 0, transition: "border-color 0.15s" }}>
                      {/* Row 1: textarea (multi-line) */}
                      <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                        placeholder={chatPlanMode ? "Describe what to plan…" : "What should I build next?"}
                        rows={2}
                        style={{ background: "transparent", border: "none", outline: "none", color: "#e1e4e8", fontSize: 12, resize: "none", fontFamily: "inherit", lineHeight: 1.55, padding: "9px 11px 4px", minHeight: 38, maxHeight: 180 }} />

                      {/* Row 2: controls */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 6px 6px" }}>
                        {/* Attach */}
                        <button title="Attach file"
                          style={{ width: 26, height: 26, background: "transparent", border: "none", borderRadius: 5, color: "#8b949e", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#30363d")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          +
                        </button>

                        {/* Plan toggle */}
                        <button onClick={() => setChatPlanMode(!chatPlanMode)} title="Plan mode — agent proposes a plan before acting"
                          style={{ height: 26, padding: "0 9px", background: chatPlanMode ? "#1f6feb22" : "transparent", border: `1px solid ${chatPlanMode ? "#1f6feb55" : "#30363d"}`, borderRadius: 5, color: chatPlanMode ? "#58a6ff" : "#8b949e", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", flexShrink: 0 }}>
                          <span style={{ fontSize: 11 }}>◇</span> Plan
                          {chatPlanMode && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#58a6ff" }} />}
                        </button>

                        {/* Tier dropdown */}
                        <div style={{ position: "relative" as const, flexShrink: 0 }}>
                          <button onClick={() => setChatTierOpen(!chatTierOpen)}
                            style={{ height: 26, padding: "0 8px", background: "transparent", border: "1px solid #30363d", borderRadius: 5, color: "#c9d1d9", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: chatTier === "power" ? "#f26522" : chatTier === "lite" ? "#58a6ff" : "#3fb950" }} />
                            <span style={{ textTransform: "capitalize" as const }}>{chatTier}</span>
                            <span style={{ fontSize: 8, color: "#8b949e", marginLeft: 1 }}>▾</span>
                          </button>
                          {chatTierOpen && (
                            <>
                              <div onClick={() => setChatTierOpen(false)} style={{ position: "fixed" as const, inset: 0, zIndex: 20 }} />
                              <div style={{ position: "absolute" as const, bottom: "calc(100% + 4px)", left: 0, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 4, minWidth: 180, zIndex: 21, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                                {([
                                  { id: "power" as const, name: "Power", model: "GPT-4o · Claude 3.5 Sonnet", color: "#f26522", desc: "Smartest, full agentic loop" },
                                  { id: "lite"  as const, name: "Lite",  model: "GPT-4o mini · Haiku",        color: "#58a6ff", desc: "Faster, lower cost" },
                                  { id: "eco"   as const, name: "Eco",   model: "Llama 3.1 · Hermes 3 8B",   color: "#3fb950", desc: "Cheapest, basic tasks" },
                                ]).map(t => (
                                  <button key={t.id} onClick={() => { setChatTier(t.id); setChatTierOpen(false); }}
                                    style={{ width: "100%", textAlign: "left" as const, background: chatTier === t.id ? `${t.color}18` : "transparent", border: "none", borderRadius: 5, padding: "7px 9px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "flex-start", gap: 8 }}
                                    onMouseEnter={e => { if (chatTier !== t.id) (e.currentTarget as HTMLElement).style.background = "#21262d"; }}
                                    onMouseLeave={e => { if (chatTier !== t.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, marginTop: 4, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 12, color: "#e1e4e8", fontWeight: chatTier === t.id ? 600 : 400 }}>{t.name}</div>
                                      <div style={{ fontSize: 10, color: t.color, marginTop: 1 }}>{t.model}</div>
                                      <div style={{ fontSize: 10, color: "#484f58", marginTop: 1 }}>{t.desc}</div>
                                    </div>
                                    {chatTier === t.id && <span style={{ color: t.color, fontSize: 11, marginTop: 2 }}>✓</span>}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ flex: 1 }} />

                        {/* Voice */}
                        <button onClick={() => setChatVoiceOn(!chatVoiceOn)} title="Voice input"
                          style={{ width: 26, height: 26, background: chatVoiceOn ? "#f8514922" : "transparent", border: `1px solid ${chatVoiceOn ? "#f8514955" : "transparent"}`, borderRadius: 5, color: chatVoiceOn ? "#f85149" : "#8b949e", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                          onMouseEnter={e => { if (!chatVoiceOn) (e.currentTarget as HTMLElement).style.background = "#30363d"; }}
                          onMouseLeave={e => { if (!chatVoiceOn) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          {chatVoiceOn ? "●" : "🎤"}
                        </button>

                        {/* Send */}
                        <button title={chatPlanMode ? "Send (Plan mode)" : "Send"}
                          style={{ background: chatInput ? (chatPlanMode ? "#1f6feb" : "#f26522") : "#30363d", border: "none", borderRadius: 5, width: 26, height: 26, cursor: chatInput ? "pointer" : "default", color: "#fff", fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
                          {chatPlanMode ? "◇" : "↑"}
                        </button>
                      </div>

                      {/* Plan mode hint */}
                      {chatPlanMode && (
                        <div style={{ padding: "6px 11px 8px", borderTop: "1px solid #30363d", fontSize: 10, color: "#58a6ff", background: "#1f6feb0a", borderRadius: "0 0 9px 9px", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>◇</span>
                          <span>Plan mode: agent will propose a step-by-step plan and wait for approval before executing.</span>
                        </div>
                      )}
                    </div>

                    {/* Tier hint below */}
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
                      <span style={{ fontSize: 10, color: "#484f58" }}>
                        {chatTier === "power" && "Best quality · ~$0.04/task"}
                        {chatTier === "lite"  && "Balanced · ~$0.008/task"}
                        {chatTier === "eco"   && "Lowest cost · ~$0.001/task"}
                      </span>
                      <span style={{ fontSize: 10, color: "#484f58" }}>⏎ send · ⇧⏎ newline</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PANELS */}
              {visiblePanels.length > 0 && (
                <>
                  <div onMouseDown={onPanelDragStart} style={{ height: 4, cursor: "row-resize", background: "transparent", flexShrink: 0 }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.background = "#1f6feb")}
                    onMouseLeave={e => ((e.target as HTMLElement).style.background = "transparent")}
                  />
                  <div style={{ height: panelHeight, background: "#161b22", borderTop: "1px solid #21262d", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
                    {/* Panel tab bar */}
                    <div style={{ height: 34, display: "flex", alignItems: "stretch", borderBottom: "1px solid #21262d", background: "#0e1117", flexShrink: 0, overflowX: "auto", scrollbarWidth: "none" as const }}>
                      {visiblePanels.map(p => (
                        <button key={p} onClick={() => setActivePanel(p)} style={{ padding: "0 12px", background: "transparent", border: "none", borderBottom: activePanel === p ? "2px solid #f26522" : "2px solid transparent", color: activePanel === p ? "#e1e4e8" : "#8b949e", fontSize: 11, cursor: "pointer", fontWeight: activePanel === p ? 500 : 400, textTransform: "capitalize" as const, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" as const }}>
                          <span style={{ fontSize: 12 }}>{PANEL_ICONS[p]}</span>{p}
                        </button>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button style={{ padding: "0 10px", background: "transparent", border: "none", color: "#484f58", cursor: "pointer", fontSize: 14 }} onClick={() => setPanelHeight(0)}>×</button>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <PanelContent />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* STATUS BAR */}
      <StatusBar
        metrics={metrics}
        running={running}
        errors={0}
        warnings={2}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        visiblePanels={visiblePanels}
      />

      {/* BOTTOM NAV */}
      <div style={{ height: 50, background: "#161b22", borderTop: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}>
        {(["tasks", "new", "account"] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 22px", background: activeTab === tab ? "#21262d" : "transparent", border: activeTab === tab ? "1px solid #30363d" : "1px solid transparent", borderRadius: 8, color: activeTab === tab ? "#e1e4e8" : "#8b949e", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: activeTab === tab ? 600 : 400, display: "flex", alignItems: "center", gap: 5, minWidth: 90, justifyContent: "center" }}>
            <span style={{ fontSize: 14 }}>{tab === "tasks" ? "☰" : tab === "new" ? "✦" : "○"}</span>
            <span style={{ textTransform: "capitalize" as const }}>{tab === "new" ? "Workspace" : tab}</span>
          </button>
        ))}
      </div>

      {/* COMMAND PALETTE (⌘K) */}
      {cmdKOpen && (() => {
        const all = [
          { group: "Files", icon: "📄", items: ["src/routes/auth.ts", "src/index.ts", "src/lib/jwt.ts", "package.json", ".env", "README.md"] },
          { group: "Commands", icon: "⚡", items: ["Run project", "Stop project", "Open shell", "Format file", "Toggle terminal", "Restart language server", "Find in files", "Git: commit all"] },
          { group: "Agent", icon: "✦", items: ["New chat", "Plan mode: Toggle", "Switch to Power tier", "Switch to Lite tier", "Open agent settings"] },
          { group: "Settings", icon: "⚙", items: ["Open settings", "Switch theme", "Keyboard shortcuts", "Account & billing"] },
        ];
        const q = cmdKQuery.toLowerCase().trim();
        const filtered = all.map(g => ({ ...g, items: g.items.filter(it => !q || it.toLowerCase().includes(q)) })).filter(g => g.items.length > 0);
        return (
          <div onClick={() => setCmdKOpen(false)} style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 600, maxWidth: "90vw", background: "#161b22", border: "1px solid #30363d", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.7)", overflow: "hidden", display: "flex", flexDirection: "column" as const, maxHeight: "70vh" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, color: "#8b949e" }}>⌕</span>
                <input autoFocus placeholder="Type a command or search files…" value={cmdKQuery} onChange={e => setCmdKQuery(e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e1e4e8", fontSize: 15, fontFamily: "inherit" }} />
                <kbd style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#8b949e", fontFamily: "monospace" }}>esc</kbd>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: "30px 18px", color: "#484f58", fontSize: 13, textAlign: "center" as const }}>No results for "{cmdKQuery}"</div>
                ) : filtered.map(g => (
                  <div key={g.group}>
                    <div style={{ padding: "8px 18px 4px", fontSize: 10, color: "#484f58", textTransform: "uppercase" as const, letterSpacing: 0.8, fontWeight: 600 }}>{g.group}</div>
                    {g.items.map((it, i) => (
                      <div key={it} style={{ padding: "7px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: g.group === filtered[0].group && i === 0 ? "#1f6feb22" : "transparent" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#1f6feb22")}
                        onMouseLeave={e => { if (!(g.group === filtered[0].group && i === 0)) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <span style={{ fontSize: 13, width: 16, textAlign: "center" as const }}>{g.icon}</span>
                        <span style={{ flex: 1, fontSize: 13, color: "#e1e4e8" }}>{it}</span>
                        {g.group === filtered[0].group && i === 0 && <kbd style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 3, padding: "1px 6px", fontSize: 10, color: "#8b949e", fontFamily: "monospace" }}>↵</kbd>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ padding: "8px 18px", borderTop: "1px solid #21262d", display: "flex", gap: 14, fontSize: 10, color: "#484f58" }}>
                <span><kbd style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 3, padding: "0 5px", fontSize: 9, color: "#8b949e", fontFamily: "monospace" }}>↑↓</kbd> navigate</span>
                <span><kbd style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 3, padding: "0 5px", fontSize: 9, color: "#8b949e", fontFamily: "monospace" }}>↵</kbd> open</span>
                <span><kbd style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 3, padding: "0 5px", fontSize: 9, color: "#8b949e", fontFamily: "monospace" }}>esc</kbd> close</span>
                <span style={{ marginLeft: "auto" }}>{filtered.reduce((n, g) => n + g.items.length, 0)} results</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MOBILE QR MODAL */}
      {showQR && (
        <div onClick={() => setShowQR(false)} style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 24, width: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e1e4e8" }}>Preview on your phone</span>
              <span onClick={() => setShowQR(false)} style={{ color: "#8b949e", cursor: "pointer", fontSize: 14 }}>✕</span>
            </div>
            {/* Fake QR code grid */}
            <div style={{ width: 200, height: 200, background: "#fff", padding: 10, borderRadius: 6, display: "grid", gridTemplateColumns: "repeat(21, 1fr)", gap: 0 }}>
              {Array.from({ length: 21 * 21 }).map((_, i) => {
                const x = i % 21, y = Math.floor(i / 21);
                const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
                const cornerInner = corner && ((x === 0 || x === 6 || x === 14 || x === 20) || (y === 0 || y === 6 || y === 14 || y === 20));
                const filled = corner ? (cornerInner || (x > 1 && x < 5 && y > 1 && y < 5) || (x > 15 && x < 19 && y > 1 && y < 5) || (x > 1 && x < 5 && y > 15 && y < 19)) : ((i * 7919 + 31) % 3 === 0);
                return <div key={i} style={{ background: filled ? "#000" : "#fff", aspectRatio: "1" }} />;
              })}
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", textAlign: "center" as const, lineHeight: 1.5 }}>
              Scan with your phone camera<br />or open in Replit Mobile app
            </div>
            <div style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: "#58a6ff", background: "#0d1117", padding: "6px 10px", borderRadius: 5, border: "1px solid #21262d", width: "100%", textAlign: "center" as const }}>
              my-rest-api.you.repl.co
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
      `}</style>
    </div>
  );
}
