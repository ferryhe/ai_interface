# Agent Runtime Skill Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real backend Agent Runtime for `ai_interface` so chat requests can create an agent thread, generate a module plan, and persist pipeline/module-run state for the existing business skills.

**Architecture:** Add a bounded runtime seam inside `artifacts/api-server`: an Agent planner chooses registered skills, an Agent runtime service writes thread/message/pipeline/module-run records, and module execution stays behind future adapters. V1 supports OpenAI Responses planning when `OPENAI_API_KEY` is configured, and a deterministic missing-key planner for local/test operation.

**Tech Stack:** Express, TypeScript, Drizzle/Postgres tables already present in `@workspace/db`, existing module ingest service, OpenAPI + Orval/Zod generated clients, Node test runner.

---

## Design Summary

This is not a "connect API and magically become all-powerful" change. The API key activates the model planning layer, while `ai_interface` still owns skill registry, permission metadata, memory writes, and module handoff state.

V1 will ship a safe, testable runtime slice:

- `POST /api/agent-runs` accepts a user message and optional thread ID.
- The backend stores an agent thread and the user/agent messages.
- The planner chooses from enabled business skills in the existing config.
- The runtime creates one pipeline run plus planned module runs for `web_listening`, `doc_to_md`, `md_to_rag`, and `rag_to_agent`.
- The response tells the UI whether OpenAI is configured, what was planned, which module runs were created, and what still requires approval/external execution.
- External business repos remain separate services; this repo stores and displays their canonical results through the existing ingest APIs.

## External Reference Contracts

- `web_listening`: canonical staged CLI flow is `discover -> classify -> select -> plan-scope -> bootstrap-scope -> run-scope -> report-scope -> export-manifest`; stable handoff is `web-listening-manifest.v1`.
- `doc_to_md`: stable API endpoints are `/apps/conversion/convert` and `/apps/conversion/convert-inline`; response includes `markdown`, `quality`, `trace`, `assets`, and `duration_seconds`.
- `c-ross-2`: represents the ready-data/RAG/agent validation side; useful surfaces are `cross2.py build-ready-data`, `validate-ready-data`, `search`, `evidence`, `answer`, and the `AI_Agent` professional engine endpoints.
- `ai_actuary`: orchestration reference is the control-plane shape: run statuses, events, artifact refs, tool catalog, workflow catalog, and bounded agent adapter contracts.
- OpenAI Responses API: the planner seam uses `POST https://api.openai.com/v1/responses` and requests structured JSON through `text.format` with `type: "json_schema"`, matching current official OpenAI Responses/Structured Outputs guidance.

## File Structure

- Create `artifacts/api-server/src/agent-runtime/skill-registry.ts`
  - Business skill definitions, external reference URLs, input schema hints, permission defaults, and adapter mode.
- Create `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
  - Runtime repository interface, in-memory repository, deterministic planner, OpenAI Responses planner, and `createAgentRun` / `getAgentRunDetail`.
- Create `artifacts/api-server/src/agent-runtime/db-repository.ts`
  - Drizzle implementation over existing `agent_threads`, `agent_messages`, `pipeline_runs`, `module_runs`, and `run_events` tables.
- Create `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
  - Focused runtime tests without network or real OpenAI credentials.
- Create `artifacts/api-server/src/routes/agent-runs.ts`
  - Express routes for creating and reading runtime runs.
- Modify `artifacts/api-server/src/routes/index.ts`
  - Mount `agent-runs` routes.
- Modify `lib/api-spec/openapi.yaml`
  - Add `agent-runs` tag, request/response schemas, and route definitions.
- Regenerate `lib/api-zod/src/generated/**` and `lib/api-client-react/src/generated/**`
  - Keep client contracts aligned with the OpenAPI surface.
- Modify `.hermes/project-status.md`
  - Record branch, scope, validation, and current state.

## Task 1: Plan And Branch

**Files:**
- Create: `docs/superpowers/plans/2026-05-11-agent-runtime-skill-orchestrator.md`
- Modify: `.hermes/project-status.md`

