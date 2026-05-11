# Safe Tool Executor Skeleton Plan

## Summary

Add the first backend-only execution seam between Agent-created module runs and external tool adapters. This PR must make execution state observable and testable without launching real CLIs, calling sibling repo APIs, or reading sibling repositories.

The executor is intentionally a safe skeleton:

- It checks the registered adapter for a module run.
- It redacts environment configuration into readiness metadata.
- It skips execution when required adapter environment is missing.
- It can run a fake executor when the adapter is configured.
- It records module-run status, output, metadata, and timeline events in the existing repository contract.

Real CLI process execution, HTTP calls to module services, background queues, retries, streaming, and UI wiring stay out of this PR.

## Scope

Files in scope:

- `artifacts/api-server/src/tool-adapters/adapter-registry.ts`
- `artifacts/api-server/src/tool-adapters/adapter-registry.test.ts`
- `artifacts/api-server/src/tool-adapters/executor.ts`
- `artifacts/api-server/src/tool-adapters/executor.test.ts`
- `.hermes/project-status.md`

Optional only if required by type/build:

- Nearby API server exports/imports.

Out of scope:

- No public API endpoint.
- No OpenAPI changes or codegen.
- No frontend UI changes.
- No real CLI execution.
- No real HTTP adapter execution.
- No `child_process`, shell execution, or process spawning in API server code.
- No sibling repository reads or edits.
- No plaintext secrets in logs, events, metadata, or output JSON.

## Data Contract

Add a reusable readiness helper:

- `getAdapterReadiness(definition, env = process.env)` returns one redacted readiness record for a single adapter.
- `listAdapterReadiness(env)` delegates to the single-adapter helper.
- Blank environment values count as missing.
- Readiness can expose configured variable names, missing variable names, adapter ids, module ids, limits, and hints, but never environment values.

Add executor types:

- `ToolExecutionStatus = "succeeded" | "failed" | "skipped"`.
- `ToolExecutionRequest` includes `run`, `adapter`, and `readiness`.
- `ToolExecutionResult` includes `status`, `summary`, `outputJson`, `eventType`, `eventTitle`, `eventMessage`, `eventSeverity`, and `eventPayload`.
- `ToolAdapterExecutor` has `execute(request): Promise<ToolExecutionResult>`.

Add a fake executor:

- `FakeToolAdapterExecutor` returns a deterministic success result.
- Output JSON includes `adapterId`, `moduleId`, `externalRunId`, `inputJson`, and `simulated: true`.
- It must not include environment values.

Add an orchestration helper:

- `executeModuleRunWithAdapter(repository, runId, executor, options?)`.
- It loads the module run and adapter definition.
- It computes redacted readiness from `options.env ?? process.env`.
- When readiness is missing required env:
  - Do not call the executor.
  - Update the run with `status: "pending"` so it remains resumable after configuration.
  - Preserve existing metadata and add:
    - `adapterExecutionStatus: "skipped"`
    - `adapterId`
    - `adapterKind`
    - `adapterReadinessStatus`
    - `adapterMissingRequiredEnv`
  - Record a `tool.execution.skipped` warning event with missing env names only.
  - Return `result: null`.
- When readiness is ready:
  - Update the run to `running` with `startedAt` if not already set.
  - Call the supplied executor.
  - Update the run with:
    - `status: "succeeded"` for successful results.
    - `status: "failed"` for failed results.
    - `summary`
    - `outputJson`
    - `completedAt`
    - preserved metadata plus adapter execution metadata.
  - Record the executor event.
  - Return run, event, adapter, readiness, and result.

## Implementation Steps

1. Add failing tests first.
   - Test single-adapter readiness for configured and blank env values.
   - Test missing env skip does not call executor and records a warning event.
   - Test configured env calls `FakeToolAdapterExecutor`, updates the run to `succeeded`, preserves input, and records a completion event.
   - Test unknown/missing module run errors before execution.

2. Refactor adapter readiness.
   - Export `getAdapterReadiness`.
   - Keep existing `listAdapterReadiness` behavior and tests passing.
   - Ensure arrays are copied so callers cannot mutate registry definitions.

3. Add `executor.ts`.
   - Define the execution types.
   - Implement `FakeToolAdapterExecutor`.
   - Implement `executeModuleRunWithAdapter`.
   - Use `recordModuleRunEvent` or repository methods consistently with existing service patterns.

4. Update project status.
   - Mention PR #9 merged.
   - Mention active branch and safe executor skeleton scope.
   - Record validation commands after they pass.

5. Review and validation.
   - Spec reviewer checks the implementation against this plan.
   - Code quality reviewer checks for unsafe execution surfaces, secret exposure, metadata overwrite bugs, and insufficient tests.
   - Controller integrates confirmed fixes only.

## Test Plan

Required commands:

- `corepack pnpm --filter @workspace/api-server run test`
- `corepack pnpm --filter @workspace/api-server run build`
- `corepack pnpm run typecheck:libs`
- `git diff --check`

Expected result:

- API server tests pass, including new executor tests.
- API server build passes.
- Library typecheck passes.
- Diff check has no errors. CRLF warnings are acceptable on this Windows workspace when no whitespace errors are reported.

## Follow-Up

After this PR is pushed and opened:

- Schedule one 15-minute follow-up for PR checks and Copilot/review comments.
- Fix only confirmed-safe comments.
- Merge when clean and mergeable.
- Start the next narrow PR slice: wiring the executor behind an internal runtime action or API endpoint, still without real external side effects unless explicitly approved by the plan.
