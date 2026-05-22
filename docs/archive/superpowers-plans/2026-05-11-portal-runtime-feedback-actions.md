# Portal Runtime Feedback Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let frontstage Portal users see Agent/tool interaction requests and submit feedback or resume API-backed module runs from the Portal.

**Architecture:** This is a frontend-only continuation after Portal runtime progress API wiring. `AgentPortalInterface.tsx` parses `metadata.interaction` from Agent Run API module runs, renders a compact interaction panel in Steps and the context rail, and calls existing `POST /api/module-runs/{runId}/feedback` and `POST /api/module-runs/{runId}/resume` when an API-backed run is available. Local demo mode remains usable and never pretends to persist server data; it shows local action status only.

**Tech Stack:** React + TypeScript in `artifacts/mockup-sandbox`, browser `fetch`, existing inline CSS, existing mockup sandbox typecheck/build/browser-smoke workflow.

---

## Scope

Files in scope:

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `.hermes/project-status.md`
- Create: `docs/superpowers/plans/2026-05-11-portal-runtime-feedback-actions.md`

Out of scope:

- No backend/API/server changes.
- No OpenAPI or generated API client changes.
- No real external adapter, CLI, process, HTTP service, or sibling repository calls from the frontend.
- No plaintext key entry or secret persistence.
- No new portal authentication model.
- No full feedback history page; this PR only adds current interaction actions to existing Portal views.

## Data Contract

Add local frontend types to `AgentPortalInterface.tsx`; do not import generated clients:

```ts
type PortalInteractionStatus =
  | "waiting_for_user"
  | "waiting_for_approval"
  | "waiting_for_data"
  | "blocked"
  | "resumable"
  | "resumed";

type PortalActionState = "idle" | "submitting" | "succeeded" | "failed";

interface PortalInteractionOption {
  id: string;
  label: string;
  value?: unknown;
}

interface PortalToolInteraction {
  interactionId: string;
  status: PortalInteractionStatus;
  kind: "question" | "approval" | "data_request" | "blocked";
  title: string;
  message: string;
  prompt: string | null;
  options: PortalInteractionOption[];
  artifactIds: string[];
  resumeHandle: string | null;
  requestedAt: string;
  metadata: JsonObject;
}

interface PortalToolInteractionApiResponse {
  run: PortalAgentRunApiModuleRun;
  interaction: PortalToolInteraction;
}
```

Extend `PortalStep`:

```ts
interface PortalStep {
  runId?: string;
  externalRunId?: string;
  interaction?: PortalToolInteraction;
}
```

Add state in `AgentPortalInterface`:

```ts
const [portalActionStates, setPortalActionStates] = useState<Record<string, PortalActionState>>({});
const [portalActionStatusText, setPortalActionStatusText] = useState(
  "Feedback actions are local until API run data is available",
);
const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
const [selectedInteractionOptions, setSelectedInteractionOptions] =
  useState<Record<string, string>>({});
```

## Mapping Rules

Interaction status labels:

- `waiting_for_user` -> `Needs reply`
- `waiting_for_approval` -> `Approval`
- `waiting_for_data` -> `Needs data`
- `blocked` -> `Blocked`
- `resumable` -> `Resume ready`
- `resumed` -> `Resumed`

Portal step status mapping:

- `run.status === "succeeded"` -> `complete`
- `run.status === "failed" || run.status === "cancelled"` -> `blocked`
- `interaction.status === "blocked"` -> `blocked`
- `interaction.status === "resumed"` -> `running`
- any other interaction status -> `waiting`
- `run.status === "running"` -> `running`
- default -> `waiting`

Feedback payload:

```ts
{
  responseText,
  selectedOptionId,
  approved,
  artifactIds: [],
  resumeHandle: interaction.resumeHandle ?? undefined,
  metadata: { source: "agent-portal", interactionKind: interaction.kind }
}
```

## Task 1: Parse And Display Interactions

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add interaction types**

Add the types from the Data Contract near existing Portal API types.

- [ ] **Step 2: Add parser helpers**

Add helpers near existing API guards:

