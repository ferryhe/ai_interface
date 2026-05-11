# Portal Artifact Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let frontstage Portal users open API-backed module-run details and inspect stored artifacts/events from the Data page.

**Architecture:** This is a frontend-only slice in `AgentPortalInterface.tsx`. The Portal already receives module run ids from `POST /api/agent-runs`; this PR adds guarded fetches to existing `GET /api/module-runs/{runId}` and `GET /api/artifacts/{artifactId}` endpoints, then renders a compact detail drawer under the Data list. Local demo records remain local and never imply server persistence.

**Tech Stack:** React + TypeScript, browser `fetch`, existing mockup sandbox CSS, existing API JSON shapes validated by local type guards.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-portal-artifact-detail-drawer.md`

Out of scope:

- No backend/API/server changes.
- No OpenAPI or generated client changes.
- No sibling repository reads or execution.
- No external adapter/CLI/process/HTTP service execution.
- No persistent portal auth change.
- No full artifact editor; this PR is read-only display.

## Data Contract

Add frontend-only types near the existing Portal API types:

```ts
type PortalDetailState = "idle" | "loading" | "ready" | "empty" | "failed";

interface PortalRunEvent {
  id: string;
  moduleRunId: string;
  eventType: string;
  title: string | null;
  message: string | null;
  severity: "info" | "warning" | "error";
  payload: JsonObject | null;
  createdAt: string;
}

interface PortalArtifact {
  id: string;
  artifactKind: string;
  title: string;
  contentText: string | null;
  contentJson: JsonObject | null;
  sourceModuleId: ModuleId;
  sourceRunId: string;
  parentArtifactId: string | null;
  provenance: JsonObject | null;
  createdAt: string;
  updatedAt: string;
}

