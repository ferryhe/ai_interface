# Portal Refresh Status Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show frontstage Portal users when the API-backed run was last successfully synced, and whether the sync came from submit, manual refresh, or auto refresh.

**Architecture:** Keep this as a frontend-only visibility slice in `AgentPortalInterface.tsx`. Track the last successful API sync in component state, update it from existing submit/refresh success paths, pass `"auto"` from the interval refresh path, and display a compact topbar pill only when an API-backed run exists.

**Tech Stack:** React, TypeScript, Vite mockup sandbox, existing Portal runtime API fetch helpers.

---

## File Structure

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
  - Add a small source type and snapshot interface.
  - Add helper text for `Submitted`, `Manual`, and `Auto` sync sources.
  - Store the latest successful sync time and source in local React state.
  - Update the snapshot after successful submit and successful refresh.
  - Show a topbar pill such as `Auto 3:52 PM` for API-backed runs.
  - Do not change API contracts, backend code, generated clients, or sibling repos.
- Modify: `.hermes/project-status.md`
  - Append this slice state, validation commands, and PR link after implementation.

## Task 1: Show Last Successful Portal Sync Source

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify after verification: `.hermes/project-status.md`

- [ ] **Step 1: Add sync source types**

Near the existing Portal type aliases, add:

```tsx
type PortalRunSyncSource = "submit" | "manual" | "auto";

interface PortalRunSyncSnapshot {
  source: PortalRunSyncSource;
  checkedAt: string;
  pipelineUpdatedAt: string;
}
```

- [ ] **Step 2: Add sync label helper**

Near `formatApiTime`, add:

```tsx
function portalRunSyncSourceLabel(source: PortalRunSyncSource): string {
  if (source === "submit") return "Submitted";
  if (source === "auto") return "Auto";
  return "Manual";
}
```

The existing `formatApiTime()` should be reused for `checkedAt`.

- [ ] **Step 3: Add sync snapshot state**

Inside `AgentPortalInterface`, near `latestPortalRun`, add:

```tsx
  const [portalRunSyncSnapshot, setPortalRunSyncSnapshot] =
    useState<PortalRunSyncSnapshot | null>(null);
```

- [ ] **Step 4: Clear snapshot at the start of a new prompt**

Inside `submitPortalPrompt()`, immediately after `setDraft("");`, add:

```tsx
    setPortalRunSyncSnapshot(null);
```

This prevents the old run's sync time from showing while a new run is being submitted or falling back to local demo.

- [ ] **Step 5: Record successful submit**

Inside `submitPortalPrompt()`, in the existing success path after `setLatestPortalRun(uiState);`, add:

```tsx
      setPortalRunSyncSnapshot({
        source: "submit",
        checkedAt: new Date().toISOString(),
        pipelineUpdatedAt: data.pipelineRun.updatedAt,
      });
```

- [ ] **Step 6: Let refresh identify manual vs auto source**

Change the refresh signature from:

```tsx
  async function refreshPortalRun(): Promise<void> {
```

to:

```tsx
  async function refreshPortalRun(
    source: Exclude<PortalRunSyncSource, "submit"> = "manual",
  ): Promise<void> {
```

Change the auto-refresh interval call from:

```tsx
      void refreshPortalRun();
```

to:

```tsx
      void refreshPortalRun("auto");
```

The manual Refresh button can keep the existing `refreshPortalRun()` call because the default source is `"manual"`.

- [ ] **Step 7: Record successful refresh**

Inside `refreshPortalRun()`, in the existing success path after `setLatestPortalRun(uiState);`, add:

```tsx
      setPortalRunSyncSnapshot({
        source,
        checkedAt: new Date().toISOString(),
        pipelineUpdatedAt: data.pipelineRun.updatedAt,
      });
```

Do not update this snapshot on failed, malformed, offline, or auth-denied refresh paths. The pill should represent the last successful API sync only.

- [ ] **Step 8: Render the compact topbar pill**

In the topbar actions, after the run-state pill and before the auto-refresh toggle, add:

```tsx
              {latestPortalRun && (
                <div className="portal-run-pill">
                  <Clock3 size={15} />
                  {portalRunSyncSnapshot
                    ? `${portalRunSyncSourceLabel(
                        portalRunSyncSnapshot.source,
                      )} ${formatApiTime(portalRunSyncSnapshot.checkedAt)}`
                    : `Updated ${formatApiTime(
                        latestPortalRun.response.pipelineRun.updatedAt,
                      )}`}
                </div>
              )}
```

This intentionally avoids adding new CSS; the existing pill style already handles compact topbar status.

- [ ] **Step 9: Run focused frontend validation**

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

- [ ] **Step 10: Browser smoke if the in-app browser is available**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Smoke checks:
- Portal unlocks in local demo/offline mode when `/api` is unavailable.
- Chat, Steps, Data, Sources, and Result still render.
- No sync pill appears in local demo mode because there is no API-backed run.
- No browser console warnings/errors appear.

If the Browser plugin cannot acquire the current pane, record that exact blocker in `.hermes/project-status.md` and the final report.

- [ ] **Step 11: Update project status**

Append to `.hermes/project-status.md`:

```markdown
- PR #29 was merged into `main` on 2026-05-11 at merge commit `bc397b1`; this branch starts the Portal refresh status visibility slice from latest `main`.
- Portal now shows a compact API sync pill for API-backed runs, indicating whether the last successful sync came from submit, manual refresh, or auto refresh.
- Portal refresh status visibility validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Portal refresh status visibility validation: `$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Portal refresh status visibility validation: `git diff --check` passed with CRLF warnings only.
```

Add the browser smoke line only if the smoke actually runs.

- [ ] **Step 12: Commit and open PR**

After verification passes, stage only the touched files:

```powershell
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-refresh-status-visibility.md .hermes/project-status.md
```

Commit:

```powershell
git commit -m "Show Portal refresh sync status"
```

Push:

```powershell
git push -u origin codex/portal-refresh-status-visibility
```

Open a PR to `main` titled:

```text
Show Portal refresh sync status
```

PR body should include summary and validation commands. Schedule/update the existing follow-up automation for roughly 15 minutes later to inspect checks and Copilot comments.
