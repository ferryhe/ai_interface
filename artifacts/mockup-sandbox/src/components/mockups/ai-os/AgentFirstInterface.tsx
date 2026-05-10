import { useMemo, useState, type ReactNode } from "react";
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
  Rocket,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";

type AppView = "agent" | "modules" | "progress" | "data" | "deploy";
type ModuleId = "web_listening" | "doc_to_md" | "md_to_rag" | "rag_to_agent";
type RunStatus = "running" | "waiting" | "succeeded" | "queued";

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

interface DataRecord {
  id: string;
  kind: string;
  title: string;
  moduleId: ModuleId;
  summary: string;
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
];

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
    title: "Generate deployable agent",
    detail: "Queued until the index passes validation.",
    status: "waiting",
    time: "Next",
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
  { id: "deploy", label: "Deploy", icon: <Rocket size={18} /> },
];

function statusLabel(status: RunStatus): string {
  if (status === "succeeded") return "Succeeded";
  if (status === "running") return "Running";
  if (status === "waiting") return "Waiting";
  return "Queued";
}

function statusClass(status: RunStatus): string {
  return `status-dot ${status}`;
}

function moduleById(moduleId: ModuleId): ModuleDefinition {
  return modules.find((item) => item.id === moduleId) ?? modules[0]!;
}

export function AgentFirstInterface() {
  const [activeView, setActiveView] = useState<AppView>("agent");
  const [selectedModuleId, setSelectedModuleId] = useState<ModuleId>("md_to_rag");
  const [command, setCommand] = useState("");
  const [planMode, setPlanMode] = useState(true);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [selectedRecordKind, setSelectedRecordKind] = useState("all");

  const selectedModule = moduleById(selectedModuleId);
  const filteredRecords = useMemo(
    () =>
      selectedRecordKind === "all"
        ? dataRecords
        : dataRecords.filter((record) => record.kind === selectedRecordKind),
    [selectedRecordKind],
  );

  function submitCommand(): void {
    const trimmed = command.trim();
    if (!trimmed) return;
    setQueuedPrompt(trimmed);
    setCommand("");
    setActiveView("progress");
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
              onOpenModules={() => setActiveView("modules")}
              onOpenData={() => setActiveView("data")}
            />
          )}
          {activeView === "modules" && (
            <ModulesView
              selectedModule={selectedModule}
              selectedModuleId={selectedModuleId}
              onSelectModule={setSelectedModuleId}
              onOpenData={() => setActiveView("data")}
            />
          )}
          {activeView === "progress" && (
            <ProgressView queuedPrompt={queuedPrompt} onOpenData={() => setActiveView("data")} />
          )}
          {activeView === "data" && (
            <DataView
              records={filteredRecords}
              selectedRecordKind={selectedRecordKind}
              onSelectRecordKind={setSelectedRecordKind}
            />
          )}
          {activeView === "deploy" && <DeployView />}
        </main>

        <Composer
          value={command}
          planMode={planMode}
          onChange={setCommand}
          onTogglePlanMode={() => setPlanMode((value) => !value)}
          onSubmit={submitCommand}
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
  onOpenModules,
  onOpenData,
}: {
  queuedPrompt: string | null;
  selectedModule: ModuleDefinition;
  onOpenModules: () => void;
  onOpenData: () => void;
}) {
  return (
    <section className="agent-layout">
      <div className="chat-panel">
        <div className="panel-heading">
          <span>
            <MessageSquareText size={16} />
            Agent
          </span>
          <span className="soft-label">Plan mode</span>
        </div>

        <div className="chat-stream">
          <ChatBubble role="user">
            Build an onboarding knowledge agent from the watched docs and keep every module result in the database.
          </ChatBubble>
          <ChatBubble role="agent">
            I will run the four-module chain and store snapshots, Markdown, chunks, and agent config records in Postgres.
          </ChatBubble>

          <RunCard
            title="Pipeline: docs to deployable agent"
            detail="web_listening -> doc_to_md -> md_to_rag -> rag_to_agent"
            status="running"
            actions={
              <>
                <button type="button" className="small-action" onClick={onOpenModules}>
                  View modules
                </button>
                <button type="button" className="small-action" onClick={onOpenData}>
                  View data
                </button>
              </>
            }
          />

          {queuedPrompt && (
            <ChatBubble role="user">
              {queuedPrompt}
            </ChatBubble>
          )}
        </div>
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

function ModulesView({
  selectedModule,
  selectedModuleId,
  onSelectModule,
  onOpenData,
}: {
  selectedModule: ModuleDefinition;
  selectedModuleId: ModuleId;
  onSelectModule: (moduleId: ModuleId) => void;
  onOpenData: () => void;
}) {
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
  onOpenData,
}: {
  queuedPrompt: string | null;
  onOpenData: () => void;
}) {
  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Pipeline progress</h1>
          <p>Every module run posts events and artifacts back into the shared database memory.</p>
        </div>
        <button type="button" className="primary-action" onClick={onOpenData}>
          <Database size={15} />
          Open memory
        </button>
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

      <div className="timeline">
        {runSteps.map((step) => (
          <article key={step.id} className="timeline-card">
            <span className={statusClass(step.status)}>{statusLabel(step.status)}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.detail}</p>
              <small>
                {step.time} / {step.moduleId}
              </small>
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

function DeployView() {
  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Publish agent</h1>
          <p>The final agent becomes available after the RAG index and validation records are stored.</p>
        </div>
        <button type="button" className="primary-action">
          <UploadCloud size={15} />
          Publish
        </button>
      </div>

      <div className="deploy-grid">
        <DeployStep label="RAG index" value="96 / 124 chunks" status="running" />
        <DeployStep label="Agent config" value="Draft ready" status="waiting" />
        <DeployStep label="Validation" value="Queued" status="queued" />
        <DeployStep label="Endpoint" value="Not published" status="waiting" />
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
}: {
  value: string;
  planMode: boolean;
  onChange: (value: string) => void;
  onTogglePlanMode: () => void;
  onSubmit: () => void;
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
            if (event.key === "Enter" && !event.shiftKey && !nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask Agent to run modules, store data, or inspect results..."
          rows={2}
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
          <button type="button" className="icon-action" aria-label="Agent settings">
            <Settings2 size={16} />
          </button>
          <button
            type="button"
            className="send-action"
            aria-label="Send"
            disabled={!value.trim()}
            onClick={onSubmit}
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

function DeployStep({
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
    <div className="deploy-step">
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
  .filter-chip {
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
  .panel-heading,
  .panel-heading span,
  .primary-action,
  .small-action,
  .queued-card,
  .deploy-step {
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
  .deploy-step,
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
  .deploy-grid {
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

  .deploy-grid {
    padding: 0;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .deploy-step {
    min-height: 126px;
    padding: 14px;
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .deploy-step span {
    color: #4f9cff;
  }

  .deploy-step em {
    color: #8d9bad;
    font-style: normal;
    font-size: 12px;
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
  textarea:focus-visible {
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

    .deploy-grid {
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

    .agent-summary-grid,
    .detail-grid,
    .deploy-grid,
    .memory-map {
      grid-template-columns: 1fr;
    }

    .timeline-card,
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
      height: 66px;
      border-top: 1px solid #1e2936;
      background: #0d1219;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
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
      font-size: 10px;
    }

    .mobile-nav-button.active {
      color: #edf3fb;
      background: #172130;
      border-color: #334258;
    }
  }
`;

export default AgentFirstInterface;
