import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type PortalView = "chat" | "steps" | "data" | "sources" | "result";
type PortalStatus = "complete" | "running" | "waiting";
type ModuleId = "web_listening" | "doc_to_md" | "md_to_rag" | "rag_to_agent";

interface PortalStep {
  id: string;
  moduleId: ModuleId;
  label: string;
  adminModule: string;
  status: PortalStatus;
  summary: string;
  dataCount: string;
  updatedAt: string;
}

interface PortalDataRecord {
  id: string;
  kind: string;
  title: string;
  step: string;
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
}

interface PortalMessage {
  id: string;
  speaker: "user" | "agent";
  text: string;
  meta: string;
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
    detail: "Captured text and change metadata from the watched documentation URL.",
    updatedAt: "2 min ago",
  },
  {
    id: "d2",
    kind: "Markdown",
    title: "Onboarding guide.md",
    step: "Convert",
    detail: "Converted source document into Markdown with 2 conversion warnings.",
    updatedAt: "1 min ago",
  },
  {
    id: "d3",
    kind: "Chunk",
    title: "Authentication setup chunk",
    step: "Index",
    detail: "843 tokens with embedding metadata prepared for the RAG collection.",
    updatedAt: "running",
  },
  {
    id: "d4",
    kind: "Agent config",
    title: "Support agent draft",
    step: "Generate Agent",
    detail: "Prompt and tool plan waiting for index validation before publishing.",
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
    summary: "Primary onboarding page used to detect copy and setup flow changes.",
  },
  {
    id: "s2",
    label: "Onboarding Guide export",
    type: "Source document",
    step: "Convert",
    freshness: "Converted 1 min ago",
    summary: "Original user guide converted into Markdown before chunking.",
  },
  {
    id: "s3",
    label: "RAG collection onboarding-v1",
    type: "Memory record",
    step: "Index",
    freshness: "96 chunks indexed",
    summary: "Retrieval memory that will power the published Agent answers.",
  },
];

const readiness = [
  ["RAG index", "Running"],
  ["Validation", "Queued"],
  ["Published URL", "Locked until validation"],
  ["Agent version", "draft-0.3"],
] as const;

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
  return new URLSearchParams(window.location.search).get("adminToken")?.trim() ?? "";
}