```ts
function isPortalInteractionStatus(value: unknown): value is PortalInteractionStatus {
  return (
    value === "waiting_for_user" ||
    value === "waiting_for_approval" ||
    value === "waiting_for_data" ||
    value === "blocked" ||
    value === "resumable" ||
    value === "resumed"
  );
}

function isPortalInteractionKind(value: unknown): value is PortalToolInteraction["kind"] {
  return (
    value === "question" ||
    value === "approval" ||
    value === "data_request" ||
    value === "blocked"
  );
}

function isPortalInteractionOption(value: unknown): value is PortalInteractionOption {
  if (!isJsonObject(value)) return false;
  return typeof value["id"] === "string" && typeof value["label"] === "string";
}

function parsePortalToolInteraction(metadata: JsonObject | null): PortalToolInteraction | null {
  const value = metadata?.["interaction"];
  if (!isJsonObject(value)) return null;
  if (
    typeof value["interactionId"] !== "string" ||
    !isPortalInteractionStatus(value["status"]) ||
    !isPortalInteractionKind(value["kind"]) ||
    typeof value["title"] !== "string" ||
    typeof value["message"] !== "string" ||
    typeof value["requestedAt"] !== "string"
  ) {
    return null;
  }

  return {
    interactionId: value["interactionId"],
    status: value["status"],
    kind: value["kind"],
    title: value["title"],
    message: value["message"],
    prompt: typeof value["prompt"] === "string" ? value["prompt"] : null,
    options: Array.isArray(value["options"])
      ? value["options"].filter(isPortalInteractionOption)
      : [],
    artifactIds: Array.isArray(value["artifactIds"])
      ? value["artifactIds"].filter((item): item is string => typeof item === "string")
      : [],
    resumeHandle: typeof value["resumeHandle"] === "string" ? value["resumeHandle"] : null,
    requestedAt: value["requestedAt"],
    metadata: isJsonObject(value["metadata"]) ? value["metadata"] : {},
  };
}
```

- [ ] **Step 3: Add label helpers**

Add:

```ts
function interactionStatusText(status: PortalInteractionStatus): string {
  if (status === "waiting_for_approval") return "Approval";
  if (status === "waiting_for_data") return "Needs data";
  if (status === "waiting_for_user") return "Needs reply";
  if (status === "blocked") return "Blocked";
  if (status === "resumable") return "Resume ready";
  return "Resumed";
}

function isFeedbackReadyInteraction(interaction: PortalToolInteraction): boolean {
  return (
    interaction.status === "waiting_for_user" ||
    interaction.status === "waiting_for_approval" ||
    interaction.status === "waiting_for_data" ||
    interaction.status === "blocked"
  );
}
```

- [ ] **Step 4: Attach parsed interaction to API steps**

Update `portalStatusFromApiRun` to use `parsePortalToolInteraction(run.metadata)` and the Mapping Rules.

Update `toPortalStepFromApiRun` so each API-backed step includes:

```ts
runId: run.id,
externalRunId: run.externalRunId,
interaction: parsePortalToolInteraction(run.metadata) ?? undefined,
```

If a step has an interaction and no `run.summary`, set the summary to `interaction.message`.

- [ ] **Step 5: Add a local demo interaction**

Add a waiting approval interaction to the static `Generate Agent` fixture step:

```ts
interaction: {
  interactionId: "demo-agent-approval",
  status: "waiting_for_approval",
  kind: "approval",
  title: "Approve final agent draft",
  message: "Review the generated prompt and tool policy before the published agent is unlocked.",
  prompt: "Approve this draft for publish?",
  options: [
    { id: "approve", label: "Approve" },
    { id: "revise", label: "Request revision" },
  ],
  artifactIds: [],
  resumeHandle: "demo-agent-approval:resume",
  requestedAt: new Date(0).toISOString(),
  metadata: { source: "local-demo" },
}
```

This keeps the offline mockup demonstrable; local actions must remain labeled as local status only.

- [ ] **Step 6: Verify TypeScript**

