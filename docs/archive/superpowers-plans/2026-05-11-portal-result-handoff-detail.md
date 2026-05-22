# Portal Result Handoff Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let frontstage Portal users inspect the final Agent handoff/result package from the Result page, including API-backed `rag_to_agent` run details and artifacts when available.

**Architecture:** This is a frontend-only continuation of the Portal data/source drawers. `AgentPortalInterface.tsx` already has guarded module-run/artifact detail fetching; this PR adds result-specific handoff cards, selection state, and a compact result detail drawer. Local demo mode shows a local handoff package; API-backed mode prefers the `rag_to_agent` module run and can load existing module-run events/artifacts.

**Tech Stack:** React + TypeScript, browser `fetch`, existing mockup sandbox CSS, existing Portal detail guard helpers.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-portal-result-handoff-detail.md`

Out of scope:

- No backend/API/server changes.
- No OpenAPI or generated client changes.
- No sibling repository reads or execution.
- No external adapter/CLI/process/HTTP service execution.
- No publish/deploy mutation; this PR is read-only result inspection.

## Data Contract

Add frontend-only types:

```ts
type PortalResultItemKind = "agent_config" | "memory" | "source_package" | "handoff";

interface PortalResultItem {
  id: string;
  kind: PortalResultItemKind;
  title: string;
  moduleId?: ModuleId;
  runId?: string;
  status: string;
  summary: string;
  detail: string;
}
```

Extend `PortalRunUiState`:

```ts
interface PortalRunUiState {
  resultItems: PortalResultItem[];
}
```

Local demo result items:

```ts
const resultItems: PortalResultItem[] = [
  {
    id: "local-agent-config",
    kind: "agent_config",
    title: "Support agent draft",
    moduleId: "rag_to_agent",
    status: "Waiting for approval",
    summary: "Draft prompt, tool policy, and handoff notes are ready for review.",
    detail: "Generated from the indexed onboarding collection and waiting on the final approval step.",
  },
  {
    id: "local-memory",
    kind: "memory",
    title: "Onboarding RAG memory",
    moduleId: "md_to_rag",
    status: "Indexing",
    summary: "96 of 124 chunks are ready for retrieval.",
    detail: "The published Agent will answer from this collection once indexing and validation complete.",
  },
];
```

API result item mapping:

```ts
const resultItems = response.moduleRuns
  .filter((run) => run.moduleId === "rag_to_agent" || run.outputJson)
  .map((run) => {
    const step = modulePortalLabels[run.moduleId];
    return {
      id: `api-result-${run.id}`,
      kind: run.moduleId === "rag_to_agent" ? "agent_config" : "handoff",
      title: run.title ?? step.label,
      moduleId: run.moduleId,
      runId: run.id,
      status: run.status,
      summary: run.summary ?? metadataString(run.metadata, "action", step.fallbackSummary),
      detail: run.outputJson
        ? JSON.stringify(run.outputJson, null, 2)
        : metadataString(run.metadata, "adapterReadinessHint", "Open details to inspect final run artifacts."),
    };
  });
