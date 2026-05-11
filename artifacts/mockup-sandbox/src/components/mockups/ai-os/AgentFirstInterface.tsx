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
  Rocket,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";

type AppView = "agent" | "modules" | "progress" | "data" | "deploy" | "configure";
type ModuleId = "web_listening" | "doc_to_md" | "md_to_rag" | "rag_to_agent";
type RunStatus = "running" | "waiting" | "succeeded" | "queued";
type AgentProvider = "openai";
type AgentEndpoint = "responses" | "agents_sdk";
type AgentReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
type MemoryPromotionMode = "manual" | "agent_suggested";
type AgentConnectionStatus = "configured" | "missing_key" | "offline";
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

interface AgentConfigApiResponse {
  config: AgentConfigDraft;
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
    summary: "Turns validated RAG memory into a deployable agent configuration with prompts and tool bindings.",
    trigger: "Use when the knowledge base is ready and you want a publishable or testable agent.",
    action: "The Agent asks for prompts, tool definitions, validation checks, and final handoff state.",
    output: "Generated agent configs, prompts, tool bindings, and validation results appear before Deploy.",
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
  { id: "configure", label: "Configure", icon: <Settings2 size={18} /> },
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

export function AgentFirstInterface() {
  const [activeView, setActiveView] = useState<AppView>("agent");
  const [selectedModuleId, setSelectedModuleId] = useState<ModuleId>("md_to_rag");
  const [command, setCommand] = useState("");
  const [planMode, setPlanMode] = useState(true);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [selectedRecordKind, setSelectedRecordKind] = useState("all");
  const [agentConfig, setAgentConfig] = useState<AgentConfigDraft>(() =>
    toConfigDraft(defaultAgentConfig),
  );
  const [connectionStatus, setConnectionStatus] =
    useState<AgentConnectionStatus>("offline");
  const [configStatus, setConfigStatus] = useState("Local draft");
  const [isConfigBusy, setIsConfigBusy] = useState(false);

  const selectedModule = moduleById(selectedModuleId);
  const filteredRecords = useMemo(
    () =>
      selectedRecordKind === "all"
        ? dataRecords
        : dataRecords.filter((record) => record.kind === selectedRecordKind),
    [selectedRecordKind],
  );

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
        setConnectionStatus(data.connection.status);
        setConfigStatus("Loaded from API");
      } catch {
        if (cancelled) return;
        setConnectionStatus("offline");
        setConfigStatus("API offline - local draft");
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
          {activeView === "deploy" && <DeployView />}
        </main>

        <Composer
          value={command}
          planMode={planMode}
          onChange={setCommand}
          onTogglePlanMode={() => setPlanMode((value) => !value)}
          onSubmit={submitCommand}
          onOpenConfigure={() => setActiveView("configure")}
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
            <label>Provider</label>
            <div className="locked-value">OpenAI</div>
          </div>
          <div className="config-field">
            <label>Endpoint</label>
            <div className="segmented-control">
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
            <label>Model</label>
            <select
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
            <label>Reasoning</label>
            <div className="segmented-control">
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
            <label>System prompt</label>
            <textarea
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
            <label>Promotion</label>
            <select
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
              <label>Collection</label>
              <input
                value={config.memorySettings.ragCollection}
                onChange={(event) => onUpdateMemory({ ragCollection: event.target.value })}
              />
            </div>
            <div className="config-field">
              <label>Retention days</label>
              <input
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
            <label>Max tool steps</label>
            <input
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
  onOpenConfigure,
}: {
  value: string;
  planMode: boolean;
  onChange: (value: string) => void;
  onTogglePlanMode: () => void;
  onSubmit: () => void;
  onOpenConfigure: () => void;
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

  .config-field label {
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

    .deploy-grid {
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

    .agent-summary-grid,
    .detail-grid,
    .deploy-grid,
    .memory-map {
      grid-template-columns: 1fr;
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
