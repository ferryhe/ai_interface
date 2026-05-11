# Agent Run Execute-Ready Mode Plan

## Summary

Add an optional execution kickoff mode to Agent runs so the interface can move from "plan only" to "safe local execution simulation" without calling real external tools.

This PR wires the safe executor skeleton from PR #10 into `createAgentRun` behind a public request option:

- `executionMode: "plan_only" | "execute_ready"`
- Default remains `plan_only`.
- `execute_ready` runs only non-approval module runs whose adapter readiness is configured.
- Missing adapter env stays pending with a warning event from the safe executor.
- Approval-required steps stay pending and get an explicit skip event.
- Execution uses `FakeToolAdapterExecutor` only.

Real CLI execution, real HTTP adapter execution, background queues, streaming, and frontend UI changes stay out of scope.

## Scope

Files in scope:

- `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
- `artifacts/api-server/src/routes/agent-runs.ts`
- `lib/api-spec/openapi.yaml`
- generated API client/Zod outputs under:
  - `lib/api-zod/src/generated/**`
  - `lib/api-client-react/src/generated/**`
- `.hermes/project-status.md`

Optional only if required by generated types/build:

- Adjacent generated index files.

Out of scope:

- No frontend UI changes.
- No real CLI execution.
- No real HTTP adapter execution.
- No process spawning.
- No sibling repository reads or edits.
- No plaintext secrets in logs, events, metadata, output JSON, or API responses.

## Data Contract

Add `AgentRunExecutionMode`:

- `plan_only`: create the plan and pending module runs exactly as today.
- `execute_ready`: after module runs are created, attempt safe execution for eligible runs.

Add `executionMode?: AgentRunExecutionMode` to `CreateAgentRunInput` and the OpenAPI `CreateAgentRunRequest`.

Response shape does not need a new top-level field in this PR if status and module runs already show execution results. Pipeline metadata should record:

- `executionMode`
- `executedModuleRunCount`
- `skippedApprovalModuleRunCount`

## Runtime Rules

When `executionMode` is omitted or `"plan_only"`:

- Preserve existing behavior.
- Agent status remains `missing_key`, `needs_approval`, or `planned` as it does today.
- No executor is called.

When `executionMode` is `"execute_ready"`:

- Create the same plan/module runs first.
- For each module run in plan order:
  - If the effective step requires approval:
    - Do not call the executor.
    - Preserve `pending` status.
    - Record `tool.execution.approval_required` event.
    - Add metadata `adapterExecutionStatus: "approval_required"`.
  - Otherwise call `executeModuleRunWithAdapter` with `FakeToolAdapterExecutor`.
    - If adapter env is missing, safe executor records the redacted skip and keeps run pending.
    - If adapter env is present, fake executor marks the run succeeded.
- Refresh module runs after execution so the API response returns current status/output.
- Pipeline status should be:
  - `succeeded` if all module runs succeeded.
  - `running` if at least one run succeeded and at least one remains pending for approval/configuration.
  - `pending` if no run executed.
  - `failed` if any run failed.
- Agent runtime status can remain existing values unless a failure occurs; do not invent a large status refactor in this PR.

## Implementation Steps

1. Add failing tests first in `agent-runtime-service.test.ts`.
   - Default behavior is still plan-only and does not execute module runs.
   - `execute_ready` with configured env and no approval runs fake executor and returns succeeded module run output.
   - `execute_ready` skips approval-required runs and records approval-required event/metadata.
   - `execute_ready` with missing adapter env records redacted skip and keeps the run pending.

2. Implement service changes.
   - Add `AgentRunExecutionMode`.
   - Add `executionMode` to `CreateAgentRunInput`.
   - Add an injectable executor option for tests if needed, defaulting to `FakeToolAdapterExecutor`.
   - Use `executeModuleRunWithAdapter` only after module runs are created.
   - Re-fetch or collect updated module runs before returning.

3. Update route and OpenAPI contract.
   - Accept `executionMode` in `POST /api/agent-runs`.
   - Regenerate API Zod/client outputs.

4. Update project status.
   - Mention PR #10 merged.
   - Mention active branch and execute-ready scope.
   - Record validation after commands pass.

5. Review and validation.
   - Spec reviewer checks implementation against this plan.
   - Code quality reviewer checks execution safety, approval skip semantics, metadata preservation, and test coverage.
   - Controller integrates confirmed fixes only.

## Test Plan

Required commands:

- `corepack pnpm --filter @workspace/api-server run test`
- `corepack pnpm --filter @workspace/api-server run build`
- `corepack pnpm --filter @workspace/api-spec run codegen`
- `corepack pnpm run typecheck:libs`
- `git diff --check`

Expected result:

- API server tests pass, including execute-ready tests.
- API server build passes.
- Generated API Zod/client outputs reflect `executionMode`.
- Library typecheck passes.
- Diff check has no errors. CRLF warnings are acceptable on this Windows workspace when no whitespace errors are reported.

Known local caveat:

- The `@workspace/api-spec` codegen script may generate files and then fail only because it invokes bare `pnpm` inside this Windows shell. If so, run `corepack pnpm run typecheck:libs` separately and record the exact blocker.

## Follow-Up

After this PR is pushed and opened:

- Schedule one 15-minute follow-up for PR checks and Copilot/review comments.
- Fix only confirmed-safe comments.
- Merge when clean and mergeable.
- Start the next narrow PR slice after merge, likely explicit module-run resume execution or frontend visibility for execute-ready results.