```

If the API mapping produces no result items, create one fallback item from the pipeline run.

## Task 1: Add Result Handoff Data

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add result item types**

Add `PortalResultItemKind` and `PortalResultItem` near existing Portal data interfaces.

- [ ] **Step 2: Add local `resultItems`**

Add the local `resultItems` constant near `readiness`, using the two local items from Data Contract.

- [ ] **Step 3: Extend `PortalRunUiState`**

Add:

```ts
resultItems: PortalResultItem[];
```

- [ ] **Step 4: Map API result items**

In `toPortalUiState`, build `resultItems` using the Data Contract mapping and return it:

```ts
return { response, steps, messages, dataRecords, sources, readiness, resultItems };
```

If `response.moduleRuns.filter(...)` produces an empty array, use:

```ts
const resultItems: PortalResultItem[] = [
  {
    id: `api-result-${response.pipelineRun.id}`,
    kind: "handoff",
    title: response.pipelineRun.title,
    status: response.pipelineRun.status,
    summary: response.agentMessage.content,
    detail: response.plan.summary,
  },
];
```

- [ ] **Step 5: Verify typecheck**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: PASS.

## Task 2: Add Result Selection And Fetch Reuse

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add result state**

Inside `AgentPortalInterface`, add:

```ts
const [selectedResultItemId, setSelectedResultItemId] = useState<string | null>(null);
const [portalResultStatusText, setPortalResultStatusText] = useState(
  "Open a result item to inspect handoff details",
);
```

When `submitPortalPrompt` starts a new run, clear `selectedResultItemId` and reset `portalResultStatusText`.

- [ ] **Step 2: Add displayed result items**

Add:

```ts
const displayedResultItems = latestPortalRun?.resultItems ?? resultItems;
```

- [ ] **Step 3: Add `openResultItem`**

Add this function inside `AgentPortalInterface`:

```ts
async function openResultItem(item: PortalResultItem): Promise<void> {
  setSelectedResultItemId(item.id);
  if (!item.runId) {
    setPortalResultStatusText("Local demo result - no API module run is connected");
    return;
  }

  const runId = item.runId;
  if (portalRunDetails[runId]) {
    setPortalDetailStates((current) => ({ ...current, [runId]: "ready" }));
    setPortalResultStatusText(`Loaded result details for ${item.title}`);
    return;
  }

  setPortalDetailStates((current) => ({ ...current, [runId]: "loading" }));
  setPortalResultStatusText(`Loading result details for ${item.title}`);

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
    setPortalResultStatusText(`Loaded result details for ${item.title}`);
  } catch {
    setPortalDetailStates((current) => ({ ...current, [runId]: "failed" }));
    setPortalResultStatusText(`Result detail API failed for ${item.title}`);
  }
}
```

- [ ] **Step 4: Pass result props**

Update the Result route render to pass:

- `resultItems={displayedResultItems}`
- `selectedResultItemId={selectedResultItemId}`
- `detailStates={portalDetailStates}`
- `runDetails={portalRunDetails}`
- `selectedArtifactByRunId={selectedArtifactByRunId}`
- `artifactDetails={portalArtifactDetails}`
- `resultStatusText={portalResultStatusText}`
- `onOpenResultItem={openResultItem}`
- `onOpenArtifact={(runId, artifact) => openArtifact(runId, artifact, "result")}`

This step requires extending `openArtifact` status target to include `"result"` and update `portalResultStatusText` on result artifact failure.

- [ ] **Step 5: Verify typecheck**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: PASS.

## Task 3: Render Result Detail Drawer

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Update `ResultView` props**

`ResultView` should receive the props from Task 2.

- [ ] **Step 2: Render handoff cards**

Below `.portal-result-panel`, render:

```tsx
<div className="portal-result-handoff-grid">
  {resultItems.map((item) => (
    <article key={item.id} className={selectedResultItemId === item.id ? "portal-result-card active" : "portal-result-card"}>
      <span>{item.kind.replace("_", " ")}</span>
      <strong>{item.title}</strong>
      <p>{item.summary}</p>
      <em>{item.status}</em>
      <button
        type="button"
        aria-label={`Inspect result handoff for ${item.title}`}
        onClick={() => void onOpenResultItem(item)}
      >
        Inspect result
      </button>
    </article>
  ))}
