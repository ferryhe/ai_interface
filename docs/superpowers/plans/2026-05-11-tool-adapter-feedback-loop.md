# Tool Adapter Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic feedback-loop contract so any external tool, including `ai_actuary`, can pause for user approval/data/questions, record the pause in `ai_interface`, accept user feedback, and become resumable.

**Architecture:** Keep `ai_interface` as the interface/control-plane layer, not the tool implementation host. External tools continue to run in their own repos and use `ai_interface` HTTP APIs to emit events/artifacts and interaction requests. V1 stores interaction state in module-run metadata plus append-only run events, avoiding a database enum migration while still giving the UI and Agent a typed API contract.

**Tech Stack:** TypeScript, Express, Drizzle/Postgres schema already present, OpenAPI 3.1, Orval-generated Zod/React clients, `node:test`.

---

## Scope

This PR builds the backend/API contract for tool feedback loops. Frontend rendering will be a follow-up PR that consumes the generated client and shows an interaction inbox in Chat/Steps/Data.

## File Structure

- Modify `artifacts/api-server/src/modules/ingest-service.ts`
  - Add typed `ToolInteractionKind`, `ToolInteractionStatus`, interaction request/feedback inputs, and service functions.
  - Store current interaction in `ModuleRunRecord.metadata.interaction`.
  - Append events for requested interactions and submitted feedback.
- Modify `artifacts/api-server/src/modules/ingest-service.test.ts`
  - Add tests for interaction request, feedback/resume, and feedback-without-active-interaction rejection.
- Modify `artifacts/api-server/src/routes/modules.ts`
  - Add `POST /api/module-runs/{runId}/interactions`.
  - Add `POST /api/module-runs/{runId}/feedback`.
- Modify `lib/api-spec/openapi.yaml`
  - Add request/response schemas and the two public API endpoints.
- Regenerate generated API files:
  - `lib/api-zod/src/generated/api.ts`
  - `lib/api-zod/src/generated/types/*`
  - `lib/api-client-react/src/generated/api.ts`
  - `lib/api-client-react/src/generated/api.schemas.ts`
- Modify `.hermes/project-status.md`
  - Record PR #7 merge and this branch's new scope.

## Contract Semantics

Tool interaction states live in module-run metadata:

```json
{
  "interaction": {
    "interactionId": "uuid",
    "status": "waiting_for_user",
    "kind": "question",
    "title": "Choose assumption set",
    "message": "The actuarial model needs a morbidity table.",
    "prompt": "Use standard table or upload a custom one?",
    "options": [
      { "id": "standard", "label": "Use standard table" },
      { "id": "custom", "label": "Upload custom table" }
    ],
    "artifactIds": [],
    "resumeHandle": "ai-actuary/run-123/checkpoint-4",
    "requestedBy": "ai_actuary",
    "requestedAt": "2026-05-11T04:00:00.000Z",
    "metadata": {}
  }
}
```

Feedback turns the same interaction into a resumable checkpoint:

```json
{
  "interaction": {
    "interactionId": "uuid",
    "status": "resumable",
    "kind": "question",
    "resumeHandle": "ai-actuary/run-123/checkpoint-4",
    "respondedAt": "2026-05-11T04:02:00.000Z",
    "response": {
      "responseText": "Use the standard table.",
      "selectedOptionId": "standard",
      "approved": true,
      "artifactIds": [],
      "metadata": {}
    }
  }
}
```

## Tasks

### Task 1: Backend Interaction Service

**Files:**
- Modify: `artifacts/api-server/src/modules/ingest-service.ts`
- Test: `artifacts/api-server/src/modules/ingest-service.test.ts`

- [x] **Step 1: Add failing tests**

Add tests with these exact assertions:

```ts
test("records a tool interaction request and marks the run waiting", async () => {
  const repository = new InMemoryModuleRunRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: "agent-approval-001",
  });

  const result = await requestModuleRunInteraction(repository, run.id, {
    kind: "approval",
    title: "Approve agent publish",
    message: "Review generated agent permissions before continuing.",
    prompt: "Approve publishing this agent config?",
    options: [{ id: "approve", label: "Approve" }],
    resumeHandle: "rag_to_agent:agent-approval-001:publish",
    requestedBy: "rag_to_agent",
  });

  assert.equal(result.interaction.status, "waiting_for_approval");
  assert.equal(result.run.metadata?.["interaction"], result.interaction);
  assert.equal(result.event.eventType, "tool.interaction.requested");
});
```