Run: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck`

Expected: PASS.

## Task 2: Feedback And Resume Actions

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add action state**

Add the state from Data Contract inside `AgentPortalInterface`.

Clear `portalActionStates`, `feedbackDrafts`, and `selectedInteractionOptions` when `submitPortalPrompt` starts a new Agent Run.

- [ ] **Step 2: Add API response guard**

Add:

```ts
function isPortalToolInteractionApiResponse(value: unknown): value is PortalToolInteractionApiResponse {
  if (!isJsonObject(value)) return false;
  return (
    isPortalAgentRunApiModuleRun(value["run"]) &&
    isJsonObject(value["interaction"]) &&
    parsePortalToolInteraction({ interaction: value["interaction"] }) !== null
  );
}
```

- [ ] **Step 3: Add run update helper**

Inside `AgentPortalInterface`, add:

```ts
function updatePortalRunFromModuleRun(run: PortalAgentRunApiModuleRun): void {
  setLatestPortalRun((current) => {
    if (!current) return current;
    const response: PortalAgentRunApiResponse = {
      ...current.response,
      moduleRuns: current.response.moduleRuns.map((item) =>
        item.id === run.id ? run : item,
      ),
    };
    return toPortalUiState(response);
  });
}
```

- [ ] **Step 4: Add `submitStepFeedback`**

Add:

```ts
async function submitStepFeedback(step: PortalStep, approved?: boolean): Promise<void> {
  const interaction = step.interaction;
  if (!interaction || portalActionStates[step.id] === "submitting") return;

  if (!latestPortalRun || !step.runId) {
    setPortalActionStates((current) => ({ ...current, [step.id]: "succeeded" }));
    setPortalActionStatusText("Local demo feedback captured - no API run is connected");
    return;
  }

  const responseText = feedbackDrafts[step.id]?.trim();
  const selectedOptionId = selectedInteractionOptions[step.id];
  setPortalActionStates((current) => ({ ...current, [step.id]: "submitting" }));
  setPortalActionStatusText(`Submitting feedback for ${step.label}`);

  try {
    const response = await fetch(`/api/module-runs/${encodeURIComponent(step.runId)}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responseText: responseText || undefined,
        selectedOptionId,
        approved,
        artifactIds: [],
        resumeHandle: interaction.resumeHandle ?? undefined,
        metadata: { source: "agent-portal", interactionKind: interaction.kind },
      }),
    });

    if (!response.ok) throw new Error(`Feedback API returned ${response.status}`);
    const data = (await response.json()) as unknown;
    if (!isPortalToolInteractionApiResponse(data)) {
      throw new Error("Feedback API returned unexpected shape");
    }

    updatePortalRunFromModuleRun(data.run);
    setPortalActionStates((current) => ({ ...current, [step.id]: "succeeded" }));
    setPortalActionStatusText(`Feedback saved for ${step.label}; resume is ready when available`);
  } catch {
    setPortalActionStates((current) => ({ ...current, [step.id]: "failed" }));
    setPortalActionStatusText(`Feedback API failed for ${step.label}`);
  }
}
```

- [ ] **Step 5: Add `resumeStepRun`**

Add:

```ts
async function resumeStepRun(step: PortalStep): Promise<void> {
  if (!step.interaction || portalActionStates[step.id] === "submitting") return;

  if (!latestPortalRun || !step.runId) {
    setPortalActionStates((current) => ({ ...current, [step.id]: "succeeded" }));
    setPortalActionStatusText("Local demo resume requested - no API run is connected");
    return;
  }

  setPortalActionStates((current) => ({ ...current, [step.id]: "submitting" }));
  setPortalActionStatusText(`Resuming ${step.label}`);

  try {
    const response = await fetch(`/api/module-runs/${encodeURIComponent(step.runId)}/resume`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(`Resume API returned ${response.status}`);
    const data = (await response.json()) as unknown;
    if (!isPortalToolInteractionApiResponse(data)) {
      throw new Error("Resume API returned unexpected shape");
    }

    updatePortalRunFromModuleRun(data.run);
    setPortalActionStates((current) => ({ ...current, [step.id]: "succeeded" }));
    setPortalActionStatusText(`Resume submitted for ${step.label}`);
  } catch {
    setPortalActionStates((current) => ({ ...current, [step.id]: "failed" }));
    setPortalActionStatusText(`Resume API failed for ${step.label}`);
  }
}
```

- [ ] **Step 6: Verify TypeScript**

Run: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck`

Expected: PASS.

## Task 3: Render Interaction Panel

**Files:**

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [ ] **Step 1: Add `PortalInteractionPanel` component**

Add a component near the Portal child views:

```tsx
function PortalInteractionPanel({
  step,
  actionState,
  draft,
  selectedOptionId,
  onDraftChange,
  onSelectedOptionChange,
  onSubmitFeedback,
  onResume,
}: {
  step: PortalStep;
  actionState: PortalActionState;
  draft: string;
  selectedOptionId: string | undefined;
  onDraftChange: (value: string) => void;
  onSelectedOptionChange: (value: string) => void;
  onSubmitFeedback: (approved?: boolean) => void;
  onResume: () => void;
}) {
  const interaction = step.interaction;
  if (!interaction) return null;
  const isBusy = actionState === "submitting";
  const canSubmitFeedback = isFeedbackReadyInteraction(interaction);
  const canResume = interaction.status === "resumable";

  return (
    <div className="portal-interaction-panel">
      <div className="portal-interaction-heading">
        <span>{interactionStatusText(interaction.status)}</span>
        <strong>{interaction.title}</strong>
      </div>
      <p>{interaction.message}</p>
      {interaction.prompt && <em>{interaction.prompt}</em>}
      {interaction.options.length > 0 && (
        <div className="portal-option-row" aria-label={`${step.label} options`}>
          {interaction.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={selectedOptionId === option.id ? "active" : ""}
              onClick={() => onSelectedOptionChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {canSubmitFeedback && (
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Reply for this step..."
          rows={2}
        />
      )}
      <div className="portal-interaction-actions">
        {interaction.kind === "approval" && canSubmitFeedback && (
          <button type="button" disabled={isBusy} onClick={() => onSubmitFeedback(true)}>
            Approve
          </button>
        )}
        {canSubmitFeedback && (
          <button type="button" disabled={isBusy} onClick={() => onSubmitFeedback(false)}>
            Send feedback
          </button>
        )}
        {canResume && (
          <button type="button" disabled={isBusy} onClick={onResume}>
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire panel into `StepsView`**

Pass action props into `StepsView`:

- `portalActionStates`
- `feedbackDrafts`
- `selectedInteractionOptions`
- `portalActionStatusText`
- `onFeedbackDraftChange`
- `onSelectedInteractionOptionChange`
- `onSubmitStepFeedback`
- `onResumeStepRun`

Inside each `portal-step-card`, render `PortalInteractionPanel` when `step.interaction` exists.

Render `portalActionStatusText` under the API plan panel.

- [ ] **Step 3: Wire panel into context rail**

Under current step status, render `PortalInteractionPanel` for `activeStepRecord` with the same handlers. This gives phone users an obvious current-step action without needing to scan the full step grid.

- [ ] **Step 4: Add CSS**

Add styles:

```css
.portal-interaction-panel { ... }
.portal-interaction-heading { ... }
.portal-option-row { ... }
.portal-option-row button.active { ... }
.portal-interaction-panel textarea { ... }
.portal-interaction-actions { ... }
.portal-interaction-actions button { ... }
.portal-action-status-text { ... }
```

Use compact panels, `border-radius: 8px`, existing colors, and no nested page-section cards. Make sure text wraps on mobile.

- [ ] **Step 5: Verify build**

Run:

```powershell
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
```

Expected: PASS.

## Task 4: Status, Browser Smoke, Commit, PR

**Files:**

- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Update project status**

Record:

- PR #16 merged at merge commit `c2deba0`.
- Branch `codex/portal-runtime-feedback-actions` is the next frontend Portal feedback slice.
- Portal now parses interaction metadata, renders feedback/resume controls, and calls existing feedback/resume endpoints only when API-backed run data exists.
- Local demo actions remain local status only.

- [ ] **Step 2: Run diff check**

Run: `git diff --check`

Expected: PASS, ignoring CRLF warnings already known on this Windows workspace.

- [ ] **Step 3: Browser smoke**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Verify:

- Portal opens with token.
- Steps view shows the local demo interaction on Generate Agent.
- Selecting an option and clicking `Approve` or `Send feedback` updates action status without a backend API.
- Chat/Data/Sources/Result still render.
- Admin token dialog still opens.
- Browser console has no warnings/errors from this Portal flow.

- [ ] **Step 4: Commit and PR**

After required checks pass:

```powershell
git status --short
git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx docs/superpowers/plans/2026-05-11-portal-runtime-feedback-actions.md .hermes/project-status.md
git commit -m "Add Portal runtime feedback actions"
git push -u origin codex/portal-runtime-feedback-actions
```

Open a PR titled `Add Portal runtime feedback actions`.

## Self-Review Checklist

- Spec coverage: Portal users can see interaction requests, submit feedback, and resume when API-backed run data is available.
- Scope coverage: only Portal mockup, status doc, and this plan file change.
- Safety: no secrets, no sibling repo reads, no external tool execution, no backend route changes.
- API safety: feedback/resume responses are guarded before rendering.
- UI: interaction panel is compact, mobile-safe, and does not replace existing Chat/Steps/Data/Sources/Result flows.
- Verification: typecheck, build, diff check, and browser smoke are required before commit/PR.
