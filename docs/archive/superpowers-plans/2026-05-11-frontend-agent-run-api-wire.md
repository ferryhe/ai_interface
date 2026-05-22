# Frontend Agent Run API Wire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the admin Agent console submit flow to the existing `POST /api/agent-runs` runtime endpoint while keeping the mockup usable when `/api` is offline.

**Architecture:** This is a frontend-only PR. `AgentFirstInterface.tsx` should continue to render local fixture data by default, but when a user submits the composer it should POST the prompt and selected execution mode to `/api/agent-runs`, convert the response module runs into the existing runtime UI shape, and show API status/plan feedback in Agent and Progress views. No backend, generated API client, or sibling repository code changes are in scope.

**Tech Stack:** React + TypeScript in `artifacts/mockup-sandbox`, existing browser `fetch`, existing inline CSS, existing mockup sandbox validation commands.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-frontend-agent-run-api-wire.md`

Out of scope:

- No backend/API route changes.
- No OpenAPI or generated client changes.
- No real external adapter, CLI, process, or sibling repository calls from the frontend.
- No plaintext secrets.
- No end-user Portal changes.

## Data Contract

Add local frontend API response types inside `AgentFirstInterface.tsx`; do not import generated client types into the mockup:

```ts
type JsonObject = Record<string, unknown>;

