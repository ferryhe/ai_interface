# Skill Registry Generalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ai_interface` extensible so generic skills can be added through checked-in or local skill definition files without editing the core registration arrays.

**Architecture:** Keep the existing `SkillManifest` contract as the source model, then introduce a single runtime registry context that derives module, business-skill, adapter, readiness, and route list responses from loaded manifests. Move the current five built-in skills into file-backed manifests only after every existing consumer can receive an injected registry context. Real execution, provider expansion, MCP, and DAG execution become separate PRs on top of that base.

**Tech Stack:** TypeScript ESM, Express, Node `node:test`, Zod/OpenAPI/codegen, Drizzle-backed module catalog, `corepack pnpm`, YAML manifest files, safe CLI/HTTP/MCP executor boundaries.

---

## Executive Summary

The recommendation is directionally correct: `ai_interface` has a strong manifest contract and generated API pipeline, but the current skill registration is split across multiple static arrays. The first implementation priority is not a YAML parser by itself. The first implementation priority is a unified registry context that all backend consumers can use.

Current hard-coded registration points:

- `artifacts/api-server/src/skill-runtime/skill-manifest.ts` exports `builtinSkillManifests`.
- `artifacts/api-server/src/agent-runtime/skill-registry.ts` exports `businessSkillDefinitions`.
- `artifacts/api-server/src/modules/registry.ts` exports `moduleRegistry`.
- `artifacts/api-server/src/tool-adapters/adapter-registry.ts` exports `adapterDefinitions`.
- `artifacts/api-server/src/agent-config/agent-config-service.ts` derives default business-skill settings from `moduleRegistry`.
- `artifacts/api-server/src/routes/modules.ts`, `routes/skills.ts`, and `routes/tool-adapters.ts` expose static registry state.
- `artifacts/api-server/src/modules/db-repository.ts` upserts the DB module catalog from static `moduleRegistry`.

North-star acceptance criterion:

- Adding a generic skill with standard metadata and standard CLI/HTTP/MCP execution requires adding one manifest file under an approved `skills/` directory and running validation.
- Adding a skill-specific REST API is intentionally out of the zero-code path until a generic skill action/status API exists.

## Project Boundaries

- Writable scope is only `C:\Project\ai_interface`.
- Do not read, edit, or infer requirements from sibling repositories.
- Do not copy secrets, `.env` files, generated credentials, or unreviewed artifacts between projects.
- Existing local unrelated files, including `vite-smoke.out.log`, must remain unstaged and untouched.
- Every PR starts from latest `main` on a fresh `codex/...` branch.
- Every PR updates `.hermes/project-status.md` with branch, files, checks, blockers, and next action.
- Every PR uses focused tests first, then the required build/type/codegen checks for touched surfaces.

## Delivery Strategy

Deliver as seven sequential PRs. Each PR must be independently mergeable, testable, and reversible.

1. Registry Context Base
2. YAML Skill Loader and Built-in Manifest Migration
3. Custom and Community Skill Developer Experience
4. Real CLI and HTTP Executors
5. Planner Provider Registry
6. MCP Executor
7. Optional DAG Pipeline Execution

Do not start PR N+1 until PR N has been merged into `main`, unless the controller explicitly decides to pause the managed sequence.

## Cross-PR Work Requirements

- Use TDD for behavior changes.
- Keep old public API response shapes compatible unless a PR explicitly updates OpenAPI and generated clients.
- Redact env values, local path values, tokens, command output secrets, and provider keys from API responses and events.
- Prefer dependency injection over global mutable registry state.
- Preserve `moduleId` compatibility while moving toward manifest-derived `skillId`.
- Keep `FakeToolAdapterExecutor` available for tests and safe local mode.
- Feature-flag real external execution until all redaction, allowlist, timeout, and failure semantics are tested.
- Do not dynamically import arbitrary local adapter scripts in the first execution PR. Use core-owned executor implementations with manifest-declared command or endpoint metadata.

## PR 1: Registry Context Base

### Goal

