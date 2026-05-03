import { useState, useRef, useCallback } from "react";

const PREDEFINED_TASKS = [
  "Build a REST API with auth",
  "Create a React dashboard",
  "Set up a PostgreSQL database",
  "Deploy to production",
  "Write unit tests",
  "Add dark mode",
];

const PAST_TASKS = [
  { id: 1, title: "Build a landing page for SaaS", time: "2h ago", status: "done" },
  { id: 2, title: "Add Stripe payment integration", time: "Yesterday", status: "done" },
  { id: 3, title: "Fix authentication bug in Express", time: "2 days ago", status: "done" },
  { id: 4, title: "Create admin dashboard with charts", time: "3 days ago", status: "done" },
  { id: 5, title: "Set up CI/CD with GitHub Actions", time: "5 days ago", status: "done" },
];

const CHAT_MESSAGES = [
  {
    id: 1,
    role: "user",
    content: "Build a REST API with authentication using Express and JWT",
  },
  {
    id: 2,
    role: "agent",
    content: "I'll build a complete REST API with JWT authentication. Let me set up the project structure first.",
    steps: [
      { label: "Setting up Express server", done: true },
      { label: "Installing dependencies", done: true },
      { label: "Creating auth middleware", done: true },
      { label: "Writing route handlers", done: false, active: true },
    ],
  },
  {
    id: 3,
    role: "user",
    content: "Also add rate limiting and refresh tokens",
  },
];

const CONSOLE_LINES = [
  { type: "info", text: "> pnpm install" },
  { type: "success", text: "Packages: +124" },
  { type: "info", text: "> node src/index.ts" },
  { type: "success", text: "Server running on port 3000" },
  { type: "info", text: "GET /api/health 200 2ms" },
  { type: "error", text: "POST /api/auth/login 401 Unauthorized" },
  { type: "info", text: "POST /api/auth/login 200 45ms" },
];

