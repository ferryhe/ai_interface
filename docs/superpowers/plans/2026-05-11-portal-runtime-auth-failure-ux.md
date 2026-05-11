# Portal Runtime Auth Failure UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontstage Portal treat runtime API `401`/`403` responses as access loss, returning users to the token gate instead of silently falling back to local demo behavior.

**Architecture:** The backend now rejects Portal-origin runtime reads and writes when the published Portal token is missing or invalid. The Portal UI already sends `X-AI-Interface-Surface` and `X-Portal-Token`; this slice adds one shared client-side response handler for runtime authorization failures and calls it from every Portal runtime API fetch. Offline/network failures still keep the existing demo fallback behavior.

**Tech Stack:** React, TypeScript, Vite mockup sandbox, existing Portal component state and fetch calls.

---

## File Structure

- Modify `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`: add a shared runtime access-denied handler and use it for Agent run create, feedback, resume, module-run detail, and artifact detail fetches.
- Modify `.hermes/project-status.md`: record PR #25 merge, this branch goal, and verification results.

## Task 1: Handle Runtime Access Denials In Portal

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Add a response classifier**

Near the existing helper functions in `AgentPortalInterface.tsx`, add this pure helper:

```ts
function isPortalRuntimeAccessDenied(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}
```

- [ ] **Step 2: Add a component-scoped lock helper**

Inside `AgentPortalInterface`, after `fallBackToLocalDemoIfApiUnavailable`, add:

```ts
function lockPortalAfterRuntimeAccessDenied(): void {
  setIsUnlocked(false);
  setAuthorizedPortalToken("");
  setPortalAccessState("invalid_token");
  setPortalAccessStatusText(
    "Portal access was rejected by the runtime API. Re-enter a valid token.",
  );
  setPortalRunState("failed");
  setPortalRunStatusText("Portal access rejected by runtime API");
  setPortalActionStatusText("Portal access rejected by runtime API");
  setPortalDetailStatusText("Portal access rejected by runtime API");
  setPortalSourceStatusText("Portal access rejected by runtime API");
  setPortalResultStatusText("Portal access rejected by runtime API");
}
```

Do not clear `token`; keeping the user's attempted value visible in the password input avoids surprise and lets them edit/resubmit.

- [ ] **Step 3: Use the helper in Agent run creation**

In `submitPortalPrompt`, replace the non-ok block:

```ts
if (!response.ok) {
  setLatestPortalRun(null);
  setActiveStep(portalSteps[2].id);
  setPortalRunState("failed");
  setPortalRunStatusText("Agent Run API failed - showing local demo");
  return;
}
```

with:

```ts
if (!response.ok) {
  if (isPortalRuntimeAccessDenied(response)) {
    setLatestPortalRun(null);
    setActiveStep(portalSteps[2].id);
    lockPortalAfterRuntimeAccessDenied();
    return;
  }
  setLatestPortalRun(null);
  setActiveStep(portalSteps[2].id);
  setPortalRunState("failed");
  setPortalRunStatusText("Agent Run API failed - showing local demo");
  return;
}
```

- [ ] **Step 4: Use the helper in feedback and resume**

In `submitInteractionFeedback`, replace:

```ts
if (!response.ok)
  throw new Error(`Feedback API returned ${response.status}`);
```

with:

```ts
if (!response.ok) {
  if (isPortalRuntimeAccessDenied(response)) {
    finishPortalAction(step.id, "failed");
    lockPortalAfterRuntimeAccessDenied();
    return;
  }
  throw new Error(`Feedback API returned ${response.status}`);
}
```

In `resumeStepRun`, replace:

```ts
if (!response.ok)
  throw new Error(`Resume API returned ${response.status}`);
```

with:

```ts
if (!response.ok) {
  if (isPortalRuntimeAccessDenied(response)) {
    finishPortalAction(step.id, "failed");
    lockPortalAfterRuntimeAccessDenied();
    return;
  }
  throw new Error(`Resume API returned ${response.status}`);
}
```

- [ ] **Step 5: Use the helper in module-run detail reads**

In `openDataRecord`, `openSource`, and `openResultItem`, replace each module-run detail non-ok block:

```ts
if (!response.ok)
  throw new Error(`Module run detail API returned ${response.status}`);
```

with the status-target-specific version:

```ts
if (!response.ok) {
  if (isPortalRuntimeAccessDenied(response)) {
    setPortalDetailStates((current) => ({ ...current, [runId]: "failed" }));
    lockPortalAfterRuntimeAccessDenied();
    return;
  }
  throw new Error(`Module run detail API returned ${response.status}`);
}
```

Use the same code in all three functions. The shared lock helper updates all Portal status text fields, so no per-view wording is needed.

- [ ] **Step 6: Use the helper in artifact reads**

In `openArtifact`, replace:

```ts
if (!response.ok)
  throw new Error(`Artifact API returned ${response.status}`);
```

with:

```ts
if (!response.ok) {
  if (isPortalRuntimeAccessDenied(response)) {
    lockPortalAfterRuntimeAccessDenied();
    return;
  }
  throw new Error(`Artifact API returned ${response.status}`);
}
```

- [ ] **Step 7: Verify frontend behavior and types**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Expected: all commands exit `0`; `git diff --check` may print CRLF warnings but must not report whitespace errors.

- [ ] **Step 8: Browser smoke**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Verify:
- The Portal still unlocks in mockup/offline demo mode when `/api` is unavailable.
- Chat, Steps, Data, Sources, and Result views still render.
- The token lock screen still renders when opening `AgentPortalInterface` without `?token=`.
- No console errors or warnings are reported.

This smoke validates that the new helper did not break existing offline/demo behavior. A real `403` runtime response is covered by the code path inspection and TypeScript because the local mockup preview does not run the API server.

- [ ] **Step 9: Update project status**

Append to `.hermes/project-status.md`:

```md
- PR #25 was merged into `main` on 2026-05-11; this branch starts the Portal runtime auth failure UX slice from latest `main`.
- Portal runtime API `401`/`403` responses now lock the Portal and ask the user to re-enter a token instead of falling through to local demo status.
- Offline/network runtime failures still preserve the existing local demo behavior.
```

Also record every verification command and result under `## Notes`.

## Self-Review

- Spec coverage: The plan covers all Portal runtime fetches that carry the Portal token: Agent run create, feedback, resume, module-run detail, and artifact detail.
- Placeholder scan: No TBD/TODO/fill-in-later placeholders remain.
- Type consistency: The new helpers use existing `PortalAccessState`, `PortalRunSubmitState`, and status setter names already present in `AgentPortalInterface.tsx`.