interface AgentRunApiModuleRun {
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

interface AgentRunApiPlanStep {
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
}

interface AgentRunApiResponse {
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
  moduleRuns: AgentRunApiModuleRun[];
  plan: {
    summary: string;
    steps: AgentRunApiPlanStep[];
    warnings: string[];
  };
}
```

Add UI state:

```ts
type AgentRunSubmitState = "local" | "submitting" | "saved" | "offline" | "failed";

interface AgentRunUiState {
  response: AgentRunApiResponse;
  runtimeRuns: RuntimeModuleRun[];
}
```

## Task 1: API Submission State

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Rename fixture runtime runs**

Rename the existing `runtimeRuns` constant to `mockRuntimeRuns`.

- [x] **Step 2: Add API response types and helpers**

Add the local types from the Data Contract near the existing runtime types.

Add helpers:

```ts
function stringFromMetadata(
  metadata: JsonObject | null,
  key: string,
  fallback: string,
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

function stringArrayFromMetadata(
  metadata: JsonObject | null,
  key: string,
): string[] {
  const value = metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function runtimeStatusFromApiRun(run: AgentRunApiModuleRun): RuntimeRunStatus {
  if (run.status === "succeeded") return "succeeded";
  if (run.status === "running") return "running";
  if (run.status === "failed" || run.status === "cancelled") return "skipped";
  if (run.metadata?.["adapterExecutionStatus"] === "skipped") return "skipped";
  if (run.metadata?.["requiresApproval"] === true) return "approval_required";
  return "queued";
}

function toRuntimeRunsFromAgentRun(response: AgentRunApiResponse): RuntimeModuleRun[] {
  return response.moduleRuns.map((run) => ({
    id: run.id,
    moduleId: run.moduleId,
    title: run.title ?? moduleById(run.moduleId).name,
    status: runtimeStatusFromApiRun(run),
    adapterId: stringFromMetadata(run.metadata, "adapterId", `${run.moduleId}.adapter`),
    adapterKind:
      stringFromMetadata(run.metadata, "adapterKind", "http") === "cli"
        ? "cli"
        : "http",
    externalRunId: run.externalRunId,
    event: run.summary ?? stringFromMetadata(run.metadata, "action", "Agent runtime planned this module run."),
    resultRecordIds: run.outputJson ? [run.id] : [],
    missingRequiredEnv: stringArrayFromMetadata(run.metadata, "adapterMissingRequiredEnv"),
    updatedAt: new Date(run.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}
```

- [x] **Step 3: Add submit state**

Inside `AgentFirstInterface`, add:

```ts
const [agentRunState, setAgentRunState] =
  useState<AgentRunSubmitState>("local");
const [agentRunStatusText, setAgentRunStatusText] =
  useState("Local mock runtime");
const [latestAgentRun, setLatestAgentRun] =
  useState<AgentRunUiState | null>(null);
```

Derive display runs:

```ts
const displayedRuntimeRuns = latestAgentRun?.runtimeRuns ?? mockRuntimeRuns;
```

Use `displayedRuntimeRuns` everywhere the UI currently passes `runtimeRuns`.

## Task 2: Submit Composer To `/api/agent-runs`

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Make submit async**

Change `submitCommand` to `async function submitCommand(): Promise<void>`.

It should:

1. Trim and ignore empty input.
2. Set `queuedPrompt` and clear `command`.
3. Set `agentRunState` to `submitting`.
4. Switch to `progress`.
5. POST:

```ts
const response = await fetch("/api/agent-runs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: trimmed,
    executionMode,
    metadata: { source: "mockup-sandbox" },
  }),
});
```

6. On success:

```ts
const data = (await response.json()) as AgentRunApiResponse;
setLatestAgentRun({
  response: data,
  runtimeRuns: toRuntimeRunsFromAgentRun(data),
});
setConnectionStatus(data.connection.status);
setAgentRunState("saved");
setAgentRunStatusText(`Saved run ${data.pipelineRun.id.slice(0, 8)}`);
```

7. On failure/offline:

```ts
setLatestAgentRun(null);
setAgentRunState(responseFailedBecauseApiWasUnavailable ? "offline" : "failed");
setAgentRunStatusText(responseFailedBecauseApiWasUnavailable ? "API offline - showing local mock" : "Agent run API failed - showing local mock");
setConnectionStatus(responseFailedBecauseApiWasUnavailable ? "offline" : connectionStatus);
```

Use simple `try/catch`; a thrown fetch or failed JSON parse is `offline`, an HTTP non-OK response is `failed`.

- [x] **Step 2: Update Composer contract**

Add `isSubmitting: boolean` to `Composer` props. Disable textarea and send button while submitting. Keep Enter-to-send disabled while submitting:

```ts
if (!isSubmitting && event.key === "Enter" && !event.shiftKey && !nativeEvent.isComposing) {
  event.preventDefault();
  void onSubmit();
}
```

Change `onSubmit` prop type to `() => void | Promise<void>` and call it with `void onSubmit()` from buttons/keyboard.

## Task 3: Surface API Runtime Feedback

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Pass API state into Agent and Progress**

Pass these props to both `AgentView` and `ProgressView`:

```ts
agentRunState={agentRunState}
agentRunStatusText={agentRunStatusText}
latestAgentRun={latestAgentRun}
```

- [x] **Step 2: Agent view status pill and API summary**

In `AgentView`, show a compact status pill near the runtime label:

- `local`: `Local mock`
- `submitting`: `Submitting`
- `saved`: `API saved`
- `offline`: `API offline`
- `failed`: `API failed`

If `latestAgentRun` exists, render one agent chat bubble with `latestAgentRun.response.agentMessage.content`.

- [x] **Step 3: Progress view plan summary**

In `ProgressView`, if `latestAgentRun` exists, render a small panel above the timeline:

- `Pipeline {latestAgentRun.response.pipelineRun.id.slice(0, 8)}`
- `latestAgentRun.response.plan.summary`
- warnings as chips when present
- plan step count
- runtime status from `latestAgentRun.response.status`

If no API run exists, keep the existing queued/local runtime display.

- [x] **Step 4: CSS**

Add CSS for:

- `.agent-run-state`
- `.agent-run-state.local`
- `.agent-run-state.submitting`
- `.agent-run-state.saved`
- `.agent-run-state.offline`
- `.agent-run-state.failed`
- `.api-plan-panel`
- `.api-plan-meta`
- `.warning-chip-row`

Keep mobile wrapping stable and avoid nested cards.

## Task 4: Status File And Validation

**Files:**

- Modify: `.hermes/project-status.md`

- [x] **Step 1: Update active work**

Set active branch to `codex/frontend-agent-run-api-wire` and scope to frontend Agent Run API wire-up.

- [x] **Step 2: Add current state note**

Add that PR #13 was merged and the admin Agent composer now attempts `POST /api/agent-runs`, rendering API plan/module-run data when available and local mock data when offline.

- [x] **Step 3: Run validation**

Required commands:

```bash
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

- [x] **Step 4: Browser smoke**

Open `http://127.0.0.1:8081/preview/ai-os/AgentFirstInterface?adminToken=admin-demo-token`.

Verify:

- Composer submit does not crash when `/api/agent-runs` is offline.
- Progress view shows `API offline - showing local mock` or an API saved state if the backend is available.
- Agent view still shows runtime mode controls.
- Progress timeline and Modules runtime contract still render.
- Browser console has no warnings/errors.

## Review Checklist

- No backend or generated files changed.
- API failure keeps the UI usable.
- `executionMode` is included in the request body.
- `latestAgentRun` data replaces only runtime display data; local fixtures remain fallback.
- Submit button and Enter key do not double-submit while request is in flight.
- Status text is visible but compact on mobile.
