# Portal Agent Run Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let frontstage Portal users refresh an API-backed Agent run from `GET /api/agent-runs/{pipelineRunId}` so Steps, Data, Sources, and Result can update after the original submit.

**Architecture:** Reuse the existing `PortalAgentRunApiResponse` validator and `toPortalUiState` mapper. Add a lightweight `refreshing` runtime state plus a refresh button shown only after an API run exists. Portal runtime headers and auth-denial locking must use the existing helpers from the prior slices.

**Tech Stack:** React, TypeScript, Vite mockup sandbox, existing Portal runtime API shapes.

---

## File Structure

- Modify `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`: add a refresh run state, fetch `GET /api/agent-runs/{pipelineRunId}`, update Portal UI state, and render a refresh control.
- Modify `.hermes/project-status.md`: record PR #26 merge, this branch goal, and verification results.

## Task 1: Add Portal Agent Run Refresh

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Extend the run submit state**

Update `PortalRunSubmitState` near the top of `AgentPortalInterface.tsx`:

```ts
type PortalRunSubmitState =
  | "local"
  | "submitting"
  | "refreshing"
  | "saved"
  | "offline"
  | "failed";
```

Update `portalRunStateLabel`:

```ts
function portalRunStateLabel(state: PortalRunSubmitState): string {
  if (state === "submitting") return "Submitting";
  if (state === "refreshing") return "Refreshing";
  if (state === "saved") return "API saved";
  if (state === "offline") return "API offline";
  if (state === "failed") return "API failed";
  return "Local demo";
}
```

Update the CSS state rule so the refresh pill reads like an active API call:

```css
.portal-run-pill.submitting,
.portal-run-pill.refreshing {
  border-color: #31506f;
  background: #10233a;
  color: #67b7ff;
}
```

- [ ] **Step 2: Add a refresh helper inside `AgentPortalInterface`**

Add this function after `submitPortalPrompt` and before `updatePortalRunFromModuleRun`:

```ts
async function refreshPortalRun(): Promise<void> {
  if (!latestPortalRun || portalRunState === "submitting" || portalRunState === "refreshing") {
    return;
  }

  const pipelineRunId = latestPortalRun.response.pipelineRun.id;
  setPortalRunState("refreshing");
  setPortalRunStatusText(`Refreshing run ${shortRunId(pipelineRunId)}`);

  try {
    const response = await fetch(
      `/api/agent-runs/${encodeURIComponent(pipelineRunId)}`,
      {
        headers: portalRuntimeHeaders(authorizedPortalToken),
      },
    );

    if (!response.ok) {
      if (isPortalRuntimeAccessDenied(response)) {
        lockPortalAfterRuntimeAccessDenied();
        return;
      }
      setPortalRunState("failed");
      setPortalRunStatusText(
        `Refresh failed for run ${shortRunId(pipelineRunId)}`,
      );
      return;
    }

    const data = (await response.json()) as unknown;
    if (!isPortalAgentRunApiResponse(data)) {
      setPortalRunState("failed");
      setPortalRunStatusText(
        `Refresh returned an unexpected response for ${shortRunId(pipelineRunId)}`,
      );
      return;
    }

    const uiState = toPortalUiState(data);
    setLatestPortalRun(uiState);
    setActiveStep((current) =>
      uiState.steps.some((step) => step.id === current)
        ? current
        : (uiState.steps[0]?.id ?? portalSteps[0].id),
    );
    setPortalRunState("saved");
    setPortalRunStatusText(`Refreshed run ${shortRunId(data.pipelineRun.id)}`);
  } catch {
    setPortalRunState("offline");
    setPortalRunStatusText(
      `Refresh unavailable for run ${shortRunId(pipelineRunId)} - keeping current view`,
    );
  }
}
```

Keep the existing submit catch behavior unchanged; refresh should preserve the current API-backed view on network/offline failure rather than clearing `latestPortalRun`.

- [ ] **Step 3: Render a refresh button in the Portal top bar**

In the topbar action group after the API run-state pill, add:

```tsx
<button
  type="button"
  className="portal-refresh-button"
  disabled={!latestPortalRun || portalRunState === "submitting" || portalRunState === "refreshing"}
  onClick={() => void refreshPortalRun()}
>
  <RefreshCw size={15} />
  Refresh
</button>
```

Import `RefreshCw` from `lucide-react` with the other icons.

- [ ] **Step 4: Add refresh button styling**

Near `.portal-mode-switch`, add:

```css
.portal-refresh-button {
  min-height: 30px;
  border: 1px solid #263445;
  border-radius: 8px;
  background: #101721;
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

.portal-refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
```

- [ ] **Step 5: Update project status**

Append to `.hermes/project-status.md`:

```md
- PR #26 was merged into `main` on 2026-05-11; this branch starts the Portal Agent run refresh slice from latest `main`.
- Portal now exposes a refresh control for API-backed runs and uses `GET /api/agent-runs/{pipelineRunId}` with Portal runtime headers to update Steps/Data/Sources/Result.
- Runtime `401`/`403` refresh responses reuse the Portal auth-denial lock behavior; network/offline refresh failures keep the current API view.
```

Also record every verification command and result under `## Notes`.

- [ ] **Step 6: Verify frontend behavior and types**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Expected: all commands exit `0`; `git diff --check` may print CRLF warnings but must not report whitespace errors.

- [ ] **Step 7: Browser smoke**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Verify:
- The Portal still unlocks in mockup/offline demo mode when `/api` is unavailable.
- Chat, Steps, Data, Sources, and Result views still render.
- The Refresh button is visible in the topbar and disabled before an API-backed run exists.
- No console errors or warnings are reported.

This smoke validates the new control does not break the existing demo path. A real API-backed refresh requires an API server with stored run data and is covered by TypeScript plus route/API contract validation from prior slices.

## Self-Review

- Spec coverage: The plan wires `GET /api/agent-runs/{pipelineRunId}` into the Portal frontstage and keeps auth/offline behavior aligned with prior slices.
- Placeholder scan: No TBD/TODO/fill-in-later placeholders remain.
- Type consistency: The new `refreshing` state is added everywhere the run state is labeled/styled, and the refresh function reuses existing `PortalAgentRunApiResponse`, `toPortalUiState`, and runtime header helpers.
