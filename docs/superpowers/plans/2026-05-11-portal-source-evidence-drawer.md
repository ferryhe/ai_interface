# Portal Source Evidence Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let frontstage Portal users inspect source evidence and provenance from the Sources page, including API-backed module-run events/artifacts when available.

**Architecture:** This is a frontend-only continuation of the Portal data detail drawer. `AgentPortalInterface.tsx` already has guarded module-run/artifact detail fetching; this PR reuses those guards and fetch handlers for `PortalSource` cards, adds source selection state, and renders a compact evidence drawer. Local demo sources stay local-only and API-backed sources load existing `/api/module-runs/{runId}` details.

**Tech Stack:** React + TypeScript, browser `fetch`, existing mockup sandbox CSS, existing Portal API guard helpers.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-portal-source-evidence-drawer.md`

Out of scope:

- No backend/API/server changes.
- No OpenAPI or generated client changes.
- No sibling repository reads or execution.
- No external adapter/CLI/process/HTTP service execution.
- No new portal authentication or publish flow.
- No editable source annotations; this PR is read-only evidence display.

## Data Contract

Extend `PortalSource`:

```ts
interface PortalSource {
  runId?: string;
  artifactId?: string;
  evidenceTitle: string;
  evidenceDetail: string;
}
```

Local demo source examples:

```ts
{
  id: "s1",
  label: "docs.example.com/start",
  type: "Watched URL",
  step: "Listen",
  freshness: "Snapshot captured 2 min ago",
  summary: "Primary onboarding page used to detect copy and setup flow changes.",
  evidenceTitle: "Watched URL snapshot",
  evidenceDetail: "The Listen step captured page text and change metadata before downstream conversion.",
}
```

API source mapping:

```ts
{
  id: `api-source-${run.id}`,
  runId: run.id,
  label: run.externalRunId,
  type: run.moduleId,
  step: step.label,
  freshness: `Updated ${formatApiTime(run.updatedAt)}`,
  summary: run.summary ?? metadataString(run.metadata, "action", step.fallbackSummary),
  evidenceTitle: run.title ?? step.label,
  evidenceDetail: metadataString(run.metadata, "adapterReadinessHint", "Open details to inspect stored events and artifacts."),
}
```

## Task 1: Add Source Evidence Data

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Extend the `PortalSource` interface**

Add optional `runId` and `artifactId`, plus required `evidenceTitle` and `evidenceDetail` strings:

```ts
interface PortalSource {
  id: string;
  label: string;
  type: string;
  step: string;
  freshness: string;
  summary: string;
  runId?: string;
  artifactId?: string;
  evidenceTitle: string;
  evidenceDetail: string;
}
```

- [ ] **Step 2: Fill local demo source evidence**

Update each item in `portalSources`:

```ts
evidenceTitle: "Watched URL snapshot",
evidenceDetail: "The Listen step captured page text and change metadata before downstream conversion.",
```

```ts
evidenceTitle: "Converted source document",
evidenceDetail: "The Convert step normalized the original guide into Markdown before chunking.",
```

```ts
evidenceTitle: "RAG memory collection",
evidenceDetail: "The Index step stores chunks and retrieval metadata for the published Agent.",
```

- [ ] **Step 3: Map API sources with `runId`**

In `toPortalUiState`, update API `sources` mapping to include:

```ts
runId: run.id,
evidenceTitle: run.title ?? step.label,
evidenceDetail: metadataString(
  run.metadata,
  "adapterReadinessHint",
  "Open details to inspect stored events and artifacts.",
),
```

- [ ] **Step 4: Verify typecheck**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: PASS.

## Task 2: Add Source Selection And Fetch Reuse

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add source state**

Inside `AgentPortalInterface`, add:

```ts
const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
const [portalSourceStatusText, setPortalSourceStatusText] = useState(
  "Open a source to inspect evidence and provenance",
);
```

When `submitPortalPrompt` starts a new run, clear `selectedSourceId` and reset `portalSourceStatusText`.

- [ ] **Step 2: Add `openSource`**

Add this function inside `AgentPortalInterface`, after `openDataRecord`:

```ts
async function openSource(source: PortalSource): Promise<void> {
  setSelectedSourceId(source.id);
  if (!source.runId) {
    setPortalSourceStatusText("Local demo source - no API module run is connected");
    return;
  }

  const runId = source.runId;
  if (portalRunDetails[runId]) {
    setPortalDetailStates((current) => ({ ...current, [runId]: "ready" }));
    setPortalSourceStatusText(`Loaded evidence for ${source.label}`);
    return;
  }

  setPortalDetailStates((current) => ({ ...current, [runId]: "loading" }));
  setPortalSourceStatusText(`Loading evidence for ${source.label}`);

  try {
    const response = await fetch(`/api/module-runs/${encodeURIComponent(runId)}`);
    if (!response.ok) throw new Error(`Module run detail API returned ${response.status}`);
    const data = (await response.json()) as unknown;
    if (!isPortalModuleRunDetail(data)) {
      throw new Error("Module run detail API returned unexpected shape");
    }

    setPortalRunDetails((current) => ({ ...current, [runId]: data }));
    setPortalDetailStates((current) => ({
      ...current,
      [runId]: data.artifacts.length > 0 || data.events.length > 0 ? "ready" : "empty",
    }));
    setPortalSourceStatusText(`Loaded evidence for ${source.label}`);
  } catch {
    setPortalDetailStates((current) => ({ ...current, [runId]: "failed" }));
    setPortalSourceStatusText(`Evidence API failed for ${source.label}`);
  }
}
```

This intentionally mirrors `openDataRecord`; do not add a shared abstraction in this PR unless it stays very small and obvious.

- [ ] **Step 3: Pass source props**

Change the Sources route render from:

```tsx
{activeView === "sources" && <SourcesView sources={displayedSources} />}
```

to:

```tsx
{activeView === "sources" && (
  <SourcesView
    sources={displayedSources}
    selectedSourceId={selectedSourceId}
    detailStates={portalDetailStates}
    runDetails={portalRunDetails}
    selectedArtifactByRunId={selectedArtifactByRunId}
    artifactDetails={portalArtifactDetails}
    sourceStatusText={portalSourceStatusText}
    onOpenSource={openSource}
    onOpenArtifact={openArtifact}
  />
)}
```

- [ ] **Step 4: Verify typecheck**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: PASS.

## Task 3: Render Evidence Drawer

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Update source cards**

Change `SourcesView` props to accept the values passed in Task 2.

Each source card should:

- Add `active` class when selected.
- Render a button:

```tsx
<button
  type="button"
  aria-label={`Inspect evidence for ${source.label}`}
  onClick={() => void onOpenSource(source)}
