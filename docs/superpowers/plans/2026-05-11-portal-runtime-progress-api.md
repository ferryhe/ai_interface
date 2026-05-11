# Portal Runtime Progress API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the end-user Agent Portal to the existing Agent Run API so published users can see API-backed chat progress, step state, data, sources, and result readiness while keeping the Portal usable when `/api` is offline.

**Architecture:** This is a frontend-only continuation of the admin runtime wire-up. `AgentPortalInterface.tsx` keeps its local demo fixtures as the fallback, and the chat composer attempts `POST /api/agent-runs` with `executionMode: "execute_ready"`; successful responses are mapped into Portal-specific step, message, data, source, and readiness UI shapes. No backend routes, OpenAPI generation, real external tool calls, secrets, or sibling repository reads are in scope.

**Tech Stack:** React + TypeScript in `artifacts/mockup-sandbox`, browser `fetch`, existing inline CSS, existing mockup sandbox typecheck/build/browser-smoke workflow.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-portal-runtime-progress-api.md`

Out of scope:

- No backend/API/server changes.
- No OpenAPI or generated API client changes.
- No real external adapter, CLI, process, HTTP service, or sibling repository calls from the frontend.
- No plaintext key entry or secret persistence.
- No admin-console behavior changes except what naturally remains linked from Portal.
- No feedback/resume form implementation in Portal; this PR is read/visibility plus chat submit only.

## Local Data Contract

Add local types inside `AgentPortalInterface.tsx`; do not import generated API clients into the mockup:

```ts
type JsonObject = Record<string, unknown>;
type AgentConnectionStatus = "configured" | "missing_key" | "offline";
type PortalRunSubmitState = "local" | "submitting" | "saved" | "offline" | "failed";

