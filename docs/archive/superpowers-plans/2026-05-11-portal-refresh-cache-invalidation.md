# Portal Refresh Cache Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the frontstage Portal refreshes an API-backed Agent run, it must stop showing stale module-run detail and artifact cache data from before the refresh.

**Architecture:** Keep this as a frontend-only correctness slice in `AgentPortalInterface.tsx`. A successful `GET /api/agent-runs/{pipelineRunId}` refresh updates the top-level run state, then clears cached module-run detail, selected artifact pointers, and artifact payloads so Data, Sources, and Result drawers reload fresh details on the next user click.

**Tech Stack:** React, TypeScript, Vite mockup sandbox, existing Portal runtime API fetch helpers.

---

## File Structure

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
  - Add a small helper inside `AgentPortalInterface` to clear detail/artifact caches and reset drawer status copy after refresh.
  - Call the helper only after a successful refresh response has been validated and mapped into UI state.
  - Do not change API contracts, backend code, or generated clients.
- Modify: `.hermes/project-status.md`
  - Append the new slice state, validation commands, and PR link after implementation.

## Task 1: Clear Portal Detail Caches After Successful Refresh

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify after verification: `.hermes/project-status.md`

- [ ] **Step 1: Add a scoped cache reset helper**

In `AgentPortalInterface`, near `lockPortalAfterRuntimeAccessDenied`, add:

```tsx
  function resetPortalDetailCachesAfterRefresh(): void {
    setPortalDetailStates({});
    setPortalRunDetails({});
    setSelectedArtifactByRunId({});
    setPortalArtifactDetails({});
    setPortalDetailStatusText(
      "Run refreshed - open a data record to reload module artifacts",
    );
    setPortalSourceStatusText(
      "Run refreshed - open a source to reload evidence",
    );
    setPortalResultStatusText(
      "Run refreshed - open a result item to reload handoff details",
    );
  }
```

This helper intentionally does not clear `selectedDataRecordId`, `selectedSourceId`, or `selectedResultItemId`; the selected card can stay highlighted while the drawer falls back to the existing "open this item to load" message.

- [ ] **Step 2: Call the helper only after successful refresh**

Inside `refreshPortalRun`, after:

```tsx
      const uiState = toPortalUiState(data);
      setLatestPortalRun(uiState);
```

add:

```tsx
      resetPortalDetailCachesAfterRefresh();
```

Do not call this helper for failed refresh, malformed response, auth-denied response, or network/offline catch paths. Those paths should keep the current visible API data or lock the Portal as they do today.

- [ ] **Step 3: Verify the selected drawer fallback still reads correctly**

Read `DataView`, `PortalDataDetailDrawer`, `SourcesView`, `PortalSourceEvidenceDrawer`, `ResultView`, and `PortalResultDetailDrawer`.

Expected behavior after cache reset:
- If a selected API record/source/result still exists, its drawer receives `detail = null` and `detailState = "idle"`.
- Existing drawer copy tells the user to open that item to load details again.
- Local demo records are unaffected because they do not use `runId`.

- [ ] **Step 4: Run focused frontend validation**

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

- [ ] **Step 5: Browser smoke if the in-app browser is available**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Smoke checks:
- Portal unlocks in local demo/offline mode when `/api` is unavailable.
- Chat, Steps, Data, Sources, and Result still render.
- No browser console warnings/errors appear.

If the Browser plugin cannot acquire the current pane, record that exact blocker in `.hermes/project-status.md` and the final report.

- [ ] **Step 6: Update project status**

Append to `.hermes/project-status.md`:

```markdown
- PR #27 was merged into `main` on 2026-05-11 at merge commit `2868e74`; this branch starts the Portal refresh cache invalidation slice from latest `main`.
- Portal refresh now clears module-run detail, selected artifact, and artifact payload caches after a successful API refresh so Data/Sources/Result reload fresh details instead of showing stale cached artifacts.
- Portal refresh cache invalidation validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Portal refresh cache invalidation validation: `$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Portal refresh cache invalidation validation: `git diff --check` passed with CRLF warnings only.
```

Add the browser smoke line only if the smoke actually runs.

- [ ] **Step 7: Commit and open PR**

After verification passes, stage only the touched files:

```powershell
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-refresh-cache-invalidation.md .hermes/project-status.md
```

Commit:

```powershell
git commit -m "Invalidate Portal detail caches after refresh"
```

Push:

```powershell
git push -u origin codex/portal-refresh-cache-invalidation
```

Open a PR to `main` titled:

```text
Invalidate Portal detail caches after refresh
```

PR body should include summary and validation commands. Schedule/update the existing follow-up automation for roughly 15 minutes later to inspect checks and Copilot comments.