- [x] **Step 2: Run the failing test**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: fails because `requestModuleRunInteraction` is not exported yet.

- [x] **Step 3: Implement interaction request and feedback**

Add types and functions in `ingest-service.ts`:

```ts
export type ToolInteractionKind = "question" | "approval" | "data_request" | "blocked";
export type ToolInteractionStatus =
  | "waiting_for_user"
  | "waiting_for_approval"
  | "waiting_for_data"
  | "blocked"
  | "resumable";
```

Implement:

```ts
export async function requestModuleRunInteraction(...): Promise<ToolInteractionResponse>
export async function submitModuleRunFeedback(...): Promise<ToolInteractionResponse>
```

The request function must update `metadata.interaction` and append `tool.interaction.requested`. The feedback function must require an active interaction, set `status: "resumable"`, and append `tool.interaction.feedback_submitted`.

- [x] **Step 4: Verify service tests**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: all API server tests pass.

### Task 2: HTTP Routes

**Files:**
- Modify: `artifacts/api-server/src/routes/modules.ts`

- [x] **Step 1: Add route imports**

Import generated request validators:

```ts
CreateModuleRunInteractionBody,
CreateModuleRunInteractionParams,
SubmitModuleRunFeedbackBody,
SubmitModuleRunFeedbackParams,
```

- [x] **Step 2: Add endpoints**

Add:

```ts
router.post("/module-runs/:runId/interactions", async (req, res) => { ... });
router.post("/module-runs/:runId/feedback", async (req, res) => { ... });
```

Both endpoints validate params/body with Zod and return `404` when the run is missing.

- [x] **Step 3: Verify API build**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run build
```

Expected: build passes after OpenAPI codegen creates the validators.

### Task 3: OpenAPI And Generated Clients

**Files:**
- Modify: `lib/api-spec/openapi.yaml`
- Generated: `lib/api-zod/src/generated/*`
- Generated: `lib/api-client-react/src/generated/*`

- [x] **Step 1: Add schemas**

Add schemas for:

```yaml
ToolInteractionKind
ToolInteractionStatus
ToolInteractionOption
ToolInteraction
CreateToolInteractionRequest
SubmitToolFeedbackRequest
ToolInteractionResponse
```

- [x] **Step 2: Add paths**

Add:

```yaml
/module-runs/{runId}/interactions:
  post:
    operationId: createModuleRunInteraction
/module-runs/{runId}/feedback:
  post:
    operationId: submitModuleRunFeedback
```

- [x] **Step 3: Regenerate clients**

Run:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
```

Expected: Orval generation succeeds. On this Windows host the script may still exit after generation because it invokes bare `pnpm`; if so, run `corepack pnpm run typecheck:libs` separately.

### Task 4: Status And Verification

**Files:**
- Modify: `.hermes/project-status.md`

- [x] **Step 1: Update status**

Record:

```md
- PR #7 was merged.
- Started `codex/tool-adapter-feedback-loop`.
- Added backend tool interaction/feedback contract.
```

- [x] **Step 2: Run required checks**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run build
corepack pnpm run typecheck:libs
corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck
git diff --check
```

Expected: all pass, except codegen may have the known bare-`pnpm` script-tail issue after generating outputs.

- [ ] **Step 3: Commit, push, and PR**

Run:

```powershell
git add .hermes/project-status.md artifacts/api-server/src/modules/ingest-service.ts artifacts/api-server/src/modules/ingest-service.test.ts artifacts/api-server/src/routes/modules.ts lib/api-spec/openapi.yaml lib/api-zod/src/generated lib/api-client-react/src/generated docs/superpowers/plans/2026-05-11-tool-adapter-feedback-loop.md
git commit -m "Add tool adapter feedback loop contract"
git push -u origin codex/tool-adapter-feedback-loop
gh pr create --base main --head codex/tool-adapter-feedback-loop --title "Add tool adapter feedback loop contract"
```

## Acceptance Criteria

- External tools can POST an interaction request against any existing module run.
- The interaction is visible through `GET /api/module-runs/{runId}` via run metadata and event history.
- Users/agents can POST feedback that marks the interaction `resumable`.
- Feedback without an active interaction is rejected.
- No plaintext secrets are introduced.
- No sibling repositories are read or modified.
- Generated clients expose the new endpoints.
