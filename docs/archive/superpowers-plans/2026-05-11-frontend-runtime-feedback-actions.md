# Frontend Runtime Feedback Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin Agent console recognize API-provided module interactions and call the existing resume endpoint for resume-ready runs.

**Architecture:** This is a frontend-only continuation of PR #14. The UI keeps local mock fallback data, but when `/api/agent-runs` returns module run metadata with `interaction`, it should render the interaction state in Progress and Modules, and `Resume` should call `POST /api/module-runs/{runId}/resume`. Waiting/approval/data-request interactions remain visible and route the user to the module detail; this PR does not implement feedback submission forms.

**Tech Stack:** React + TypeScript in `artifacts/mockup-sandbox`, existing browser `fetch`, existing inline CSS, existing mockup sandbox validation commands.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-frontend-runtime-feedback-actions.md`

Out of scope:

- No backend/API route changes.
- No OpenAPI or generated client changes.
- No real external adapter, CLI, process, or sibling repository calls from the frontend.
- No plaintext secrets.
- No feedback form for `POST /api/module-runs/{runId}/feedback`; this PR only wires resume.
- No end-user Portal changes.

## Data Contract

Extend local frontend types in `AgentFirstInterface.tsx`.

Add:

```ts
type ToolInteractionApiStatus =
  | "waiting_for_user"
  | "waiting_for_approval"
  | "waiting_for_data"
  | "blocked"
  | "resumable"
  | "resumed";

type RuntimeActionState = "idle" | "submitting" | "succeeded" | "failed";

interface ToolInteractionApi {
  interactionId: string;
  status: ToolInteractionApiStatus;
  kind: "question" | "approval" | "data_request" | "blocked";
  title: string;
  message: string;
  prompt: string | null;
  resumeHandle: string | null;
  requestedAt: string;
  metadata: JsonObject;
}

interface ToolInteractionApiResponse {
  run: AgentRunApiModuleRun;
  interaction: ToolInteractionApi;
}
```

Extend `RuntimeRunStatus` with:

```ts
| "waiting_for_user"
| "waiting_for_data"
| "blocked";
```

Extend `RuntimeModuleRun.interaction.status` to:

```ts
"waiting" | "resumable" | "resumed" | "blocked";
```

## Task 1: Parse API Interaction Metadata

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Add local interaction types**

Add the `ToolInteractionApiStatus`, `RuntimeActionState`, `ToolInteractionApi`, and `ToolInteractionApiResponse` types from the Data Contract near the existing Agent Run API types.

- [x] **Step 2: Add interaction parser**

Add these helpers near `stringArrayFromMetadata`:

```ts
function isInteractionKind(value: unknown): value is ToolInteractionApi["kind"] {
  return (
    value === "question" ||
    value === "approval" ||
    value === "data_request" ||
    value === "blocked"
  );
}

function isInteractionStatus(value: unknown): value is ToolInteractionApiStatus {
  return (
    value === "waiting_for_user" ||
    value === "waiting_for_approval" ||
    value === "waiting_for_data" ||
    value === "blocked" ||
    value === "resumable" ||
    value === "resumed"
  );
}

function parseToolInteraction(metadata: JsonObject | null): ToolInteractionApi | null {
  const value = metadata?.["interaction"];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const interaction = value as JsonObject;
  if (
    typeof interaction["interactionId"] !== "string" ||
    !isInteractionStatus(interaction["status"]) ||
    !isInteractionKind(interaction["kind"]) ||
    typeof interaction["title"] !== "string" ||
    typeof interaction["message"] !== "string" ||
    typeof interaction["requestedAt"] !== "string"
  ) {
    return null;
  }

  return {
    interactionId: interaction["interactionId"],
    status: interaction["status"],
    kind: interaction["kind"],
    title: interaction["title"],
    message: interaction["message"],
    prompt: typeof interaction["prompt"] === "string" ? interaction["prompt"] : null,
    resumeHandle:
      typeof interaction["resumeHandle"] === "string"
        ? interaction["resumeHandle"]
        : null,
    requestedAt: interaction["requestedAt"],
    metadata:
      interaction["metadata"] &&
      typeof interaction["metadata"] === "object" &&
      !Array.isArray(interaction["metadata"])
        ? (interaction["metadata"] as JsonObject)
        : {},
  };
}
```

- [x] **Step 3: Map interaction status into runtime status**

Change `runtimeStatusFromApiRun` to parse interaction first:

```ts
const interaction = parseToolInteraction(run.metadata);
if (interaction?.status === "resumable") return "resumable";
if (interaction?.status === "resumed") return "running";
if (interaction?.status === "waiting_for_approval") return "approval_required";
if (interaction?.status === "waiting_for_data") return "waiting_for_data";
if (interaction?.status === "waiting_for_user") return "waiting_for_user";
if (interaction?.status === "blocked") return "blocked";
```

Keep the existing non-interaction status mapping after this block.

- [x] **Step 4: Map interaction into `RuntimeModuleRun`**

In `toRuntimeRunsFromAgentRun`, parse the interaction for each run and include:

```ts
interaction: interaction
  ? {
      kind: interaction.kind,
      title: interaction.title,
      message: interaction.message,
      resumeHandle: interaction.resumeHandle ?? `${run.externalRunId}:resume`,
      status:
        interaction.status === "resumable"
          ? "resumable"
          : interaction.status === "resumed"
            ? "resumed"
            : interaction.status === "blocked"
              ? "blocked"
              : "waiting",
    }
  : undefined,