>
  Inspect evidence
</button>
```

- [ ] **Step 2: Add `PortalSourceEvidenceDrawer`**

Add a component below `SourcesView`:

```tsx
function PortalSourceEvidenceDrawer({
  source,
  detail,
  detailState,
  selectedArtifactId,
  artifactDetails,
  onOpenArtifact,
}: {
  source: PortalSource | null;
  detail: PortalModuleRunDetail | null;
  detailState: PortalDetailState;
  selectedArtifactId: string | undefined;
  artifactDetails: Record<string, PortalArtifact>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  if (!source) {
    return <aside className="portal-source-drawer"><p>Select a source to inspect evidence.</p></aside>;
  }
  if (!source.runId) {
    return (
      <aside className="portal-source-drawer">
        <span className="portal-kicker">Local evidence</span>
        <strong>{source.evidenceTitle}</strong>
        <p>{source.evidenceDetail}</p>
        <em>{source.step} · {source.freshness}</em>
      </aside>
    );
  }
  if (detailState === "loading") return <aside className="portal-source-drawer"><p>Loading source evidence...</p></aside>;
  if (detailState === "failed") return <aside className="portal-source-drawer"><p>Evidence API failed for this source.</p></aside>;
  if (!detail) return <aside className="portal-source-drawer"><p>Open this source to load evidence.</p></aside>;

  const selectedArtifact = selectedArtifactId
    ? artifactDetails[selectedArtifactId] ?? detail.artifacts.find((artifact) => artifact.id === selectedArtifactId)
    : null;
  const artifactPreview = selectedArtifact?.contentText ?? (selectedArtifact
    ? JSON.stringify(selectedArtifact.contentJson ?? selectedArtifact.provenance ?? {}, null, 2)
    : null);

  return (
    <aside className="portal-source-drawer">
      <span className="portal-kicker">API evidence</span>
      <strong>{source.evidenceTitle}</strong>
      <p>{detail.run.summary ?? source.evidenceDetail}</p>
      <div className="portal-source-evidence-grid">
        <div>
          <em>Provenance events</em>
          {detail.events.length === 0 ? <p>No events stored yet.</p> : detail.events.map((event) => (
            <span key={event.id}>{event.severity}: {event.title ?? event.eventType}</span>
          ))}
        </div>
        <div>
          <em>Evidence artifacts</em>
          {detail.artifacts.length === 0 ? <p>No artifacts stored yet.</p> : detail.artifacts.map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              className={selectedArtifactId === artifact.id ? "active" : ""}
              onClick={() => void onOpenArtifact(source.runId!, artifact)}
            >
              {artifact.title}
            </button>
          ))}
        </div>
      </div>
      {detailState === "empty" && <p>No evidence records were stored for this module run yet.</p>}
      {artifactPreview && <pre className="portal-artifact-preview">{artifactPreview}</pre>}
    </aside>
  );
}
```

Prefer a local `const runId = source.runId` before rendering artifact buttons instead of using non-null assertions if that fits the existing code style.

- [ ] **Step 3: Render status and drawer in `SourcesView`**

After `.portal-source-grid`, render:

```tsx
<p className="portal-action-status-text">{sourceStatusText}</p>
<PortalSourceEvidenceDrawer ... />
```

- [ ] **Step 4: Add CSS**

Add compact styles for:

- `.portal-source-card.active`
- `.portal-source-card button`
- `.portal-source-drawer`
- `.portal-source-evidence-grid`
- `.portal-source-evidence-grid button`

Reuse the existing `.portal-artifact-preview` for preview content. Keep `border-radius: 8px`, text wrapping, and mobile-safe layout.

- [ ] **Step 5: Verify build**

Run:

```powershell
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
```

Expected: PASS.

## Task 4: Status, Browser Smoke, PR

**Files:**

- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Update project status**

Record:

- PR #18 merged at merge commit `46feecf`.
- Branch `codex/portal-source-evidence-drawer` is the next frontend Portal source evidence slice.
- Portal Sources can open local evidence details and API-backed source evidence drawers.

- [ ] **Step 2: Run diff check**

Run:

```powershell
git diff --check
```

Expected: PASS, ignoring known CRLF warnings.

- [ ] **Step 3: Browser smoke**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Verify:

- Portal opens with token.
- Sources view renders `Inspect evidence` buttons with record-specific accessible names.
- Clicking a local demo source opens the local evidence drawer.
- Chat/Steps/Data/Sources/Result still render.
- Admin token dialog still opens.
- Browser console has no warnings/errors from this Portal flow.

- [ ] **Step 4: Commit and PR**

After checks pass:

```powershell
git status --short
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-source-evidence-drawer.md .hermes/project-status.md
git commit -m "Add Portal source evidence drawer"
git push -u origin codex/portal-source-evidence-drawer
gh pr create --title "Add Portal source evidence drawer" --body "<summary and checks>"
```

## Self-Review Checklist

- Spec coverage: Sources can open local source evidence and API-backed run evidence/artifact previews when available.
- Scope coverage: only Portal mockup, status doc, and this plan file change.
- Safety: no secrets, sibling repo reads, external tool execution, backend changes, or generated client changes.
- API safety: all fetched JSON uses existing guarded module-run/artifact detail shapes before render.
- UI: drawer is compact, mobile-safe, and does not block Chat/Steps/Data/Result.
- Verification: typecheck, build, diff check, and browser smoke pass before commit/PR.
