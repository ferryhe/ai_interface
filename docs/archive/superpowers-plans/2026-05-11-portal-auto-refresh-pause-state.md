# Portal Auto Refresh Pause State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Portal auto-refresh control honestly show whether polling is active, paused, off, or idle.

**Architecture:** Keep this as a frontend-only UI state slice in `AgentPortalInterface.tsx`. Reuse the existing auto-refresh gating, derive available/active/paused display flags, update the topbar button label/class/title, and add paused styling without changing API behavior or polling logic.

**Tech Stack:** React, TypeScript, Vite mockup sandbox, existing Portal runtime API fetch helpers.

---

## File Structure

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
  - Add derived flags for auto-refresh availability, active polling, and paused state.
  - Add a compact label/title helper for the button display.
  - Use `active` styling only while polling can actually run.
  - Use a new `paused` class when auto-refresh is enabled but blocked by failed/offline/auth-denied/submitting/refreshing state.
  - Do not change API contracts, backend code, generated clients, or sibling repos.
- Modify: `.hermes/project-status.md`
  - Append this slice state, validation commands, and PR link after implementation.

## Task 1: Show Auto Refresh Active/Paused/Off/Idle State

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify after verification: `.hermes/project-status.md`

- [ ] **Step 1: Add display helper**

Near `portalRunStateLabel`, add:

```tsx
function portalAutoRefreshLabel({
  isAvailable,
  isEnabled,
  isActive,
  isPaused,
}: {
  isAvailable: boolean;
  isEnabled: boolean;
  isActive: boolean;
  isPaused: boolean;
}): string {
  if (!isAvailable) return "Auto idle";
  if (!isEnabled) return "Auto off";
  if (isActive) return "Auto active";
  if (isPaused) return "Auto paused";
  return "Auto on";
}
```

- [ ] **Step 2: Add derived display flags**

After `canAutoRefreshPortalRun`, add:

```tsx
  const isPortalAutoRefreshAvailable =
    Boolean(latestPortalRun) && isPortalRunInProgress;
  const isPortalAutoRefreshActive =
    isPortalAutoRefreshEnabled && canAutoRefreshPortalRun;
  const isPortalAutoRefreshPaused =
    isPortalAutoRefreshEnabled &&
    isPortalAutoRefreshAvailable &&
    !canAutoRefreshPortalRun;
  const portalAutoRefreshButtonLabel = portalAutoRefreshLabel({
    isAvailable: isPortalAutoRefreshAvailable,
    isEnabled: isPortalAutoRefreshEnabled,
    isActive: isPortalAutoRefreshActive,
    isPaused: isPortalAutoRefreshPaused,
  });
```

This preserves the existing polling gate. It only changes what the button says and how it is styled.

- [ ] **Step 3: Update button class, disabled state, title, and label**

Replace the auto-refresh button class/disabled/label block with:

```tsx
              <button
                type="button"
                className={`portal-refresh-button${
                  isPortalAutoRefreshActive ? " active" : ""
                }${isPortalAutoRefreshPaused ? " paused" : ""}`}
                disabled={!isPortalAutoRefreshAvailable}
                aria-pressed={isPortalAutoRefreshEnabled}
                title={portalAutoRefreshButtonLabel}
                onClick={() =>
                  setIsPortalAutoRefreshEnabled((current) => !current)
                }
              >
                <RefreshCw size={15} />
                {portalAutoRefreshButtonLabel}
              </button>
```

Expected behavior:
- No API-backed in-progress run: disabled `Auto idle`.
- Enabled and actually polling: active `Auto active`.
- Enabled but blocked by failure/offline/auth-denied/submitting/refreshing state: paused `Auto paused`.
- User toggled off while an API-backed in-progress run exists: `Auto off`.

- [ ] **Step 4: Add paused styling**

After `.portal-refresh-button.active`, add:

```css
  .portal-refresh-button.paused {
    border-color: #66552b;
    background: #211c12;
    color: #f2d68a;
  }
```

Do not change the disabled styling; terminal/no-run `Auto idle` should still look disabled.

- [ ] **Step 5: Run focused frontend validation**

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

- [ ] **Step 6: Browser smoke if the in-app browser is available**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Smoke checks:
- Portal unlocks in local demo/offline mode when `/api` is unavailable.
- Chat, Steps, Data, Sources, and Result still render.
- The auto-refresh button shows disabled `Auto idle` in local demo mode because no API-backed run exists.
- No browser console warnings/errors appear.

If the Browser plugin cannot acquire the current pane, record that exact blocker in `.hermes/project-status.md` and the final report.

- [ ] **Step 7: Update project status**

Append to `.hermes/project-status.md`:

```markdown
- PR #30 was merged into `main` on 2026-05-11 at merge commit `c468aeb`; this branch starts the Portal auto-refresh pause-state slice from latest `main`.
- Portal auto-refresh now labels the control as idle, active, paused, or off so users can tell whether automatic polling is actually running.
- Portal auto-refresh pause-state validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Portal auto-refresh pause-state validation: `$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Portal auto-refresh pause-state validation: `git diff --check` passed with CRLF warnings only.
```

Add the browser smoke line only if the smoke actually runs.

- [ ] **Step 8: Commit and open PR**

After verification passes, stage only the touched files:

```powershell
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-auto-refresh-pause-state.md .hermes/project-status.md
```

Commit:

```powershell
git commit -m "Show Portal auto refresh pause state"
```

Push:

```powershell
git push -u origin codex/portal-auto-refresh-pause-state
```

Open a PR to `main` titled:

```text
Show Portal auto refresh pause state
```

PR body should include summary and validation commands. Schedule/update the existing follow-up automation for roughly 15 minutes later to inspect checks and Copilot comments.
