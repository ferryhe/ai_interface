# Publish Portal Access Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin Publish page explain and operate the handoff into the frontstage Portal: token access, what end users see, what remains admin-only, and how to open the Portal preview.

**Architecture:** This is a frontend-only mockup slice. The Publish page stays in `AgentFirstInterface.tsx`, keeps the existing `View Portal` route contract, and adds clear access/visibility panels without introducing a real auth backend or changing Portal runtime APIs.

**Tech Stack:** React, TypeScript, lucide-react, Vite mockup sandbox.

---

## Design Summary

The user asked whether Configure and Deploy/Publish are needed and what frontstage users see after publish. The current Portal already has Chat, Steps, Data, Sources, and Result, but the admin Publish page still looks like a short status checklist. This PR turns Publish into the bridge between backend/admin setup and end-user Portal access.

Keep scope narrow:

- Do not add database tables or real token validation in this PR.
- Do not change `AgentPortalInterface.tsx` unless a tiny route-label fix is absolutely needed.
- Do not read or edit sibling repos.
- Keep all copy focused on what a user needs to operate the interface, not marketing.

## File Structure

- Modify `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
  - Extend `PublishView` with Portal access, frontstage visibility, admin boundary, and preview launch controls.
  - Add small helper components inside the same file if they keep JSX readable.
  - Add scoped CSS classes near existing Publish styles.
- Modify `.hermes/project-status.md`
  - Record branch/scope/current state and verification results.
- Create this plan file.

## Task 1: Publish View Access Content

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Replace the static Publish header action with a Portal preview action**

Find `function PublishView()`. Change the existing header button so it opens the frontstage Portal preview:

```tsx
<button
  type="button"
  className="primary-action"
  onClick={() => window.location.assign(previewUrl("ai-os/AgentPortalInterface", "?token=portal-demo-token"))}
>
  <UploadCloud size={15} />
  Open Portal preview
</button>
```

Expected: the Publish action answers "what happens after publish" by opening the frontstage surface that users will see.

- [x] **Step 2: Add a token access panel under the publish status grid**

Under the existing `publish-grid`, add:

```tsx
<div className="publish-access-grid">
  <section className="publish-access-card">
    <span className="publish-card-kicker">Portal access</span>
    <h2>Token unlocks the frontstage workspace</h2>
    <p>
      Published users enter with a portal token, then work inside Chat, Steps, Data, Sources, and Result.
    </p>
    <div className="publish-token-row">
      <code>portal-demo-token</code>
      <button
        type="button"
        onClick={() => window.location.assign(previewUrl("ai-os/AgentPortalInterface", "?token=portal-demo-token"))}
      >
        View as user
      </button>
    </div>
    <em>Demo token only. Production token validation belongs on the server.</em>
  </section>
</div>
```

Expected: admins can see the current demo access path without confusing it for production auth.

- [x] **Step 3: Add frontstage visibility cards**

Inside the same `publish-access-grid`, add a second card with five rows:

```tsx
const portalVisibleViews = [
  ["Chat", "Ask the published Agent to run or continue work."],
  ["Steps", "See which module is running, blocked, or complete."],
  ["Data", "Inspect generated records and artifacts."],
  ["Sources", "Trace evidence back to source material."],
  ["Result", "Review final handoff, agent config, and readiness."],
];
```

Render them as:

```tsx
<section className="publish-access-card">
  <span className="publish-card-kicker">Frontstage visible</span>
  <h2>Users keep progress and data visibility</h2>
  <div className="publish-portal-view-list">
    {portalVisibleViews.map(([label, detail]) => (
      <span key={label}>
        <strong>{label}</strong>
        <em>{detail}</em>
      </span>
    ))}
  </div>
</section>
```

Expected: Publish clarifies that frontstage is not just a chat box; users still know steps and can inspect data.

- [x] **Step 4: Add admin boundary card**

Add a third card:

```tsx
<section className="publish-access-card">
  <span className="publish-card-kicker">Admin-only</span>
  <h2>Configure stays backstage</h2>
  <p>
    Provider, model, business skills, general skills, memory, safety, and publish gates remain admin controls.
  </p>
  <div className="publish-admin-boundary">
    <span><ShieldCheck size={14} /> Configure runtime</span>
    <span><Database size={14} /> Manage memory writes</span>
    <span><Settings2 size={14} /> Control skill permissions</span>
  </div>
</section>
```

Expected: admins understand why Configure is separate from the user Portal.

## Task 2: Styling And Responsive Layout

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Add scoped Publish access CSS**

Near existing `.publish-grid` styles, add:

```css
.publish-access-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.publish-access-card {
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.42);
  border-radius: 8px;
  padding: 14px;
  display: grid;
  gap: 10px;
}

.publish-card-kicker {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.publish-access-card h2 {
  font-size: 15px;
  margin: 0;
}

.publish-access-card p,
.publish-access-card em {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.publish-token-row,
.publish-admin-boundary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.publish-token-row code {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  padding: 7px 9px;
  color: var(--text);
  background: rgba(2, 6, 23, 0.48);
}

.publish-token-row button {
  border: 1px solid rgba(96, 165, 250, 0.35);
  background: rgba(96, 165, 250, 0.12);
  color: #bfdbfe;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
}

.publish-portal-view-list {
  display: grid;
  gap: 8px;
}

.publish-portal-view-list span,
.publish-admin-boundary span {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 6px;
  padding: 8px;
  background: rgba(2, 6, 23, 0.28);
}

.publish-portal-view-list strong,
.publish-admin-boundary span {
  color: var(--text);
  font-size: 12px;
}

.publish-portal-view-list em {
  display: block;
  margin-top: 3px;
}
```

- [x] **Step 2: Add mobile behavior**

In the existing mobile media query area that handles `.publish-grid`, add:

```css
.publish-access-grid {
  grid-template-columns: 1fr;
}
```

Expected: the Publish page stays readable on mobile and does not overflow.

## Task 3: Project Status And Verification

**Files:**
- Modify: `.hermes/project-status.md`

- [x] **Step 1: Update active work**

Set:

```markdown
- Branch: `codex/publish-portal-access-panel`
- Scope: Frontend Publish page access/visibility panel for the frontstage Portal.
```

- [x] **Step 2: Add current state bullets**

Add:

```markdown
- PR #20 was merged into `main` on 2026-05-11 at merge commit `bd20ff4`; this branch starts the next frontend Publish-to-Portal access slice from latest `main`.
- Publish now explains the frontstage Portal token handoff, what end users see after publish, and which Configure controls remain admin-only.
```

- [x] **Step 3: Run focused checks**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Expected: typecheck and build exit 0. `git diff --check` may print CRLF warnings only.

- [ ] **Step 4: Browser smoke**

Pending: attempted after starting an in-process Vite server, but the in-app Browser target `iab` was unavailable in this session.

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentFirstInterface?adminToken=admin-demo-token
```

Verify:

- Publish nav renders.
- Publish page shows Portal access, Frontstage visible, and Admin-only sections.
- `View as user` or `Open Portal preview` navigates to `AgentPortalInterface?token=portal-demo-token`.
- Browser console has no warnings or errors from this flow.

## Self-Review

- Spec coverage: This plan answers what publish is for, what frontstage users see, why Configure remains separate, and how token-based Portal preview is exposed.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: `previewUrl`, `UploadCloud`, `ShieldCheck`, `Database`, and `Settings2` already exist in `AgentFirstInterface.tsx`; `portalVisibleViews` is a local constant.
