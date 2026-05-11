# Frontend Runtime Status Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin Agent console visibly reflect execute-ready and resume semantics so users can understand which module ran, paused, skipped, or can be resumed.

**Architecture:** This is a frontend mockup-only PR. It adds typed local runtime state and status/action surfaces inside `AgentFirstInterface.tsx`; it does not call the new backend endpoints yet. The UI should show the contract that backend PRs #11 and #12 enabled: plan-only vs execute-ready, approval pauses, resumable feedback, missing env retry, and result links into Data.

**Tech Stack:** React + TypeScript in `artifacts/mockup-sandbox`, lucide-react icons, existing inline CSS style block.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-frontend-runtime-status-actions.md`

Out of scope:

- No backend/API changes.
- No generated OpenAPI changes.
- No real `POST /api/agent-runs` or `POST /api/module-runs/{runId}/resume` calls.
- No sibling repository reads or edits.
- No plaintext secrets.

## UI Requirements

The admin console should answer four questions directly:

- Is the current Agent run in `plan_only` or `execute_ready` mode?
- Which module runs are `succeeded`, `running`, `resumable`, `approval_required`, `skipped`, or `queued`?
- Which paused runs need user feedback, approval, or adapter configuration?
- Where can the user inspect generated data or resume-ready output?

Use existing layout patterns:

- Keep cards at 8px radius or below.
- Use lucide icons already imported or add icons from lucide-react.
- Do not add explanatory marketing text.
- Make all labels fit on mobile.
- Keep changes inside the existing admin console, not the end-user portal.

## Data Model

Add these local UI types near existing `RunStatus`:

```ts
type RuntimeExecutionMode = "plan_only" | "execute_ready";
type RuntimeRunStatus =
  | "succeeded"
  | "running"
  | "resumable"
  | "approval_required"
  | "skipped"
  | "queued";

interface RuntimeModuleRun {
  id: string;
  moduleId: ModuleId;
  title: string;
  status: RuntimeRunStatus;
  adapterId: string;
  adapterKind: "cli" | "http";
  externalRunId: string;
  interaction?: {
    kind: "question" | "approval" | "data_request" | "blocked";
    title: string;
    message: string;
    resumeHandle: string;
    status: "waiting" | "resumable" | "resumed";
  };
  event: string;
  resultRecordIds: string[];
  missingRequiredEnv: string[];
  updatedAt: string;
}
```

Add a local `runtimeRuns` fixture with one row for each business module:

- `web_listening`: `succeeded`, `web_listening.cli.v1`, result `snap_018`.
- `doc_to_md`: `resumable`, `doc_to_md.http.v1`, interaction title `Conversion warning needs confirmation`, resume handle `doc_to_md:doc-resume-001:resume`, result `md_006`.
- `md_to_rag`: `skipped`, `md_to_rag.cli.v1`, missing env `CROSS2_CLI_PATH`, result `chunk_096`.
- `rag_to_agent`: `approval_required`, `rag_to_agent.http.v1`, interaction title `Approve generated agent config`, result `agent_cfg_002`.

## Task 1: Runtime State And Agent/Progress Surfaces

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Add types and fixtures**

Add `RuntimeExecutionMode`, `RuntimeRunStatus`, `RuntimeModuleRun`, and `runtimeRuns` exactly as described above.

- [x] **Step 2: Add status helpers**

Add helpers:

```ts
function runtimeStatusLabel(status: RuntimeRunStatus): string {
  if (status === "approval_required") return "Approval";
  if (status === "resumable") return "Resume ready";
  if (status === "skipped") return "Config needed";
  if (status === "succeeded") return "Succeeded";
  if (status === "running") return "Running";
  return "Queued";
}

function runtimeStatusClass(status: RuntimeRunStatus): string {
  return `runtime-status ${status}`;
}
```

- [x] **Step 3: Add local execution mode state**

Inside `AgentFirstInterface`, add:

```ts
const [executionMode, setExecutionMode] =
  useState<RuntimeExecutionMode>("execute_ready");
```

Pass `executionMode`, `setExecutionMode`, and `runtimeRuns` into `AgentView`, `ModulesView`, and `ProgressView`.

- [x] **Step 4: Update Agent view**

In `AgentView`, replace the generic run card detail with a runtime summary showing:

- Mode segmented control: `Plan only` and `Execute ready`.
- Counts for resume-ready, approval, config-needed.
- Run card actions: `Progress`, `Data`, `Modules`.

Buttons should be local-only and visually obvious; do not perform network calls.

- [x] **Step 5: Update Progress view**

Render timeline cards from `runtimeRuns` instead of only `runSteps`. Each card should show:

- status pill
- module id and adapter id
- event summary
- result record count
- context action:
  - `Resume` for `resumable`
  - `Configure` for `skipped`
  - `Approve` for `approval_required`
  - `View data` for `succeeded`

The context action can be a button with no side effect except `View data` calling `onOpenData`.

## Task 2: Module Detail Runtime Panel

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Find selected runtime run**

In `ModulesView`, derive:

```ts
const selectedRuntimeRun =
  runtimeRuns.find((run) => run.moduleId === selectedModule.id);
```

- [x] **Step 2: Add Runtime contract panel**

Below the existing `detail-grid`, add a panel titled `Runtime contract` with:

- adapter id
- adapter kind
- external run id
- missing env names or `Ready`
- resume support: yes for all except `md_to_rag`
- current interaction title/message if present

- [x] **Step 3: Add result links**

In the same panel, show result record ids as chips. Clicking `Open data` should still call the existing `onOpenData`.

## Task 3: Styling And Responsiveness

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Add CSS classes**

Add CSS for:

- `.runtime-control`
- `.runtime-mode-group`
- `.runtime-mode-button`
- `.runtime-status-grid`
- `.runtime-status`
- `.runtime-panel`
- `.runtime-meta-grid`
- `.runtime-chip-row`
- `.runtime-action-row`

Keep dimensions stable and mobile-friendly.

- [x] **Step 2: Mobile check**

Inside the existing mobile media query, ensure runtime grids collapse to one column and buttons can wrap without overlap.

## Task 4: Status File And Validation

**Files:**

- Modify: `.hermes/project-status.md`

- [x] **Step 1: Update active work**

Set active branch to `codex/frontend-runtime-status-actions` and scope to frontend runtime status/actions for execute-ready/resume visibility.

- [x] **Step 2: Add current state note**

Add that PR #12 was merged and the admin mockup now surfaces execute-ready/resume status without real API calls.

- [x] **Step 3: Run validation**

Required commands:

```bash
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

- [x] **Step 4: Browser smoke**

Open `http://127.0.0.1:8081/preview/ai-os/AgentFirstInterface?adminToken=admin-demo-token` or the active local preview. Verify:

- Agent view shows `Plan only` / `Execute ready`.
- Progress shows resume-ready, config-needed, approval, and succeeded statuses.
- Modules detail shows `Runtime contract`.
- No console warnings/errors.

## Review Checklist

- The UI clearly distinguishes business module state from general configuration.
- No real execution call is introduced.
- No backend files are modified.
- Status labels fit on mobile.
- `Configure` remains the place for API/model/skill settings; runtime action cards do not replace it.