interface PortalModuleRunDetail {
  run: PortalAgentRunApiModuleRun;
  events: PortalRunEvent[];
  artifacts: PortalArtifact[];
}
```

Extend `PortalDataRecord`:

```ts
interface PortalDataRecord {
  runId?: string;
  artifactId?: string;
}
```

## Task 1: Guard API Detail Shapes

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Extend data records with run/artifact ids**

Add `runId?: string` and `artifactId?: string` to `PortalDataRecord`.

In `toPortalUiState`, set API data records as:

```ts
id: `api-data-${run.id}`,
runId: run.id,
```

Keep local demo records without `runId`.

- [ ] **Step 2: Add event/artifact/detail types**

Add the types from the Data Contract near existing Portal API types.

- [ ] **Step 3: Add guarded parsers**

Add helpers near the existing API guards:

```ts
function isPortalRunEvent(value: unknown): value is PortalRunEvent {
  if (!isJsonObject(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["moduleRunId"] === "string" &&
    typeof value["eventType"] === "string" &&
    (value["title"] === null || typeof value["title"] === "string") &&
    (value["message"] === null || typeof value["message"] === "string") &&
    (value["severity"] === "info" || value["severity"] === "warning" || value["severity"] === "error") &&
    (value["payload"] === null || isJsonObject(value["payload"])) &&
    typeof value["createdAt"] === "string"
  );
}

function isPortalArtifact(value: unknown): value is PortalArtifact {
  if (!isJsonObject(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["artifactKind"] === "string" &&
    typeof value["title"] === "string" &&
    (value["contentText"] === null || typeof value["contentText"] === "string") &&
    (value["contentJson"] === null || isJsonObject(value["contentJson"])) &&
    isModuleId(value["sourceModuleId"]) &&
    typeof value["sourceRunId"] === "string" &&
    (value["parentArtifactId"] === null || typeof value["parentArtifactId"] === "string") &&
    (value["provenance"] === null || isJsonObject(value["provenance"])) &&
    typeof value["createdAt"] === "string" &&
    typeof value["updatedAt"] === "string"
  );
}

function isPortalModuleRunDetail(value: unknown): value is PortalModuleRunDetail {
  if (!isJsonObject(value)) return false;
  return (
    isPortalAgentRunApiModuleRun(value["run"]) &&
    Array.isArray(value["events"]) &&
    value["events"].every(isPortalRunEvent) &&
    Array.isArray(value["artifacts"]) &&
    value["artifacts"].every(isPortalArtifact)
  );
}
```

If `isModuleId` does not already exist, add:

```ts
function isModuleId(value: unknown): value is ModuleId {
  return (
    value === "web_listening" ||
    value === "doc_to_md" ||
    value === "md_to_rag" ||
    value === "rag_to_agent"
  );
}
```

- [ ] **Step 4: Verify typecheck**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: PASS.

## Task 2: Fetch Run Details And Artifact Details

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add detail state**

Inside `AgentPortalInterface`, add:

```ts
const [selectedDataRecordId, setSelectedDataRecordId] = useState<string | null>(null);
const [portalDetailStates, setPortalDetailStates] = useState<Record<string, PortalDetailState>>({});
const [portalRunDetails, setPortalRunDetails] = useState<Record<string, PortalModuleRunDetail>>({});
const [selectedArtifactByRunId, setSelectedArtifactByRunId] = useState<Record<string, string>>({});
const [portalArtifactDetails, setPortalArtifactDetails] = useState<Record<string, PortalArtifact>>({});
const [portalDetailStatusText, setPortalDetailStatusText] = useState(
  "Open a data record to inspect stored module artifacts",
);
```

When `submitPortalPrompt` starts a new run, clear all detail state and reset the status text.

- [ ] **Step 2: Add `openDataRecord`**

Add:

```ts
async function openDataRecord(record: PortalDataRecord): Promise<void> {
  setSelectedDataRecordId(record.id);
  if (!record.runId) {
    setPortalDetailStatusText("Local demo record - no API module run is connected");
    return;
  }
  if (portalRunDetails[record.runId]) {
    setPortalDetailStates((current) => ({ ...current, [record.runId]: "ready" }));
    setPortalDetailStatusText(`Loaded details for ${record.title}`);
    return;
  }

  setPortalDetailStates((current) => ({ ...current, [record.runId!]: "loading" }));
  setPortalDetailStatusText(`Loading details for ${record.title}`);
  try {
    const response = await fetch(`/api/module-runs/${encodeURIComponent(record.runId)}`);
    if (!response.ok) throw new Error(`Module run detail API returned ${response.status}`);
    const data = (await response.json()) as unknown;
    if (!isPortalModuleRunDetail(data)) {
      throw new Error("Module run detail API returned unexpected shape");
    }

    setPortalRunDetails((current) => ({ ...current, [record.runId!]: data }));
    setPortalDetailStates((current) => ({
      ...current,
      [record.runId!]: data.artifacts.length > 0 || data.events.length > 0 ? "ready" : "empty",
    }));
    setPortalDetailStatusText(`Loaded details for ${record.title}`);
  } catch {
    setPortalDetailStates((current) => ({ ...current, [record.runId!]: "failed" }));
    setPortalDetailStatusText(`Detail API failed for ${record.title}`);
  }
}
```

- [ ] **Step 3: Add `openArtifact`**

Add:

```ts
async function openArtifact(runId: string, artifact: PortalArtifact): Promise<void> {
  setSelectedArtifactByRunId((current) => ({ ...current, [runId]: artifact.id }));
  if (portalArtifactDetails[artifact.id]) return;

  try {
    const response = await fetch(`/api/artifacts/${encodeURIComponent(artifact.id)}`);
    if (!response.ok) throw new Error(`Artifact API returned ${response.status}`);
    const data = (await response.json()) as unknown;
    if (!isPortalArtifact(data)) throw new Error("Artifact API returned unexpected shape");
    setPortalArtifactDetails((current) => ({ ...current, [artifact.id]: data }));
  } catch {
    setPortalDetailStatusText(`Artifact API failed for ${artifact.title}`);
  }
}
```

Do not automatically select an artifact before the user clicks it.

- [ ] **Step 4: Verify typecheck**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: PASS.

## Task 3: Render Detail Drawer

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Pass detail props to `DataView`**

Pass:

- `selectedRecordId={selectedDataRecordId}`
- `detailStates={portalDetailStates}`
- `runDetails={portalRunDetails}`
- `selectedArtifactByRunId={selectedArtifactByRunId}`
- `artifactDetails={portalArtifactDetails}`
- `detailStatusText={portalDetailStatusText}`
- `onOpenRecord={openDataRecord}`
- `onOpenArtifact={openArtifact}`

- [ ] **Step 2: Update record rows**

Change each record row to include a small button:

```tsx
<button type="button" onClick={() => void onOpenRecord(record)}>
  View details
</button>
```

Use `selectedRecordId === record.id` to add an `active` class to the row.

- [ ] **Step 3: Add `PortalDataDetailDrawer`**

Add a component below `DataView`:

```tsx
function PortalDataDetailDrawer({
  record,
  detail,
  detailState,
  selectedArtifactId,
  artifactDetails,
  onOpenArtifact,
}: {
  record: PortalDataRecord | null;
  detail: PortalModuleRunDetail | null;
  detailState: PortalDetailState;
  selectedArtifactId: string | undefined;
  artifactDetails: Record<string, PortalArtifact>;
  onOpenArtifact: (runId: string, artifact: PortalArtifact) => void;
}) {
  if (!record) {
    return <aside className="portal-detail-drawer"><p>Select a record to inspect stored data.</p></aside>;
  }
  if (!record.runId) {
    return (
      <aside className="portal-detail-drawer">
        <span className="portal-kicker">Local demo</span>
        <strong>{record.title}</strong>
        <p>{record.detail}</p>
      </aside>
    );
  }
  if (detailState === "loading") return <aside className="portal-detail-drawer"><p>Loading record details...</p></aside>;
  if (detailState === "failed") return <aside className="portal-detail-drawer"><p>Detail API failed for this record.</p></aside>;
  if (!detail) return <aside className="portal-detail-drawer"><p>Open this record to load module details.</p></aside>;

  const selectedArtifact = selectedArtifactId
    ? artifactDetails[selectedArtifactId] ?? detail.artifacts.find((artifact) => artifact.id === selectedArtifactId)
    : null;

  return (
    <aside className="portal-detail-drawer">
      <span className="portal-kicker">Module run detail</span>
      <strong>{detail.run.title ?? record.title}</strong>
      <p>{detail.run.summary ?? record.detail}</p>
      <div className="portal-detail-columns">
        <div>
          <em>Events</em>
          {detail.events.length === 0 ? <p>No events stored yet.</p> : detail.events.map((event) => (
            <span key={event.id}>{event.severity}: {event.title ?? event.eventType}</span>
          ))}
        </div>
        <div>
          <em>Artifacts</em>
          {detail.artifacts.length === 0 ? <p>No artifacts stored yet.</p> : detail.artifacts.map((artifact) => (
            <button key={artifact.id} type="button" onClick={() => onOpenArtifact(record.runId!, artifact)}>
              {artifact.title}
            </button>
          ))}
        </div>
      </div>
      {selectedArtifact && (
        <pre className="portal-artifact-preview">
          {selectedArtifact.contentText ?? JSON.stringify(selectedArtifact.contentJson ?? selectedArtifact.provenance ?? {}, null, 2)}
        </pre>
      )}
    </aside>
  );
}
```

Adjust formatting to match the existing code style and avoid non-null assertions if the surrounding implementation makes them unnecessary.

- [ ] **Step 4: Add CSS**

Add compact styles for:

- `.portal-record-row.active`
- `.portal-record-row button`
- `.portal-detail-drawer`
- `.portal-detail-columns`
- `.portal-detail-columns button`
- `.portal-artifact-preview`

Keep `border-radius: 8px`, text wrapping, and mobile-safe layout.

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

- PR #17 merged at merge commit `438ba6b`.
- Branch `codex/portal-artifact-detail-drawer` is the next frontend Portal data detail slice.
- Portal Data can open local demo details and API-backed module-run detail/artifact detail drawers.

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
- Data view renders record `View details` buttons.
- Clicking a local demo record opens the local detail drawer.
- Chat/Steps/Data/Sources/Result still render.
- Admin token dialog still opens.
- Browser console has no warnings/errors from this Portal flow.

- [ ] **Step 4: Commit and PR**

After checks pass:

```powershell
git status --short
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-artifact-detail-drawer.md .hermes/project-status.md
git commit -m "Add Portal artifact detail drawer"
git push -u origin codex/portal-artifact-detail-drawer
gh pr create --title "Add Portal artifact detail drawer" --body "<summary and checks>"
```

## Self-Review Checklist

- Spec coverage: Data view can open local demo details, API-backed run details, and artifact content when API data exists.
- Scope coverage: only Portal mockup, status doc, and this plan file change.
- Safety: no secrets, sibling repo reads, external tool execution, or backend route changes.
- API safety: all fetched JSON is shape-guarded before render.
- UI: drawer is compact, mobile-safe, and does not block Chat/Steps/Sources/Result.
- Verification: typecheck, build, diff check, and browser smoke pass before commit/PR.