interface PortalAgentRunApiModuleRun {
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

interface PortalAgentRunApiPlanStep {
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
}

interface PortalAgentRunApiResponse {
  status: "planned" | "missing_key" | "needs_approval" | "failed";
  connection: { status: AgentConnectionStatus };
  agentMessage: { content: string };
  pipelineRun: {
    id: string;
    title: string;
    status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
    metadata: JsonObject | null;
    updatedAt: string;
  };
  moduleRuns: PortalAgentRunApiModuleRun[];
  plan: {
    summary: string;
    steps: PortalAgentRunApiPlanStep[];
    warnings: string[];
  };
}

interface PortalRunUiState {
  response: PortalAgentRunApiResponse;
  steps: PortalStep[];
  messages: PortalMessage[];
  dataRecords: PortalDataRecord[];
  sources: PortalSource[];
  readiness: ReadonlyArray<readonly [string, string]>;
}
```

Extend `PortalStatus` to include `"blocked"` so failed/cancelled module runs are visually distinct:

```ts
type PortalStatus = "complete" | "running" | "waiting" | "blocked";
```

## Mapping Rules

Use stable Portal labels for module IDs:

```ts
const modulePortalLabels: Record<ModuleId, { id: string; label: string; fallbackSummary: string; fallbackData: string }> = {
  web_listening: {
    id: "listen",
    label: "Listen",
    fallbackSummary: "Watched source URLs and captured changed pages.",
    fallbackData: "snapshots",
  },
  doc_to_md: {
    id: "convert",
    label: "Convert",
    fallbackSummary: "Converted source material into clean Markdown records.",
    fallbackData: "markdown docs",
  },
  md_to_rag: {
    id: "index",
    label: "Index",
    fallbackSummary: "Chunking Markdown and preparing retrieval metadata.",
    fallbackData: "chunks",
  },
  rag_to_agent: {
    id: "generate",
    label: "Generate Agent",
    fallbackSummary: "Generating and validating the agent handoff.",
    fallbackData: "agent config",
  },
};
```

Status mapping:

- `succeeded` -> `complete`
- `running` -> `running`
- `pending` -> `waiting`
- `failed` or `cancelled` -> `blocked`
- `metadata.requiresApproval === true` should keep a non-terminal pending run as `waiting` and summarize that approval is needed.
- `metadata.adapterExecutionStatus === "skipped"` should keep the run as `waiting` and summarize that adapter configuration is needed.

## Task 1: API Response State And Mappers

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add local API types**

Add the types from "Local Data Contract" near the existing Portal types. Do not import generated client code.

- [ ] **Step 2: Add module label metadata and helpers**

Add `modulePortalLabels` near the fixture arrays. Add helpers:

```ts
function portalRunStateLabel(state: PortalRunSubmitState): string {
  if (state === "submitting") return "Submitting";
  if (state === "saved") return "API saved";
  if (state === "offline") return "API offline";
  if (state === "failed") return "API failed";
  return "Local demo";
}

function metadataString(metadata: JsonObject | null, key: string, fallback: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

function shortRunId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
```

- [ ] **Step 3: Map API module run status to Portal status**

Add:

```ts
function portalStatusFromApiRun(run: PortalAgentRunApiModuleRun): PortalStatus {
  if (run.status === "succeeded") return "complete";
  if (run.status === "running") return "running";
  if (run.status === "failed" || run.status === "cancelled") return "blocked";
  return "waiting";
}
```

Update `statusIcon` and `statusText` so `blocked` uses `Clock3` or an existing warning-style icon and returns `"Blocked"`.

- [ ] **Step 4: Convert API response to Portal UI state**

Add:

```ts
function toPortalStepFromApiRun(run: PortalAgentRunApiModuleRun): PortalStep {
  const label = modulePortalLabels[run.moduleId];
  const requiresApproval = run.metadata?.["requiresApproval"] === true;
  const wasSkipped = run.metadata?.["adapterExecutionStatus"] === "skipped";
  const summary =
    run.summary ??
    metadataString(
      run.metadata,
      "action",
      requiresApproval
        ? `${label.label} needs approval before it can continue.`
        : wasSkipped
          ? `${label.label} needs adapter configuration before it can run.`
          : label.fallbackSummary,
    );

  return {
    id: label.id,
    moduleId: run.moduleId,
    label: label.label,
    adminModule: run.moduleId,
    status: portalStatusFromApiRun(run),
    summary,
    dataCount: run.outputJson ? `API result ${shortRunId(run.id)}` : label.fallbackData,
    updatedAt: new Date(run.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function toPortalUiState(response: PortalAgentRunApiResponse): PortalRunUiState {
  const steps = response.moduleRuns.map(toPortalStepFromApiRun);
  const messages: PortalMessage[] = [
    ...portalMessages,
    {
      id: `api-${response.pipelineRun.id}`,
      speaker: "agent",
      text: response.agentMessage.content,
      meta: `API run ${shortRunId(response.pipelineRun.id)}`,
    },
  ];
  const dataRecords: PortalDataRecord[] = response.moduleRuns.map((run) => {
    const step = modulePortalLabels[run.moduleId];
    return {
      id: `api-data-${run.id}`,
      kind: run.outputJson ? "API result" : "Module run",
      title: run.title ?? step.label,
      step: step.label,
      detail: run.summary ?? metadataString(run.metadata, "action", step.fallbackSummary),
      updatedAt: new Date(run.updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });
  const sources: PortalSource[] = response.moduleRuns.map((run) => {
    const step = modulePortalLabels[run.moduleId];
    return {
      id: `api-source-${run.id}`,
      label: run.externalRunId,
      type: run.moduleId,
      step: step.label,
      freshness: `Updated ${new Date(run.updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      summary: run.summary ?? metadataString(run.metadata, "action", step.fallbackSummary),
    };
  });
  const completedCount = steps.filter((step) => step.status === "complete").length;
  const readiness = [
    ["Pipeline", response.pipelineRun.status],
    ["Connection", response.connection.status],
    ["Completed steps", `${completedCount} / ${steps.length}`],
    ["Agent status", response.status.replace("_", " ")],
  ] as const;
  return { response, steps, messages, dataRecords, sources, readiness };
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck`

Expected: PASS.

## Task 2: Portal Chat Submit And Derived Views

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add Portal run state**

Inside `AgentPortalInterface`, add:

```ts
const [portalRunState, setPortalRunState] = useState<PortalRunSubmitState>("local");
const [portalRunStatusText, setPortalRunStatusText] = useState("Local demo runtime");
const [latestPortalRun, setLatestPortalRun] = useState<PortalRunUiState | null>(null);
```

Derive:

```ts
const displayedSteps = latestPortalRun?.steps ?? portalSteps;
const displayedMessages = latestPortalRun?.messages ?? portalMessages;
const displayedDataRecords = latestPortalRun?.dataRecords ?? dataRecords;
const displayedSources = latestPortalRun?.sources ?? portalSources;
const displayedReadiness = latestPortalRun?.readiness ?? readiness;
```

Update `activeStepRecord` and `filteredData` to use `displayedSteps` and `displayedDataRecords`.

- [ ] **Step 2: Add `submitPortalPrompt`**

Add:

```ts
async function submitPortalPrompt(): Promise<void> {
  if (portalRunState === "submitting") return;
  const prompt = draft.trim();
  if (!prompt) return;

  setDraft("");
  setPortalRunState("submitting");
  setPortalRunStatusText("Submitting to Agent Run API");
  setActiveView("steps");

  try {
    const response = await fetch("/api/agent-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        executionMode: "execute_ready",
        metadata: { source: "agent-portal" },
      }),
    });

    if (!response.ok) {
      setLatestPortalRun(null);
      setPortalRunState("failed");
      setPortalRunStatusText("Agent Run API failed - showing local demo");
      return;
    }

    const data = (await response.json()) as PortalAgentRunApiResponse;
    const uiState = toPortalUiState(data);
    setLatestPortalRun(uiState);
    setActiveStep(uiState.steps[0]?.label ?? portalSteps[0]!.label);
    setPortalRunState("saved");
    setPortalRunStatusText(`Saved run ${shortRunId(data.pipelineRun.id)}`);
  } catch {
    setLatestPortalRun(null);
    setPortalRunState("offline");
    setPortalRunStatusText("API offline - showing local demo");
  }
}
```

- [ ] **Step 3: Pass derived data into child views**

Update child component props:

- `ChatView` receives `messages`, `runState`, `runStatusText`, `onSubmit`.
- `StepsView` receives `steps`, `latestPortalRun`, and `runStatusText`.
- `DataView` receives `steps`.
- `SourcesView` receives `sources`.
- `ResultView` receives `readiness`, `latestPortalRun`, and `runStatusText`.

Every child view should render props instead of the original module-level fixture arrays.

- [ ] **Step 4: Wire Send button**

In `ChatView`, use:

```tsx
<button
  type="button"
  disabled={!draft.trim() || runState === "submitting"}
  onClick={onSubmit}
>
```

Add a compact status row near the composer that displays `portalRunStateLabel(runState)` and `runStatusText`.

- [ ] **Step 5: Verify TypeScript**

Run: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck`

Expected: PASS.

## Task 3: Runtime Visibility Polish

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add API status in the topbar and context rail**

Render a second topbar pill:

```tsx
<div className={`portal-run-pill ${portalRunState}`}>
  <Radio size={15} />
  {portalRunStateLabel(portalRunState)}
</div>
```

In the context rail, compute visible data from `displayedDataRecords.length` and show `portalRunStatusText` instead of hard-coded copy.

- [ ] **Step 2: Add API plan summary to Steps**

In `StepsView`, when `latestPortalRun` exists, render:

```tsx
<div className="portal-api-plan-panel">
  <strong>Pipeline {shortRunId(latestPortalRun.response.pipelineRun.id)}</strong>
  <p>{latestPortalRun.response.plan.summary}</p>
  {latestPortalRun.response.plan.warnings.length > 0 && (
    <div className="portal-warning-row" aria-label="Agent plan warnings">
      {latestPortalRun.response.plan.warnings.map((warning) => (
        <span key={warning}>{warning}</span>
      ))}
    </div>
  )}
</div>
```

If no API run exists, render `runStatusText` in the same area.

- [ ] **Step 3: Add blocked/offline CSS**

Add CSS for:

```css
.portal-status-badge.blocked { ... }
.portal-run-pill { ... }
.portal-run-pill.saved { ... }
.portal-run-pill.offline,
.portal-run-pill.failed { ... }
.portal-run-pill.submitting { ... }
.portal-api-plan-panel { ... }
.portal-warning-row { ... }
```

Use existing Portal colors and 8px-or-less radii for panels. Keep responsive layout stable on mobile.

- [ ] **Step 4: Verify build**

Run:

```powershell
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
```

Expected: PASS.

## Task 4: Status, Browser Smoke, Commit, PR

**Files:**

- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Update project status**

Record:

- PR #15 was merged.
- Branch `codex/portal-runtime-progress-api` is the next frontend Portal runtime slice.
- Portal composer now attempts `POST /api/agent-runs` and maps returned runs into frontstage Chat, Steps, Data, Sources, Result, and context rail.
- Fallback behavior remains local demo when `/api` is offline or fails.

- [ ] **Step 2: Run diff check**

Run: `git diff --check`

Expected: PASS, ignoring any pre-existing CRLF warnings already known in this repository.

- [ ] **Step 3: Browser smoke**

Open the in-app browser at:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Verify:

- Chat renders.
- Send with a draft and no backend API keeps the Portal usable and shows an API offline or failed status.
- Steps, Data, Sources, and Result render after the submit.
- Admin token gate still opens without navigating unless a token is submitted.
- Browser console has no warnings or errors from this Portal flow.

- [ ] **Step 4: Commit and PR**

After required checks pass:

```powershell
git status --short
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-runtime-progress-api.md .hermes/project-status.md
git commit -m "Wire Portal runtime progress API"
git push -u origin codex/portal-runtime-progress-api
```

Open a PR titled `Wire Portal runtime progress API`.

## Self-Review Checklist

- Spec coverage: the Portal can submit to Agent Run API, display API-backed step/message/data/source/result state, and gracefully fall back when offline.
- Scope coverage: only Portal mockup, status doc, and this plan file change.
- Safety: no secrets, no sibling repo reads, no external tool execution, no backend route changes.
- UI: mobile nav and context layout remain stable; no visible explanations crowding primary controls.
- Verification: typecheck, build, diff check, and browser smoke are required before commit/PR.