Create a single in-memory registry context that derives module definitions, business skill definitions, adapter definitions, readiness, and API list responses from `SkillManifest` records, while preserving the current five built-in TypeScript manifests.

### Files

- Modify: `artifacts/api-server/src/skill-runtime/skill-manifest.ts`
- Create: `artifacts/api-server/src/skill-runtime/skill-runtime-registry.ts`
- Create: `artifacts/api-server/src/skill-runtime/skill-runtime-registry.test.ts`
- Modify: `artifacts/api-server/src/modules/registry.ts`
- Modify: `artifacts/api-server/src/modules/registry.test.ts`
- Modify: `artifacts/api-server/src/tool-adapters/adapter-registry.ts`
- Modify: `artifacts/api-server/src/tool-adapters/adapter-registry.test.ts`
- Modify: `artifacts/api-server/src/agent-runtime/skill-registry.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
- Modify: `artifacts/api-server/src/agent-config/agent-config-service.ts`
- Modify: `artifacts/api-server/src/agent-config/agent-config-service.test.ts`
- Modify: `artifacts/api-server/src/modules/db-repository.ts`
- Modify: `artifacts/api-server/src/routes/modules.ts`
- Modify: `artifacts/api-server/src/routes/skills.ts`
- Modify: `artifacts/api-server/src/routes/tool-adapters.ts`
- Modify: `artifacts/api-server/src/routes/*.test.ts` as needed for dependency injection
- Modify: `.hermes/project-status.md`

### Work Requirements

- [ ] Create `SkillRuntimeRegistry` with these methods:

```ts
export interface SkillRuntimeRegistry {
  listSkills(): SkillManifest[];
  getSkill(skillId: string): SkillManifest | null;
  hasSkill(skillId: string): boolean;
  listSkillIds(): string[];
  listModuleDefinitions(): ModuleDefinition[];
  isKnownModuleId(moduleId: string): boolean;
  listAdapterDefinitions(): ToolAdapterDefinition[];
  getAdapterDefinition(moduleId: ModuleId): ToolAdapterDefinition;
  listBusinessSkillDefinitions(): BusinessSkillDefinition[];
  getBusinessSkillDefinition(moduleId: ModuleId): BusinessSkillDefinition;
}
```

- [ ] Add `createSkillRuntimeRegistry(manifests?: SkillManifest[])`.
- [ ] Default to the existing `builtinSkillManifests` so behavior does not change.
- [ ] Make module definitions derive from manifest fields:

```ts
{
  moduleId: manifest.moduleId,
  displayName: manifest.title ?? manifest.name,
  description: manifest.description,
  category: manifest.category,
  resultKinds: [...manifest.artifactKinds],
}
```

- [ ] Make adapter definitions derive through the existing `manifestAdapterDefinition(manifest)`.
- [ ] Make business skill definitions derive through `businessSkillDefinitionFromManifest(manifest)`.
- [ ] Keep compatibility exports such as `moduleRegistry` and `adapterDefinitions` backed by the default registry for older imports.
- [ ] Add injectable registry parameters to routers and services instead of reading static arrays directly.
- [ ] Update `DbModuleRunRepository` so catalog upsert can resolve module definitions from the registry context.
- [ ] Preserve custom manifest support in `createAgentRun(..., { skillManifests })`.

### Required Tests

- [ ] `skill-runtime-registry.test.ts` verifies the default registry exposes the same five skills in the same order:

```ts
assert.deepEqual(registry.listSkillIds(), [
  "web_listening",
  "doc_to_md",
  "md_to_rag",
  "rag_to_agent",
  "climate_monitor",
]);
```

- [ ] Registry tests verify module definitions, adapter definitions, and business skill definitions are derived from one custom manifest.
- [ ] Route tests verify `/skills`, `/modules`, and `/tool-adapters` can be served from an injected registry with one custom skill.
- [ ] Agent runtime tests verify planner output for `custom_reporter` still creates a module run and stores derived adapter metadata.
- [ ] DB repository test verifies `ensureModuleCatalog` can upsert a custom manifest-derived module definition when a registered custom skill creates a module run.
- [ ] Existing tests for static five-skill behavior continue to pass.

### Verification Commands

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
git diff --check
```

### Deliverables

- Unified `SkillRuntimeRegistry` implementation.
- Default compatibility exports still available.
- Route/service/repository injection path in place.
- Tests proving static arrays are no longer the only source consumed by runtime surfaces.

### Handoff

Next PR may move manifest storage to YAML only after this PR proves all runtime consumers can operate from injected manifest records.

## PR 2: YAML Skill Loader and Built-in Manifest Migration

### Goal

Move the five built-in skill manifests into `skills/builtin/<skillId>/skill.yaml` and load them through a validated file-system loader.

### Files

- Create: `skills/builtin/web_listening/skill.yaml`
- Create: `skills/builtin/doc_to_md/skill.yaml`
- Create: `skills/builtin/md_to_rag/skill.yaml`
- Create: `skills/builtin/rag_to_agent/skill.yaml`
- Create: `skills/builtin/climate_monitor/skill.yaml`
- Create: `artifacts/api-server/src/skill-runtime/skill-loader.ts`
- Create: `artifacts/api-server/src/skill-runtime/skill-loader.test.ts`
- Modify: `artifacts/api-server/src/skill-runtime/skill-manifest.ts`
- Modify: `artifacts/api-server/src/skill-runtime/skill-runtime-registry.ts`
- Modify: `artifacts/api-server/src/app.ts` or `artifacts/api-server/src/routes/index.ts` if app-level registry initialization is chosen
- Modify: `artifacts/api-server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Work Requirements

- [ ] Add `yaml` as the manifest parser dependency in `@workspace/api-server`.
- [ ] Create a schema-normalizing loader:

```ts
export interface LoadSkillManifestsOptions {
  roots?: string[];
  cwd?: string;
  readFile?: (path: string) => Promise<string>;
  exists?: (path: string) => boolean;
}

export async function loadSkillManifests(
  options?: LoadSkillManifestsOptions,
): Promise<SkillManifest[]> {
  // scan roots, parse YAML, normalize defaults, validate, sort deterministically
}
```

- [ ] Support only explicit roots in this PR:

```ts
[
  "skills/builtin",
]
```

- [ ] Add defaults for skill-author ergonomics:

```yaml
ui:
  mode: auto
  openOnTrigger: false
  preferredRenderer: json
execution:
  timeoutMs: 120000
  maxOutputBytes: 1048576
  requiredEnv: []
  optionalEnv: []
  allowedCommands: []
  supportsResume: false
permissions:
  approvalRequired: false
  canUseNetwork: false
  canWriteDatabase: true
interactionKinds: []
artifactKinds: []
```

- [ ] Preserve every current built-in manifest value exactly unless the field is only represented by a documented default.
- [ ] Add duplicate `skillId` and duplicate `moduleId` detection with a clear startup error.
- [ ] Keep a test-only path for constructing registries from in-memory manifest arrays.
- [ ] Do not read sibling repositories.

### Required Tests

- [ ] Loader test verifies the five built-in YAML files load in deterministic order.
- [ ] Loader test verifies defaults are applied to a minimal manifest fixture.
- [ ] Loader test verifies duplicate `skillId` fails.
- [ ] Loader test verifies duplicate `moduleId` fails.
- [ ] Loader test verifies invalid `execution.kind` fails with the manifest file path in the error message.
- [ ] Existing `/skills`, `/modules`, `/tool-adapters`, agent runtime, readiness, and adapter tests pass without hard-coded TypeScript manifest arrays.

### Verification Commands

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
git diff --check
```

### Deliverables

- Five checked-in YAML manifests under `skills/builtin`.
- File loader with validation, defaults, ordering, and duplicate detection.
- Existing skill API and runtime behavior preserved.
- README section explaining built-in skill manifests.

### Handoff

Next PR may add `skills/custom` and `skills/community` roots. It must not change built-in behavior or require external network access.

## PR 3: Custom and Community Skill Developer Experience

### Goal

Allow project-local custom skills and repository-managed community skills to be validated, discovered, and documented without changing core TypeScript code.

### Files

- Modify: `artifacts/api-server/src/skill-runtime/skill-manifest.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Modify: `lib/api-zod/src/generated/*` via codegen
- Modify: `lib/api-client-react/src/generated/*` via codegen
- Modify: `artifacts/api-server/src/skill-runtime/skill-loader.ts`
- Modify: `artifacts/api-server/src/skill-runtime/skill-loader.test.ts`
- Create: `skills/community/README.md`
- Create: `skills/community/example_reporter/skill.yaml`
- Create: `skills/custom/.gitkeep`
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `scripts/src/validate-skills.ts`
- Modify: `scripts/package.json`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Work Requirements

- [ ] Extend source metadata to:

```ts
export type SkillProjectSource = "builtin" | "community" | "custom" | "external";
```

- [ ] Load roots in this order:

```ts
[
  "skills/builtin",
  "skills/community",
  "skills/custom",
]
```

- [ ] Apply override policy:
  - `builtin` cannot be overridden by `community`.
  - `custom` may override `community` for local testing.
  - `custom` cannot override `builtin` unless `AI_INTERFACE_ALLOW_BUILTIN_SKILL_OVERRIDE=1` is set.
- [ ] Add `skills/custom/*` to `.gitignore`, while keeping `skills/custom/.gitkeep`.
- [ ] Add `pnpm run skill:validate` that loads all manifests and prints a redacted JSON summary.
- [ ] Document a contributor workflow:
  - create `skills/community/<skillId>/skill.yaml`;
  - run `corepack pnpm run skill:validate`;
  - run API tests;
  - open PR.
- [ ] Keep install-from-network commands out of this PR. The install command can be a documented follow-up after local validation is stable.

### Required Tests

- [ ] Loader tests cover source ordering.
- [ ] Loader tests cover `custom` overriding `community`.
- [ ] Loader tests cover blocked `community` overriding `builtin`.
- [ ] Loader tests cover blocked `custom` overriding `builtin` without env opt-in.
- [ ] OpenAPI codegen reflects `community` and `custom` source values.
- [ ] `skill:validate` test or smoke command confirms no env values or local path values are printed.

### Verification Commands

```powershell
corepack pnpm run skill:validate
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
git diff --check
```

### Deliverables

- `builtin`, `community`, and `custom` source model.
- Local validation command.
- Example community skill manifest.
- Contributor documentation.
- Generated API clients updated.

### Handoff

Next PR may enable real execution for loaded skills. It must treat manifest metadata as untrusted input and enforce runtime safety in core executors.

## PR 4: Real CLI and HTTP Executors

### Goal

Add safe real execution for manifest-declared CLI and HTTP skills while keeping fake execution as the default safe mode.

### Files

- Modify: `artifacts/api-server/src/tool-adapters/executor.ts`
- Create: `artifacts/api-server/src/tool-adapters/cli-executor.ts`
- Create: `artifacts/api-server/src/tool-adapters/cli-executor.test.ts`
- Create: `artifacts/api-server/src/tool-adapters/http-executor.ts`
- Create: `artifacts/api-server/src/tool-adapters/http-executor.test.ts`
- Create: `artifacts/api-server/src/tool-adapters/executor-router.ts`
- Create: `artifacts/api-server/src/tool-adapters/executor-router.test.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Modify: `artifacts/api-server/src/tool-adapters/resume-service.ts`
- Modify: `artifacts/api-server/src/tool-adapters/*.test.ts`
- Modify: `lib/api-spec/openapi.yaml` only if new public fields are exposed
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Work Requirements

- [ ] Introduce executor mode:

```ts
export type ToolExecutionEngineMode = "fake" | "real";
```

- [ ] Default to fake unless `AI_INTERFACE_TOOL_EXECUTION_MODE=real`.
- [ ] Add executor router:

```ts
export function createToolAdapterExecutor(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
): ToolAdapterExecutor {
  if (env.AI_INTERFACE_TOOL_EXECUTION_MODE !== "real") {
    return new FakeToolAdapterExecutor();
  }
  if (adapter.adapterKind === "cli") return new CliToolAdapterExecutor(env);
  if (adapter.adapterKind === "http") return new HttpToolAdapterExecutor(env);
  return new FakeToolAdapterExecutor();
}
```

- [ ] CLI executor uses `child_process.spawn` with `shell: false`.
- [ ] CLI executor rejects commands whose executable or command prefix is not in `adapter.allowedCommands`.
- [ ] CLI executor enforces `timeoutMs` and kills the child process on timeout.
- [ ] CLI executor truncates stdout/stderr to `maxOutputBytes`.
- [ ] CLI executor stores parsed JSON output when stdout is valid JSON; otherwise stores redacted text summary.
- [ ] HTTP executor requires an env base URL from `requiredEnv` and refuses private metadata endpoints unless explicitly allowlisted.
- [ ] HTTP executor supports status-code mapping to `succeeded`/`failed`.
- [ ] HTTP executor redacts authorization headers, tokens, and base URL values in events and API responses.
- [ ] Keep climate monitor's existing dedicated run API unchanged; this PR only affects generic module-run execution.

### Required Tests

- [ ] CLI rejects disallowed command.
- [ ] CLI succeeds for an allowed test command with JSON stdout.
- [ ] CLI timeout maps to failed execution and records a warning/error event.
- [ ] CLI output truncation respects `maxOutputBytes`.
- [ ] HTTP rejects missing base URL env.
- [ ] HTTP maps 2xx JSON response to succeeded execution.
- [ ] HTTP maps 4xx/5xx to failed execution.
- [ ] HTTP redaction test confirms token/base URL values do not appear in result JSON or event JSON.
- [ ] Agent `execute_ready` uses fake executor by default.
- [ ] Agent `execute_ready` uses real executor only when `AI_INTERFACE_TOOL_EXECUTION_MODE=real`.

### Verification Commands

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
git diff --check
```

### Deliverables

- CLI executor.
- HTTP executor.
- Safe executor router.
- Feature-flagged real execution.
- Tests for allowlist, timeout, truncation, status mapping, and redaction.

### Handoff

Next PR may add planner provider selection. Real execution must remain disabled by default unless the operator opts in.

## PR 5: Planner Provider Registry

### Goal

Abstract planner providers so OpenAI remains the default configured planner while Anthropic, Ollama, and deterministic fallback can be added behind a common registry.

### Files

- Modify: `artifacts/api-server/src/agent-config/agent-config-service.ts`
- Modify: `artifacts/api-server/src/agent-config/agent-config-service.test.ts`
- Create: `artifacts/api-server/src/agent-runtime/planner-providers.ts`
- Create: `artifacts/api-server/src/agent-runtime/planner-providers.test.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx` if the Configure UI displays new providers
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Work Requirements

- [ ] Extend provider type:

```ts
export type AgentProvider = "openai" | "anthropic" | "ollama" | "deterministic";
```

- [ ] Add provider capability metadata:

```ts
export interface PlannerProviderDefinition {
  provider: AgentProvider;
  displayName: string;
  requiredEnv: string[];
  defaultModelId: string;
  supportsReasoningEffort: boolean;
}
```

- [ ] Move `OpenAIResponsesPlanner` into provider registry code without changing its request semantics.
- [ ] Add deterministic planner as an explicit provider.
- [ ] Add Anthropic and Ollama provider shells only when their request construction and test fetch mocks are included in the same PR.
- [ ] Provider selection order:
  - configured provider with required env present;
  - first configured provider in fallback order;
  - deterministic.
- [ ] `getConnectionStatus` must report provider-specific readiness without exposing key values.
- [ ] Planner output must continue through existing `normalizePlan`.

### Required Tests

- [ ] OpenAI configured env selects OpenAI provider.
- [ ] Missing configured provider env falls back to deterministic with warning.
- [ ] Anthropic mocked HTTP planner returns valid normalized steps.
- [ ] Ollama mocked HTTP planner returns valid normalized steps.
- [ ] Provider readiness output redacts key values and local base URLs.
- [ ] Existing deterministic missing-key tests still pass.
- [ ] OpenAPI codegen passes.

### Verification Commands

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
git diff --check
```

### Deliverables

- Planner provider registry.
- Provider-specific readiness.
- Deterministic provider as a first-class fallback.
- OpenAPI and generated clients updated.
- Optional Configure UI provider choices if API contract changes are user-visible.

### Handoff

Next PR may add MCP execution. Planner provider work must not change skill execution semantics.

## PR 6: MCP Executor

### Goal

Allow manifest-declared MCP skills to call MCP server tools through a controlled executor path.

### Files

- Modify: `artifacts/api-server/src/skill-runtime/skill-manifest.ts`
- Modify: `artifacts/api-server/src/tool-adapters/adapter-registry.ts`
- Create: `artifacts/api-server/src/tool-adapters/mcp-executor.ts`
- Create: `artifacts/api-server/src/tool-adapters/mcp-executor.test.ts`
- Modify: `artifacts/api-server/src/tool-adapters/executor-router.ts`
- Modify: `artifacts/api-server/src/tool-adapters/executor-router.test.ts`
- Modify: `lib/api-spec/openapi.yaml` if MCP-specific execution fields are exposed
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Work Requirements

- [ ] Extend manifest execution metadata for MCP without breaking CLI/HTTP manifests:

```ts
export interface SkillExecution {
  kind: SkillExecutionKind;
  adapterId: string;
  requiredEnv: string[];
  optionalEnv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  allowedCommands: string[];
  supportsResume: boolean;
  readinessHint?: string;
  mcpServerEnv?: string;
  mcpToolName?: string;
}
```

- [ ] MCP executor requires explicit server configuration from env.
- [ ] MCP executor requires explicit `mcpToolName`.
- [ ] MCP executor maps MCP tool result content to `ToolExecutionResult`.
- [ ] MCP executor enforces timeout and output size limits.
- [ ] MCP executor redacts server URLs, auth tokens, and raw headers.
- [ ] MCP executor remains feature-flagged under real execution mode.

### Required Tests

- [ ] MCP executor rejects missing server env.
- [ ] MCP executor rejects missing tool name.
- [ ] MCP executor maps a mocked successful tool call to `succeeded`.
- [ ] MCP executor maps a mocked tool error to `failed`.
- [ ] MCP executor truncates large result payloads.
- [ ] MCP executor redacts server URL and token values.
- [ ] Executor router selects MCP only for `execution.kind === "mcp"` and real mode enabled.

### Verification Commands

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
git diff --check
```

### Deliverables

- MCP executor.
- Manifest MCP metadata.
- Tests for connection config, tool mapping, failures, limits, and redaction.

### Handoff

Next PR may add DAG execution. MCP execution must be stable and optional before introducing parallel execution.

## PR 7: Optional DAG Pipeline Execution

### Goal

Add an optional DAG plan mode for independent module runs while preserving the current linear plan mode as the default.

### Files

- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Create: `artifacts/api-server/src/agent-runtime/dag-executor.ts`
- Create: `artifacts/api-server/src/agent-runtime/dag-executor.test.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx` if plan mode or dependency labels are displayed
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Work Requirements

- [ ] Add plan mode fields:

```ts
export type AgentRuntimePlanMode = "linear" | "dag";

export interface AgentRuntimePlanStep {
  skillId: string;
  moduleId: ModuleId;
  title: string;
  action: string;
  input: JsonObject;
  requiresApproval: boolean;
  stepId?: string;
  dependsOn?: string[];
}
```

- [ ] Default missing `mode` to `linear`.
- [ ] In `linear` mode, ignore absent `dependsOn` and preserve current behavior.
- [ ] In `dag` mode, require stable `stepId` for every step.
- [ ] Validate that every `dependsOn` value references an existing step.
- [ ] Detect dependency cycles and fail the plan before creating module runs.
- [ ] Execute dependency-ready non-approval steps in batches with `Promise.all`.
- [ ] Preserve approval-required steps as pending and block downstream dependent steps.
- [ ] Add failure strategy:

```ts
export type DagFailureStrategy = "fail_fast" | "continue_independent";
```

- [ ] Default strategy to `fail_fast`.

### Required Tests

- [ ] Linear mode preserves current module-run order and metadata.
- [ ] DAG mode rejects unknown dependency.
- [ ] DAG mode rejects cycle.
- [ ] DAG mode executes independent ready steps in the same batch.
- [ ] DAG mode waits for upstream dependency before downstream execution.
- [ ] Approval-required upstream leaves downstream pending with blocked metadata.
- [ ] Failed upstream behaves according to `fail_fast`.
- [ ] OpenAPI codegen passes.

### Verification Commands

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
git diff --check
```

### Deliverables

- Optional DAG plan contract.
- DAG validation and execution helper.
- Backward-compatible linear default.
- Tests for dependencies, cycle handling, parallel batches, approval blocking, and failure strategy.

### Handoff

After this PR, the platform supports file-backed generic skills, safe real executors, provider-pluggable planning, MCP execution, and optional parallel orchestration.

## Managed PR Handoff Protocol

For each PR:

- [ ] Start from latest `main`.
- [ ] Run `git status --short --branch` before edits and list unrelated changes.
- [ ] Create a fresh branch named `codex/<short-scope>`.
- [ ] Assign implementation to a worker with explicit file ownership.
- [ ] Tell the worker it is not alone in the codebase and must not revert unrelated edits.
- [ ] Require TDD for behavior changes.
- [ ] Run focused tests during implementation.
- [ ] Run full required checks for touched surfaces before publish.
- [ ] Dispatch spec-compliance review.
- [ ] Dispatch code-quality review.
- [ ] Fix confirmed Critical and Important findings.
- [ ] Commit only scoped files.
- [ ] Push branch.
- [ ] Open PR.
- [ ] Wait 10 to 15 minutes.
- [ ] Check GitHub checks and Copilot/review comments.
- [ ] Fix only confirmed-safe comments.
- [ ] Rerun focused/full validation as appropriate.
- [ ] Push follow-up commits.
- [ ] Update `.hermes/project-status.md`.
- [ ] Report PR URL, checks, review comments handled, blockers, and next action.

## Global Test Matrix

Minimum checks across the full program:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
git diff --check
```

Run mockup build when public generated contracts or Configure/Backstage UI changes:

```powershell
$env:PORT='8080'
$env:BASE_PATH='/'
$env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'
corepack pnpm --dir artifacts/mockup-sandbox run build
```

Run browser smoke when rendered UI behavior changes and the Browser plugin is available:

- Open `http://127.0.0.1:8080/preview/ai-os/AgentFirstInterface`.
- Verify Configure skill list, Backstage skill catalog, selected skill detail, run metadata, and no console errors.
- If Browser plugin is unavailable, record the exact blocker and use source/build/API checks as fallback.

## Program-Level Definition of Done

- A generic non-built-in skill can be added by placing a valid manifest under `skills/custom/<skillId>/skill.yaml`.
- The skill appears in `GET /api/skills`, `GET /api/modules`, and `GET /api/tool-adapters` without editing core TypeScript registration arrays.
- Agent runtime can plan and create module runs for that skill when it is enabled.
- Default fake execution remains safe.
- Real CLI/HTTP/MCP execution is opt-in, allowlisted, timeout-bound, output-limited, and redacted.
- Planner provider selection is configurable and has deterministic fallback.
- Linear execution remains backward compatible.
- DAG execution is optional and tested.
- README and project status accurately describe how to add, validate, and operate skills.

## Decisions Locked By This Plan

- Keep `SkillManifest` as the main contract.
- Introduce registry context before YAML migration.
- Use file-backed manifests before marketplace/install workflows.
- Use core-owned executors before arbitrary adapter script imports.
- Keep real external execution disabled by default.
- Keep DAG execution out of the initial registry/YAML PRs.

## Explicit Non-Goals

- No sibling repository edits.
- No secret copying.
- No force-push, branch deletion, or history rewrite without explicit approval.
- No generic external network install flow in PR 3.
- No arbitrary local adapter script execution in PR 4.
- No breaking removal of `moduleId` compatibility.