</div>
<p className="portal-action-status-text">{resultStatusText}</p>
```

- [ ] **Step 3: Add `PortalResultDetailDrawer`**

Add a component near `ResultView`:

```tsx
function PortalResultDetailDrawer({
  item,
  detail,
  detailState,
  selectedArtifactId,
  artifactDetails,
  onOpenArtifact,
}: {
  item: PortalResultItem | null;
  detail: PortalModuleRunDetail | null;
  detailState: PortalDetailState;
  selectedArtifactId: string | undefined;
  artifactDetails: Record<string, PortalArtifact>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => Promise<void>;
}) {
  if (!item) return <aside className="portal-result-drawer"><p>Select a result item to inspect handoff details.</p></aside>;
  if (!item.runId) {
    return (
      <aside className="portal-result-drawer">
        <span className="portal-kicker">Local handoff</span>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
        <em>{item.status}</em>
      </aside>
    );
  }
  if (detailState === "loading") return <aside className="portal-result-drawer"><p>Loading result details...</p></aside>;
  if (detailState === "failed") return <aside className="portal-result-drawer"><p>Result detail API failed for this item.</p></aside>;
  if (!detail) return <aside className="portal-result-drawer"><p>Open this result item to load handoff artifacts.</p></aside>;

  const runId = item.runId;
  const selectedArtifact = selectedArtifactId
    ? artifactDetails[selectedArtifactId] ?? detail.artifacts.find((artifact) => artifact.id === selectedArtifactId)
    : null;
  const artifactPreview = selectedArtifact?.contentText ?? (selectedArtifact
    ? JSON.stringify(selectedArtifact.contentJson ?? selectedArtifact.provenance ?? {}, null, 2)
    : item.detail);

  return (
    <aside className="portal-result-drawer">
      <span className="portal-kicker">API handoff</span>
      <strong>{detail.run.title ?? item.title}</strong>
      <p>{detail.run.summary ?? item.summary}</p>
      <div className="portal-result-detail-grid">
        <div>
          <em>Handoff events</em>
          {detail.events.length === 0 ? <p>No events stored yet.</p> : detail.events.map((event) => (
            <span key={event.id}>{event.severity}: {event.title ?? event.eventType}</span>
          ))}
        </div>
        <div>
          <em>Result artifacts</em>
          {detail.artifacts.length === 0 ? <p>No artifacts stored yet.</p> : detail.artifacts.map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              className={selectedArtifactId === artifact.id ? "active" : ""}
              onClick={() => void onOpenArtifact(runId, artifact)}
            >
              {artifact.title}
            </button>
          ))}
        </div>
      </div>
      {detailState === "empty" && <p>No handoff records were stored for this module run yet.</p>}
      {artifactPreview && <pre className="portal-artifact-preview">{artifactPreview}</pre>}
    </aside>
  );
}
```

- [ ] **Step 4: Add CSS**

Add compact styles for:

- `.portal-result-handoff-grid`
- `.portal-result-card`
- `.portal-result-card.active`
- `.portal-result-card button`
- `.portal-result-drawer`
- `.portal-result-detail-grid`
- `.portal-result-detail-grid button`

Reuse `.portal-artifact-preview`. Keep `border-radius: 8px`, text wrapping, and mobile-safe layout.

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

- PR #19 merged at merge commit `ece66f3`.
- Branch `codex/portal-result-handoff-detail` is the next frontend Portal result handoff slice.
- Portal Result can open local handoff details and API-backed result handoff drawers.

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
- Result view renders `Inspect result` buttons with item-specific accessible names.
- Clicking a local demo result item opens the local handoff drawer.
- Chat/Steps/Data/Sources/Result still render.
- Admin token dialog still opens.
- Browser console has no warnings/errors from this Portal flow.

- [ ] **Step 4: Commit and PR**

After checks pass:

```powershell
git status --short
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-result-handoff-detail.md .hermes/project-status.md
git commit -m "Add Portal result handoff detail"
git push -u origin codex/portal-result-handoff-detail
gh pr create --title "Add Portal result handoff detail" --body "<summary and checks>"
```

## Self-Review Checklist

- Spec coverage: Result can open local result handoff details and API-backed run/artifact detail drawers when available.
- Scope coverage: only Portal mockup, status doc, and this plan file change.
- Safety: no secrets, sibling repo reads, external tool execution, backend changes, or generated client changes.
- API safety: all fetched JSON uses existing guarded module-run/artifact detail shapes before render.
- UI: drawer is compact, mobile-safe, and does not block Chat/Steps/Data/Sources.
- Verification: typecheck, build, diff check, and browser smoke pass before commit/PR.