function previewUrl(componentPath: string, search = ""): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${basePath}/preview/${componentPath}${search}`;
}

function statusIcon(status: PortalStatus): ReactNode {
  if (status === "complete") return <CheckCircle2 size={16} />;
  if (status === "running") return <Radio size={16} />;
  return <Clock3 size={16} />;
}

function statusText(status: PortalStatus): string {
  if (status === "complete") return "Complete";
  if (status === "running") return "Running";
  return "Waiting";
}

export function AgentPortalInterface() {
  const initialToken = readInitialDemoToken();
  const initialAdminToken = readInitialDemoAdminToken();
  const [token, setToken] = useState(initialToken);
  const [isUnlocked, setIsUnlocked] = useState(initialToken.length >= 6);
  const [adminToken, setAdminToken] = useState(initialAdminToken);
  const [isAdminGateOpen, setIsAdminGateOpen] = useState(false);
  const [activeView, setActiveView] = useState<PortalView>("chat");
  const [activeStep, setActiveStep] = useState(portalSteps[2].label);
  const [draft, setDraft] = useState("");

  const activeStepRecord = useMemo(
    () => portalSteps.find((step) => step.label === activeStep) ?? portalSteps[2],
    [activeStep],
  );

  const filteredData = useMemo(
    () => dataRecords.filter((record) => record.step === activeStep),
    [activeStep],
  );

  function submitToken(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (token.trim().length >= 6) {
      setIsUnlocked(true);
    }
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
        previewUrl("ai-os/AgentFirstInterface", `?adminToken=${encodeURIComponent(cleanToken)}`),
      );
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
          <button type="submit" disabled={token.trim().length < 6}>
            <ShieldCheck size={16} />
            Enter Portal
          </button>
          <em>Demo preview only. Production access should use server-side auth, not query tokens.</em>
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
                Demo token active
              </div>
            </div>
          </header>

          {activeView === "chat" && (
            <ChatView
              draft={draft}
              onDraftChange={setDraft}
              onOpenView={setActiveView}
            />
          )}
          {activeView === "steps" && (
            <StepsView
              activeStep={activeStep}
              onSelectStep={setActiveStep}
            />
          )}
          {activeView === "data" && (
            <DataView
              activeStep={activeStep}
              records={filteredData.length > 0 ? filteredData : dataRecords}
              onSelectStep={setActiveStep}
            />
          )}
          {activeView === "sources" && <SourcesView />}
          {activeView === "result" && <ResultView />}
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
          </div>
          <div className="portal-context-block">
            <span className="portal-kicker">Pipeline</span>
            <div className="portal-mini-steps">
              {portalSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className={step.label === activeStep ? "active" : ""}
                  onClick={() => {
                    setActiveStep(step.label);
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
            <strong>28 records</strong>
            <p>Snapshots, Markdown, chunks, sources, and draft agent output are visible through this demo token.</p>
          </div>
        </aside>
      </main>

      {isAdminGateOpen && (
        <div className="portal-admin-gate" role="dialog" aria-modal="true" aria-labelledby="portal-admin-title">
          <form className="portal-admin-panel" onSubmit={submitAdminToken}>
            <div className="portal-token-mark">
              <Settings2 size={22} />
            </div>
            <span className="portal-kicker">Admin access</span>
            <h2 id="portal-admin-title">Enter admin token</h2>
            <p>Admin Console is for operators. Submit an admin token to continue, or return to the Portal.</p>
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
              <button type="button" className="secondary" onClick={() => setIsAdminGateOpen(false)}>
                Back to Portal
              </button>
              <button type="submit">
                <ShieldCheck size={16} />
                Enter Admin
              </button>
            </div>
            <em>Demo preview only. No token keeps you in the frontstage Portal.</em>
          </form>
        </div>
      )}
    </div>
  );
}

function ChatView({
  draft,
  onDraftChange,
  onOpenView,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onOpenView: (view: PortalView) => void;
}) {
  return (
    <section className="portal-view portal-chat-view" aria-label="Agent chat">
      <div className="portal-message-list">
        {portalMessages.map((message) => (
          <article
            key={message.id}
            className={message.speaker === "user" ? "portal-message user" : "portal-message agent"}
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
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Ask this published agent..."
          rows={3}
        />
        <button type="button" disabled={!draft.trim()}>
          <Send size={16} />
          Send
        </button>
      </div>
    </section>
  );
}

function StepsView({
  activeStep,
  onSelectStep,
}: {
  activeStep: string;
  onSelectStep: (step: string) => void;
}) {
  return (
    <section className="portal-view" aria-label="Pipeline steps">
      <div className="portal-section-heading">
        <span className="portal-kicker">Transparent run</span>
        <h2>Steps</h2>
      </div>
      <div className="portal-step-grid">
        {portalSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={step.label === activeStep ? "portal-step-card active" : "portal-step-card"}
            onClick={() => onSelectStep(step.label)}
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
        ))}
      </div>
    </section>
  );
}

function DataView({
  activeStep,
  records,
  onSelectStep,
}: {
  activeStep: string;
  records: PortalDataRecord[];
  onSelectStep: (step: string) => void;
}) {
  return (
    <section className="portal-view" aria-label="Portal data">
      <div className="portal-section-heading">
        <span className="portal-kicker">Database records</span>
        <h2>Data</h2>
      </div>
      <div className="portal-filter-row" aria-label="Data filters">
        {portalSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={step.label === activeStep ? "active" : ""}
            onClick={() => onSelectStep(step.label)}
          >
            {step.label}
          </button>
        ))}
      </div>
      <div className="portal-record-list">
        {records.map((record) => (
          <article key={record.id} className="portal-record-row">
            <span>{record.kind}</span>
            <strong>{record.title}</strong>
            <p>{record.detail}</p>
            <em>{record.step} · {record.updatedAt}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function SourcesView() {
  return (
    <section className="portal-view" aria-label="Portal sources">
      <div className="portal-section-heading">
        <span className="portal-kicker">Evidence</span>
        <h2>Sources</h2>
      </div>
      <div className="portal-source-grid">
        {portalSources.map((source) => (
          <article key={source.id} className="portal-source-card">
            <div>
              <Link2 size={16} />
              <span>{source.type}</span>
            </div>
            <strong>{source.label}</strong>
            <p>{source.summary}</p>
            <em>{source.step} · {source.freshness}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultView() {
  return (
    <section className="portal-view" aria-label="Portal result">
      <div className="portal-section-heading">
        <span className="portal-kicker">Final output</span>
        <h2>Result</h2>
      </div>
      <div className="portal-result-panel">
        <div className="portal-result-summary">
          <FileText size={22} />
          <span>Draft agent output</span>
          <h3>Onboarding Knowledge Agent</h3>
          <p>The final public URL stays locked until the RAG index and validation checks complete.</p>
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
    </section>
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
  .portal-record-row p,
  .portal-source-card p,
  .portal-result-summary p {
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
  .portal-step-card,
  .portal-filter-row button {
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

  .portal-step-card,
  .portal-record-row,
  .portal-source-card,
  .portal-result-panel,
  .portal-context-block {
    border: 1px solid #263445;
    border-radius: 8px;
    background: #101721;
  }

  .portal-step-card {
    min-height: 190px;
    cursor: pointer;
    color: #edf3fb;
    display: grid;
    align-content: start;
    gap: 9px;
    padding: 13px;
    text-align: left;
  }

  .portal-step-card.active {
    border-color: #4f9cff;
    background: #122033;
  }

  .portal-step-card strong {
    font-size: 17px;
  }

  .portal-step-card em,
  .portal-step-card b,
  .portal-record-row em,
  .portal-source-card em,
  .portal-readiness-grid em {
    color: #8d9bad;
    font-size: 12px;
    font-style: normal;
    font-weight: 650;
  }

  .portal-step-card b {
    color: #edf3fb;
  }

  .portal-record-row {
    display: grid;
    gap: 7px;
    padding: 13px;
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

  .portal-source-card div {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #67b7ff;
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
    .portal-readiness-grid {
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