const FILE_TREE = [
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

type Tab = "tasks" | "new" | "account";
type Panel = "console" | "shell" | "webview" | "files";

function FileIcon({ ext }: { ext?: string }) {
  const colors: Record<string, string> = {
    ts: "#3178c6",
    js: "#f7df1e",
    json: "#cbcb41",
    env: "#8bc34a",
    md: "#519aba",
  };
  const labels: Record<string, string> = {
    ts: "TS",
    js: "JS",
    json: "{}",
    env: "ENV",
    md: "MD",
  };
  const color = ext ? colors[ext] || "#888" : "#888";
  const label = ext ? labels[ext] || ext?.toUpperCase() || "" : "";
  return (
    <span
      style={{
        fontSize: "9px",
        color,
        fontWeight: 700,
        fontFamily: "monospace",
        width: 20,
        display: "inline-block",
        textAlign: "center",
      }}
    >
      {label}
    </span>
  );
}

export function AIInterface() {
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [activePanel, setActivePanel] = useState<Panel>("console");
  const [panelHeight, setPanelHeight] = useState(200);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [chatInput, setChatInput] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [customizingPanels, setCustomizingPanels] = useState(false);
  const [visiblePanels, setVisiblePanels] = useState<Panel[]>(["console", "shell", "webview", "files"]);
  const dragRef = useRef<{ type: "panel" | "sidebar"; startY?: number; startX?: number; startVal?: number } | null>(null);

  const onPanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { type: "panel", startY: e.clientY, startVal: panelHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (dragRef.current.startY! - ev.clientY);
      setPanelHeight(Math.max(100, Math.min(500, dragRef.current.startVal! + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelHeight]);

  const onSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { type: "sidebar", startX: e.clientX, startVal: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX!;
      setSidebarWidth(Math.max(160, Math.min(360, dragRef.current.startVal! + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const togglePanel = (panel: Panel) => {
    setVisiblePanels(prev =>
      prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel]
    );
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0e1117",
        color: "#e1e4e8",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 13,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          height: 48,
          background: "#161b22",
          borderBottom: "1px solid #21262d",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #f26522 0%, #f5a623 100%)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            A
          </div>
          <span style={{ fontWeight: 600, color: "#e1e4e8", fontSize: 14 }}>AI OS</span>
        </div>

        <div style={{ width: 1, height: 20, background: "#21262d" }} />

        {/* Predefined Task Chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
          {PREDEFINED_TASKS.map((task, i) => (
            <button
              key={i}
              style={{
                background: "#21262d",
                border: "1px solid #30363d",
                borderRadius: 20,
                padding: "4px 12px",
                color: "#8b949e",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.background = "#2d333b";
                (e.target as HTMLElement).style.color = "#e1e4e8";
                (e.target as HTMLElement).style.borderColor = "#f26522";
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.background = "#21262d";
                (e.target as HTMLElement).style.color = "#8b949e";
                (e.target as HTMLElement).style.borderColor = "#30363d";
              }}
            >
              {task}
            </button>
          ))}
        </div>

        {/* Top right actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setCustomizingPanels(c => !c)}
            style={{
              background: customizingPanels ? "#1f6feb22" : "transparent",
              border: customizingPanels ? "1px solid #1f6feb" : "1px solid #30363d",
              borderRadius: 6,
              padding: "5px 10px",
              color: customizingPanels ? "#58a6ff" : "#8b949e",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Customize
          </button>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6e40c9, #1f6feb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            U
          </div>
        </div>
      </div>

      {/* Customize Panel Row */}
      {customizingPanels && (
        <div
          style={{
            background: "#161b22",
            borderBottom: "1px solid #21262d",
            padding: "8px 16px",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#8b949e", fontSize: 12, marginRight: 4 }}>Visible panels:</span>
          {(["console", "shell", "webview", "files"] as Panel[]).map(p => (
            <button
              key={p}
              onClick={() => togglePanel(p)}
              style={{
                background: visiblePanels.includes(p) ? "#1f6feb22" : "#21262d",
                border: visiblePanels.includes(p) ? "1px solid #1f6feb" : "1px solid #30363d",
                borderRadius: 4,
                padding: "3px 10px",
                color: visiblePanels.includes(p) ? "#58a6ff" : "#8b949e",
                fontSize: 12,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* TABS SIDEBAR (when not on "new") */}
        {activeTab === "tasks" && (
          <div
            style={{
              width: 280,
              background: "#161b22",
              borderRight: "1px solid #21262d",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #21262d" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1 }}>
                Task History
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {PAST_TASKS.map(task => (
                <div
                  key={task.id}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid #21262d",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  onClick={() => setActiveTab("new")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950", flexShrink: 0 }} />
                    <span style={{ color: "#e1e4e8", fontSize: 13, lineHeight: 1.4, flex: 1 }}>{task.title}</span>
                  </div>
                  <span style={{ color: "#484f58", fontSize: 11 }}>{task.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "account" && (
          <div
            style={{
              width: 280,
              background: "#161b22",
              borderRight: "1px solid #21262d",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6e40c9, #1f6feb)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  U
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "#e1e4e8" }}>User</div>
                  <div style={{ fontSize: 12, color: "#8b949e" }}>user@example.com</div>
                </div>
              </div>
              {["Profile", "Settings", "Billing", "API Keys", "Sign out"].map(item => (
                <div
                  key={item}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: item === "Sign out" ? "#f85149" : "#e1e4e8",
                    fontSize: 13,
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORKSPACE */}
        {activeTab === "new" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* FILE TREE SIDEBAR */}
            <div
              style={{
                width: sidebarWidth,
                background: "#161b22",
                borderRight: "1px solid #21262d",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #21262d",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#8b949e",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                Files
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontSize: 16,
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
                {FILE_TREE.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "3px 12px",
                      paddingLeft: 12 + item.depth * 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      background: item.active ? "#1f6feb18" : "transparent",
                      borderLeft: item.active ? "2px solid #1f6feb" : "2px solid transparent",
                    }}
                    onMouseEnter={e => {
                      if (!item.active) (e.currentTarget as HTMLElement).style.background = "#21262d";
                    }}
                    onMouseLeave={e => {
                      if (!item.active) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {item.type === "folder" ? (
                      <span style={{ color: "#e3b341", fontSize: 12 }}>{item.open ? "▾" : "▸"}</span>
                    ) : (
                      <FileIcon ext={item.ext} />
                    )}
                    <span
                      style={{
                        color: item.active ? "#58a6ff" : item.type === "folder" ? "#e1e4e8" : "#8b949e",
                        fontSize: 12,
                        fontWeight: item.active ? 500 : 400,
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tools panel */}
              <div style={{ borderTop: "1px solid #21262d", padding: "8px 0" }}>
                {["Agent", "Search", "Git", "Deploy"].map(tool => (
                  <div
                    key={tool}
                    style={{
                      padding: "6px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#8b949e",
                      fontSize: 12,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "#21262d";
                      (e.currentTarget as HTMLElement).style.color = "#e1e4e8";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "#8b949e";
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      {tool === "Agent" ? "✦" : tool === "Search" ? "⌕" : tool === "Git" ? "⎇" : "↑"}
                    </span>
                    {tool}
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar resize handle */}
            <div
              onMouseDown={onSidebarDragStart}
              style={{
                width: 4,
                cursor: "col-resize",
                background: "transparent",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => ((e.target as HTMLElement).style.background = "#1f6feb")}
              onMouseLeave={e => ((e.target as HTMLElement).style.background = "transparent")}
            />

            {/* MAIN EDITOR + AGENT AREA */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Code Editor Tabs */}
              <div
                style={{
                  height: 36,
                  background: "#161b22",
                  borderBottom: "1px solid #21262d",
                  display: "flex",
                  alignItems: "stretch",
                  flexShrink: 0,
                }}
              >
                {["auth.ts", "index.ts", "jwt.ts"].map((tab, i) => (
                  <div
                    key={tab}
                    style={{
                      padding: "0 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      borderRight: "1px solid #21262d",
                      cursor: "pointer",
                      background: i === 0 ? "#0e1117" : "transparent",
                      borderBottom: i === 0 ? "2px solid #f26522" : "2px solid transparent",
                      color: i === 0 ? "#e1e4e8" : "#8b949e",
                      fontSize: 12,
                    }}
                  >
                    <FileIcon ext="ts" />
                    {tab}
                    <span style={{ color: "#484f58", fontSize: 11, marginLeft: 4 }}>×</span>
                  </div>
                ))}
              </div>

              {/* Split: Code + Agent */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Code Editor */}
                <div
                  style={{
                    flex: 1,
                    background: "#0e1117",
                    overflow: "auto",
                    padding: "16px 0",
                    fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}
                >
                  {CODE_CONTENT.split("\n").map((line, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        paddingRight: 24,
                      }}
                    >
                      <span
                        style={{
                          width: 40,
                          textAlign: "right",
                          paddingRight: 16,
                          color: "#484f58",
                          flexShrink: 0,
                          userSelect: "none",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: syntaxHighlight(line),
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Agent Panel */}
                <div
                  style={{
                    width: 340,
                    background: "#161b22",
                    borderLeft: "1px solid #21262d",
                    display: "flex",
                    flexDirection: "column",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #21262d",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        background: "linear-gradient(135deg, #f26522, #f5a623)",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      ✦
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#e1e4e8" }}>Agent</span>
                    <div
                      style={{
                        marginLeft: "auto",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#3fb950",
                        boxShadow: "0 0 6px #3fb95088",
                      }}
                    />
                  </div>

                  {/* Chat messages */}
                  <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                    {CHAT_MESSAGES.map(msg => (
                      <div key={msg.id}>
                        {msg.role === "user" ? (
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <div
                              style={{
                                background: "#1f6feb",
                                color: "#fff",
                                padding: "8px 12px",
                                borderRadius: "12px 12px 2px 12px",
                                maxWidth: "85%",
                                fontSize: 12,
                                lineHeight: 1.5,
                              }}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                background: "linear-gradient(135deg, #f26522, #f5a623)",
                                borderRadius: 6,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#fff",
                                flexShrink: 0,
                              }}
                            >
                              ✦
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  background: "#21262d",
                                  color: "#e1e4e8",
                                  padding: "8px 12px",
                                  borderRadius: "2px 12px 12px 12px",
                                  fontSize: 12,
                                  lineHeight: 1.5,
                                  marginBottom: 8,
                                }}
                              >
                                {msg.content}
                              </div>
                              {msg.steps && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {msg.steps.map((step, si) => (
                                    <div
                                      key={si}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "4px 8px",
                                        background: step.active ? "#1f6feb11" : "transparent",
                                        borderRadius: 4,
                                        border: step.active ? "1px solid #1f6feb33" : "1px solid transparent",
                                      }}
                                    >
                                      <span style={{ fontSize: 12, color: step.done ? "#3fb950" : step.active ? "#f26522" : "#484f58" }}>
                                        {step.done ? "✓" : step.active ? "◌" : "○"}
                                      </span>
                                      <span style={{ fontSize: 11, color: step.active ? "#e1e4e8" : step.done ? "#8b949e" : "#484f58" }}>
                                        {step.label}
                                      </span>
                                      {step.active && (
                                        <span style={{ marginLeft: "auto", fontSize: 10, color: "#f26522" }}>...</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Typing indicator */}
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          background: "linear-gradient(135deg, #f26522, #f5a623)",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        ✦
                      </div>
                      <div
                        style={{
                          background: "#21262d",
                          padding: "10px 14px",
                          borderRadius: "2px 12px 12px 12px",
                          display: "flex",
                          gap: 4,
                          alignItems: "center",
                        }}
                      >
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#f26522",
                              animation: `bounce ${0.6 + i * 0.1}s ease-in-out infinite alternate`,
                              opacity: 0.6 + i * 0.1,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chat input */}
                  <div
                    style={{
                      padding: 12,
                      borderTop: "1px solid #21262d",
                    }}
                  >
                    <div
                      style={{
                        background: "#21262d",
                        borderRadius: 8,
                        border: "1px solid #30363d",
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 8,
                        padding: "8px 10px",
                      }}
                    >
                      <textarea
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="What should I build next?"
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          color: "#e1e4e8",
                          fontSize: 12,
                          resize: "none",
                          fontFamily: "inherit",
                          lineHeight: 1.5,
                          minHeight: 20,
                          maxHeight: 80,
                        }}
                        rows={1}
                      />
                      <button
                        style={{
                          background: chatInput ? "#f26522" : "#21262d",
                          border: "none",
                          borderRadius: 6,
                          width: 28,
                          height: 28,
                          cursor: "pointer",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          flexShrink: 0,
                          transition: "background 0.15s",
                        }}
                      >
                        ↑
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM PANELS */}
              {visiblePanels.length > 0 && (
                <>
                  {/* Panel resize handle */}
                  <div
                    onMouseDown={onPanelDragStart}
                    style={{
                      height: 4,
                      cursor: "row-resize",
                      background: "transparent",
                      flexShrink: 0,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.background = "#1f6feb")}
                    onMouseLeave={e => ((e.target as HTMLElement).style.background = "transparent")}
                  />

                  {/* Panel area */}
                  <div
                    style={{
                      height: panelHeight,
                      background: "#161b22",
                      borderTop: "1px solid #21262d",
                      display: "flex",
                      flexDirection: "column",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {/* Panel tabs */}
                    <div
                      style={{
                        height: 36,
                        display: "flex",
                        alignItems: "stretch",
                        borderBottom: "1px solid #21262d",
                        background: "#0e1117",
                        flexShrink: 0,
                      }}
                    >
                      {visiblePanels.map(panel => (
                        <button
                          key={panel}
                          onClick={() => setActivePanel(panel)}
                          style={{
                            padding: "0 16px",
                            background: "transparent",
                            border: "none",
                            borderBottom: activePanel === panel ? "2px solid #f26522" : "2px solid transparent",
                            color: activePanel === panel ? "#e1e4e8" : "#8b949e",
                            fontSize: 12,
                            cursor: "pointer",
                            fontWeight: activePanel === panel ? 500 : 400,
                            textTransform: "capitalize",
                            fontFamily: "inherit",
                          }}
                        >
                          {panel}
                        </button>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button
                        style={{
                          padding: "0 12px",
                          background: "transparent",
                          border: "none",
                          color: "#484f58",
                          cursor: "pointer",
                          fontSize: 16,
                          fontFamily: "inherit",
                        }}
                        onClick={() => setPanelHeight(0)}
                      >
                        ×
                      </button>
                    </div>

                    {/* Panel content */}
                    <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
                      {activePanel === "console" && (
                        <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>
                          {CONSOLE_LINES.map((line, i) => (
                            <div
                              key={i}
                              style={{
                                color:
                                  line.type === "success"
                                    ? "#3fb950"
                                    : line.type === "error"
                                    ? "#f85149"
                                    : "#8b949e",
                                display: "flex",
                                gap: 8,
                              }}
                            >
                              <span style={{ color: "#484f58" }}>{String(i + 1).padStart(2, "0")}</span>
                              {line.text}
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 8, color: "#8b949e", alignItems: "center" }}>
                            <span style={{ color: "#484f58" }}>08</span>
                            <span style={{ color: "#f26522" }}>▸</span>
                            <span style={{ animation: "blink 1s step-end infinite", borderRight: "1px solid #e1e4e8" }}>&nbsp;</span>
                          </div>
                        </div>
                      )}

                      {activePanel === "shell" && (
                        <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>
                          <div style={{ color: "#8b949e" }}>
                            <span style={{ color: "#3fb950" }}>user@ai-os</span>
                            <span style={{ color: "#e1e4e8" }}>:</span>
                            <span style={{ color: "#58a6ff" }}>~/project</span>
                            <span style={{ color: "#e1e4e8" }}>$ </span>
                            <span>ls src/</span>
                          </div>
                          <div style={{ color: "#58a6ff" }}>index.ts  middleware/  routes/</div>
                          <div style={{ color: "#8b949e", marginTop: 4 }}>
                            <span style={{ color: "#3fb950" }}>user@ai-os</span>
                            <span style={{ color: "#e1e4e8" }}>:</span>
                            <span style={{ color: "#58a6ff" }}>~/project</span>
                            <span style={{ color: "#e1e4e8" }}>$ </span>
                            <span style={{ animation: "blink 1s step-end infinite", borderRight: "1px solid #e1e4e8" }}>&nbsp;</span>
                          </div>
                        </div>
                      )}

                      {activePanel === "webview" && (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ color: "#3fb950", fontSize: 24, marginBottom: 8 }}>◉</div>
                            <div style={{ color: "#e1e4e8", fontWeight: 500, marginBottom: 4 }}>Server running</div>
                            <div style={{ color: "#8b949e", fontSize: 12 }}>localhost:3000</div>
                            <div
                              style={{
                                marginTop: 12,
                                padding: "6px 16px",
                                background: "#1f6feb22",
                                border: "1px solid #1f6feb",
                                borderRadius: 6,
                                color: "#58a6ff",
                                fontSize: 12,
                                cursor: "pointer",
                                display: "inline-block",
                              }}
                            >
                              Open in browser
                            </div>
                          </div>
                        </div>
                      )}

                      {activePanel === "files" && (
                        <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>
                          {FILE_TREE.map((item, i) => (
                            <div
                              key={i}
                              style={{
                                paddingLeft: item.depth * 16,
                                color: item.type === "folder" ? "#e3b341" : "#8b949e",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span style={{ fontSize: 11 }}>
                                {item.type === "folder" ? (item.open ? "▾" : "▸") : "·"}
                              </span>
                              {item.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div
        style={{
          height: 52,
          background: "#161b22",
          borderTop: "1px solid #21262d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {(["tasks", "new", "account"] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 24px",
              background: activeTab === tab ? "#21262d" : "transparent",
              border: activeTab === tab ? "1px solid #30363d" : "1px solid transparent",
              borderRadius: 8,
              color: activeTab === tab ? "#e1e4e8" : "#8b949e",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: activeTab === tab ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s",
              minWidth: 80,
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 15 }}>
              {tab === "tasks" ? "☰" : tab === "new" ? "✦" : "○"}
            </span>
            <span style={{ textTransform: "capitalize" }}>{tab === "new" ? "Workspace" : tab}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
      `}</style>
    </div>
  );
}

function syntaxHighlight(line: string): string {
  const keywords = ["import", "from", "const", "let", "async", "await", "return", "if", "export", "default", "function"];
  let result = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  result = result.replace(/('.*?'|".*?")/g, '<span style="color:#a5d6ff">$1</span>');
  result = result.replace(/\/\/.*/g, '<span style="color:#8b949e">$&</span>');
  result = result.replace(/(\d+)/g, '<span style="color:#f2cc60">$1</span>');

  keywords.forEach(kw => {
    const re = new RegExp(`\\b(${kw})\\b`, "g");
    result = result.replace(re, '<span style="color:#ff7b72">$1</span>');
  });

  return result;
}