- [x] **Step 1: Read project instructions and status**

Run:

```powershell
Get-Content -Path AGENTS.md
if (Test-Path .hermes/project-status.md) { Get-Content -Path .hermes/project-status.md }
git status --short --branch
```

Expected: project boundary is `ai_interface`; sibling repos are off-limits unless explicitly named; current worktree is clean.

- [x] **Step 2: Create task branch**

Run:

```powershell
git fetch origin
git checkout -b codex/agent-runtime-skill-orchestrator
```

Expected: branch starts from latest `origin/main`.

- [x] **Step 3: Inspect external references**

Run:

```powershell
gh api repos/ferryhe/web_listening/contents/README.md -H 'Accept: application/vnd.github.raw'
gh api repos/ferryhe/web_listening/contents/docs/contracts/web-listening-manifest-v1.md -H 'Accept: application/vnd.github.raw'
gh api repos/ferryhe/doc_to_md/contents/README.md -H 'Accept: application/vnd.github.raw'
gh api repos/ferryhe/doc_to_md/contents/API_RESPONSE_CONTRACT.md -H 'Accept: application/vnd.github.raw'
gh api repos/ferryhe/c-ross-2/contents/README.md -H 'Accept: application/vnd.github.raw'
gh api repos/ferryhe/c-ross-2/contents/AI_Agent/README.md -H 'Accept: application/vnd.github.raw'
gh api repos/ferryhe/ai_actuary/contents/docs/contracts/control-plane.md -H 'Accept: application/vnd.github.raw'
```

Expected: no external code is copied; only public contract concepts are referenced.

## Task 2: Skill Registry

**Files:**
- Create: `artifacts/api-server/src/agent-runtime/skill-registry.ts`
- Test: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`

- [ ] **Step 1: Add business skill definitions**

Create a registry with one definition per business module:

```ts
export const businessSkillDefinitions = [
  {
    moduleId: "web_listening",
    adapterMode: "external_cli_or_api",
    canonicalEntrypoints: ["web-listening export-manifest", "web-listening run-scope"],
    outputContracts: ["web-listening-manifest.v1"],
  },
  {
    moduleId: "doc_to_md",
    adapterMode: "external_api",
    canonicalEntrypoints: ["POST /apps/conversion/convert", "POST /apps/conversion/convert-inline"],
    outputContracts: ["doc_to_md.convert.v1"],
  },
  {
    moduleId: "md_to_rag",
    adapterMode: "external_cli_or_api",
    canonicalEntrypoints: ["cross2.py build-ready-data", "cross2.py validate-ready-data"],
    outputContracts: ["ready_data_manifest.json"],
  },
  {
    moduleId: "rag_to_agent",
    adapterMode: "external_api",
    canonicalEntrypoints: ["/api/engine/config", "/api/engine/plan", "/api/engine/chat"],
    outputContracts: ["agent_config", "agent_validation"],
  },
];
```

- [ ] **Step 2: Expose enabled-skill helpers**

Add helpers that accept `BusinessSkillSetting[]` and return enabled module definitions in registry order.

- [ ] **Step 3: Test the registry through runtime tests**

Expected: disabled business skills are not included in planned module runs.

## Task 3: Agent Runtime Service

**Files:**
- Create: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Test: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`

- [ ] **Step 1: Write tests first**

Cover:

```ts
test("creates a deterministic missing-key plan and stores module runs", async () => {});
test("respects disabled business skills", async () => {});
test("uses an injected planner when OpenAI is configured", async () => {});
test("rejects unknown thread ids", async () => {});
```

- [ ] **Step 2: Implement repository interface**

Define runtime records for threads, messages, pipeline runs, module runs, and events. Implement an in-memory repository by extending the existing in-memory module-run repository.

- [ ] **Step 3: Implement deterministic planner**

When `OPENAI_API_KEY` is missing, return a safe plan using enabled business skills and mark the connection as `missing_key`.

- [ ] **Step 4: Implement OpenAI Responses planner seam**