```

Use a helper `toRuntimeRunFromApiModuleRun(run: AgentRunApiModuleRun): RuntimeModuleRun` so both Agent Run response mapping and resume response mapping can reuse it.

## Task 2: Resume API Action

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Add runtime action state**

Inside `AgentFirstInterface`, add:

```ts
const [runtimeActionStates, setRuntimeActionStates] =
  useState<Record<string, RuntimeActionState>>({});
const [runtimeActionStatusText, setRuntimeActionStatusText] =
  useState("Runtime actions are local until API run data is available");
```

Add helper:

```ts
function updateRuntimeRun(updatedRun: RuntimeModuleRun): void {
  setLatestAgentRun((current) =>
    current
      ? {
          ...current,
          runtimeRuns: current.runtimeRuns.map((run) =>
            run.id === updatedRun.id ? updatedRun : run,
          ),
        }
      : current,
  );
}
```

- [x] **Step 2: Add resume handler**

Add:

```ts
async function resumeRuntimeRun(run: RuntimeModuleRun): Promise<void> {
  if (!latestAgentRun) {
    openModules(run.moduleId);
    return;
  }
  setRuntimeActionStates((current) => ({ ...current, [run.id]: "submitting" }));
  setRuntimeActionStatusText(`Resuming ${run.moduleId}`);
  try {
    const response = await fetch(`/api/module-runs/${run.id}/resume`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Resume API returned ${response.status}`);
    }
    const data = (await response.json()) as ToolInteractionApiResponse;
    updateRuntimeRun(toRuntimeRunFromApiModuleRun(data.run));
    setRuntimeActionStates((current) => ({ ...current, [run.id]: "succeeded" }));
    setRuntimeActionStatusText(`Resume submitted for ${run.moduleId}`);
  } catch {
    setRuntimeActionStates((current) => ({ ...current, [run.id]: "failed" }));
    setRuntimeActionStatusText(`Resume API failed for ${run.moduleId}`);
  }
}
```

Do not call resume for local mock runs where `latestAgentRun` is `null`; keep routing to Modules for those.

- [x] **Step 3: Pass action state and callbacks**

Pass `runtimeActionStates`, `runtimeActionStatusText`, and `onResumeRuntimeRun={resumeRuntimeRun}` to `ModulesView` and `ProgressView`.

## Task 3: UI Actions And Labels

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Update status labels**

Update `runtimeStatusLabel`:

```ts
if (status === "waiting_for_user") return "Needs reply";
if (status === "waiting_for_data") return "Needs data";
if (status === "blocked") return "Blocked";
```

Add CSS class coverage for `.runtime-status.waiting_for_user`, `.runtime-status.waiting_for_data`, and `.runtime-status.blocked`.

- [x] **Step 2: Update Progress action buttons**

Change `ProgressView` props to include:

```ts
runtimeActionStates: Record<string, RuntimeActionState>;
runtimeActionStatusText: string;
onResumeRuntimeRun: (run: RuntimeModuleRun) => void | Promise<void>;
```

In `runtimeAction`:

- `resumable`: button calls `void onResumeRuntimeRun(run)`, disabled while `runtimeActionStates[run.id] === "submitting"`, label `Resuming` while submitting, else `Resume`.
- `waiting_for_user`, `waiting_for_data`, `approval_required`, `blocked`: button opens module detail with label `Review`.
- `skipped`: existing Configure.
- `succeeded`: existing View data.
- fallback: existing View run.

Render `<p className="agent-run-status-text">{runtimeActionStatusText}</p>` below the API plan/local status text in Progress.

- [x] **Step 3: Update Modules runtime panel**

Change `ModulesView` props to include the same `runtimeActionStates`, `runtimeActionStatusText`, and `onResumeRuntimeRun`.

Inside the selected runtime contract panel:

- Keep interaction title/message/resume handle display.
- If `selectedRuntimeRun.status === "resumable"`, show a `Resume now` button next to `Open data`.
- Disable that button while submitting and show `Resuming`.
- If action state is `succeeded` or `failed`, show compact text using `runtimeActionStatusText`.

- [x] **Step 4: CSS**

Add CSS for:

- `.runtime-action-feedback`
- `.runtime-status.waiting_for_user`
- `.runtime-status.waiting_for_data`
- `.runtime-status.blocked`

Keep buttons wrapping without overflow on mobile.

## Task 4: Status File And Validation

**Files:**

- Modify: `.hermes/project-status.md`

- [x] **Step 1: Update active work**

Set active branch to `codex/frontend-runtime-feedback-actions` and scope to frontend runtime interaction/resume actions.

- [x] **Step 2: Add current state note**

Add that PR #14 was merged and the admin console now recognizes API interaction metadata and can call the module-run resume endpoint for API-backed resumable runs.

- [x] **Step 3: Run validation**

Required commands:

```bash
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

- [x] **Step 4: Browser smoke**

Controller follow-up passed in the in-app Browser using DOM navigation after one locator click timeout.

Open `http://127.0.0.1:8081/preview/ai-os/AgentFirstInterface?adminToken=admin-demo-token`.

Verify:

- Local mock `Resume` still routes to the `doc_to_md` module detail instead of calling an API.
- Progress shows runtime action status text.
- Modules runtime contract still shows interaction title/message/resume handle.
- Browser console has no warnings/errors.

## Review Checklist

- No backend or generated files changed.
- API resume is only called when `latestAgentRun` exists.
- Local mock fallback behavior is preserved.
- Interaction metadata is validated before use.
- Resume buttons are disabled while submitting.
- Failed resume calls do not destroy existing runtime data.
