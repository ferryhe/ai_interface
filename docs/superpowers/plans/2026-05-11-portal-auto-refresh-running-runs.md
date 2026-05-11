# Portal Auto Refresh Running Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontstage Portal users should see API-backed running/pending Agent runs progress without repeatedly clicking Refresh.

**Architecture:** Keep this as a frontend-only slice in `AgentPortalInterface.tsx`. Add a small auto-refresh toggle that defaults on, polls the existing guarded `refreshPortalRun()` every 10 seconds only while the API-backed pipeline run is `pending` or `running`, and stops automatically for terminal states, local demo mode, submit, and active refresh.

**Tech Stack:** React, TypeScript, Vite mockup sandbox, existing Portal runtime API fetch helpers.

---

## File Structure

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
  - Add a helper to identify in-progress pipeline statuses.
  - Add state for the auto-refresh toggle.
  - Add a `useEffect` interval that calls the existing `refreshPortalRun()` only when safe.
  - Add a compact topbar toggle near the manual Refresh button.
  - Do not change API contracts, backend code, generated clients, or sibling repos.
- Modify: `.hermes/project-status.md`
  - Append this slice state, validation commands, and PR link after implementation.

## Task 1: Auto-Refresh In-Progress Portal Runs

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify after verification: `.hermes/project-status.md`

- [ ] **Step 1: Add in-progress status helper**

Near the existing status helper functions, add:

```tsx
function isPortalPipelineInProgress(
  status: PortalAgentRunApiResponse["pipelineRun"]["status"],
): boolean {
  return status === "pending" || status === "running";
}
```

- [ ] **Step 2: Add auto-refresh state and derived flags**

Inside `AgentPortalInterface`, near `portalRunState`, add:

```tsx
  const [isPortalAutoRefreshEnabled, setIsPortalAutoRefreshEnabled] =
    useState(true);
```

After the displayed data constants, add:

```tsx
  const isPortalRunInProgress = latestPortalRun
    ? isPortalPipelineInProgress(latestPortalRun.response.pipelineRun.status)
    : false;
  const canAutoRefreshPortalRun =
    Boolean(latestPortalRun) &&
    isPortalRunInProgress &&
    portalRunState !== "submitting" &&
    portalRunState !== "refreshing";
```

- [ ] **Step 3: Add interval effect**

After the initial token `useEffect`, add:

```tsx
  useEffect(() => {
    if (!isPortalAutoRefreshEnabled || !canAutoRefreshPortalRun) return;

    const intervalId = window.setInterval(() => {
      void refreshPortalRun();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [canAutoRefreshPortalRun, isPortalAutoRefreshEnabled, latestPortalRun]);
```

Important behavior:
- Local demo mode has no `latestPortalRun`, so no interval starts.
- Terminal pipeline states have `isPortalRunInProgress === false`, so no interval starts.
- While a submit or refresh is active, `canAutoRefreshPortalRun === false`, so no overlapping refresh starts.
- Runtime `401`/`403`, malformed response, failed response, and offline behavior stay inside the existing `refreshPortalRun()` path.

- [ ] **Step 4: Add a compact topbar toggle**

In the topbar actions, before the manual Refresh button, add:

```tsx
              <button
                type="button"
                className={
                  isPortalAutoRefreshEnabled
                    ? "portal-refresh-button active"
                    : "portal-refresh-button"
                }
                disabled={!latestPortalRun || !isPortalRunInProgress}
                aria-pressed={isPortalAutoRefreshEnabled}
                onClick={() =>
                  setIsPortalAutoRefreshEnabled((current) => !current)
                }
              >
                <RefreshCw size={15} />
                {isPortalAutoRefreshEnabled ? "Auto on" : "Auto off"}
              </button>
```

Keep the existing manual Refresh button unchanged except that it can reuse the existing disabled logic.

- [ ] **Step 5: Add active button styling**

Near `.portal-refresh-button` CSS, add:

```css
  .portal-refresh-button.active {
    border-color: #4f9cff;
    background: #10233a;
    color: #edf3fb;
  }
```

- [ ] **Step 6: Run focused frontend validation**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: exit 0.

Run:

```powershell
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
```

Expected: exit 0.

Run:

```powershell
git diff --check
```

Expected: exit 0, allowing existing CRLF warnings if Git emits them.

- [ ] **Step 7: Browser smoke if the in-app browser is available**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Smoke checks:
- Portal unlocks in local demo/offline mode when `/api` is unavailable.
- Chat, Steps, Data, Sources, and Result still render.
- The auto-refresh toggle is disabled in local demo mode because no API-backed run exists.
- No browser console warnings/errors appear.

If the Browser plugin cannot acquire the current pane, record that exact blocker in `.hermes/project-status.md` and the final report.

- [ ] **Step 8: Update project status**

Append to `.hermes/project-status.md`:

```markdown
- PR #28 was merged into `main` on 2026-05-11 at merge commit `6b3123b`; this branch starts the Portal auto-refresh running-runs slice from latest `main`.
- Portal now has an auto-refresh toggle that defaults on and polls API-backed `pending`/`running` Agent runs through the existing guarded refresh path without polling local demo or terminal runs.
- Portal auto-refresh running-runs validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Portal auto-refresh running-runs validation: `$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Portal auto-refresh running-runs validation: `git diff --check` passed with CRLF warnings only.
```

Add the browser smoke line only if the smoke actually runs.

- [ ] **Step 9: Commit and open PR**

After verification passes, stage only the touched files:

```powershell
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-auto-refresh-running-runs.md .hermes/project-status.md
```

Commit:

```powershell
git commit -m "Add Portal auto refresh for running runs"
```

Push:

```powershell
git push -u origin codex/portal-auto-refresh-running-runs
```

Open a PR to `main` titled:

```text
Add Portal auto refresh for running runs
```

PR body should include summary and validation commands. Schedule/update the existing follow-up automation for roughly 15 minutes later to inspect checks and Copilot comments.