Use `fetch("https://api.openai.com/v1/responses", ...)` only when `OPENAI_API_KEY` exists. Ask for JSON output with planned steps. Normalize model output so unknown/disabled module IDs are ignored and a deterministic fallback plan is used if the model returns no valid steps.

- [ ] **Step 5: Implement `createAgentRun`**

Persist:

1. agent thread, when no `threadId` is supplied
2. user message
3. pipeline run
4. planned module runs
5. per-module planning events
6. agent summary message

Return a response that includes `connection`, `thread`, `pipelineRun`, `messages`, `moduleRuns`, and `plan`.

- [ ] **Step 6: Implement `getAgentRunDetail`**

Read a pipeline run, its thread, messages, module runs, and module events.

## Task 4: DB Repository

**Files:**
- Create: `artifacts/api-server/src/agent-runtime/db-repository.ts`

- [ ] **Step 1: Map existing DB rows**

Map:

- `agentThreadsTable` -> runtime `AgentThreadRecord`
- `agentMessagesTable` -> runtime `AgentMessageRecord`
- `pipelineRunsTable` -> runtime `PipelineRunRecord`
- existing module-run mapping from `DbModuleRunRepository`

- [ ] **Step 2: Implement create/read methods**

Use existing tables only; do not add migrations in this PR.

- [ ] **Step 3: Keep module catalog upsert behavior**

Extend `DbModuleRunRepository` so planned module runs still seed the module catalog before insert.

## Task 5: API Routes And OpenAPI

**Files:**
- Create: `artifacts/api-server/src/routes/agent-runs.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Generate: `lib/api-zod/src/generated/**`
- Generate: `lib/api-client-react/src/generated/**`

- [ ] **Step 1: Add Express routes**

Routes:

- `POST /api/agent-runs`
- `GET /api/agent-runs/{pipelineRunId}`

- [ ] **Step 2: Add OpenAPI schemas**

Schemas:

- `CreateAgentRunRequest`
- `AgentRunResponse`
- `AgentRunDetail`
- `AgentRuntimeConnection`
- `AgentRuntimePlan`
- `AgentRuntimePlanStep`
- `AgentRuntimeStatus`
- `AgentThread`
- `AgentMessage`
- `PipelineRun`

- [ ] **Step 3: Regenerate clients**

Run:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
```

Expected: Zod and React client outputs include `createAgentRun` and `getAgentRun`.

## Task 6: Verification And PR

**Files:**
- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Run focused API tests**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: all API server tests pass.

- [ ] **Step 2: Run API server build**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run build
```

Expected: build exits 0.

- [ ] **Step 3: Run library typecheck**

Run:

```powershell
corepack pnpm run typecheck:libs
```

Expected: TypeScript project references pass.

- [ ] **Step 4: Run artifact/script typecheck**

Run:

```powershell
corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck
```

Expected: artifact and script typechecks pass.

- [ ] **Step 5: Run diff hygiene**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors; CRLF warnings are acceptable on this Windows workspace.

- [ ] **Step 6: Commit, push, and open PR**

Run:

```powershell
git add docs/superpowers/plans/2026-05-11-agent-runtime-skill-orchestrator.md .hermes/project-status.md artifacts/api-server/src lib/api-spec/openapi.yaml lib/api-zod/src lib/api-client-react/src
git commit -m "Add agent runtime skill orchestrator"
git push -u origin codex/agent-runtime-skill-orchestrator
gh pr create --title "Add agent runtime skill orchestrator" --body "<summary and test plan>"
```

Expected: PR is created for review.

## Acceptance Criteria

- A caller can `POST /api/agent-runs` with a message and receive a stored thread, message, pipeline run, module runs, and runtime plan.
- When `OPENAI_API_KEY` is absent, the endpoint still behaves predictably with a `missing_key` connection status and deterministic module plan.
- When an OpenAI planner is injected in tests, the runtime uses planner output and persists matching module runs.
- Disabled business skills are not planned.
- No plaintext API keys are accepted or stored.
- No external repo code is copied or vendored into `ai_interface`.
