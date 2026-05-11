# Module Run Resume Execution Plan

## Summary

Add a backend-only resume endpoint for module runs that are waiting on user or Agent feedback.

Existing flow:

- A module asks for input through `POST /api/module-runs/{runId}/interactions`.
- The user or Agent replies through `POST /api/module-runs/{runId}/feedback`.
- Feedback marks the interaction `resumable`.

This PR adds the next safe step:

- `POST /api/module-runs/{runId}/resume`
- It accepts only module runs whose current interaction is `resumable`.
- It marks the interaction as `resumed` so duplicate resumes are rejected.
- It records a resume-requested event.
- It resumes through `FakeToolAdapterExecutor` and `executeModuleRunWithAdapter`.

Real CLI execution, real HTTP adapter calls, queues, streaming, and frontend UI changes stay out of scope.

## Scope

Files in scope:

- `artifacts/api-server/src/modules/ingest-service.ts`
- `artifacts/api-server/src/modules/db-repository.ts`
- `artifacts/api-server/src/modules/ingest-service.test.ts`
- `artifacts/api-server/src/tool-adapters/resume-service.ts`
- `artifacts/api-server/src/tool-adapters/resume-service.test.ts`
- `artifacts/api-server/src/routes/modules.ts`
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

Extend tool interaction status:

- Add `resumed` to `ToolInteractionStatus`.
- `resumable` means feedback has arrived and execution may be resumed.
- `resumed` means the resume request has been accepted/consumed.

Add public API:

- `POST /api/module-runs/{runId}/resume`
- Response can reuse `ToolInteractionResponse`:
  - `run`: the module run after resume execution attempt.
  - `event`: the `tool.execution.resume_requested` event.
  - `interaction`: the consumed interaction with `status: "resumed"`.

Add service API:

- `resumeModuleRunExecution(repository, runId, options?)`
- `options.env` defaults to `process.env`.
- Executor is always `FakeToolAdapterExecutor` in this PR.

## Runtime Rules

When current interaction is missing, malformed, active-but-not-resumable, or already resumed:

- Reject with a clear error.
- Do not call the executor.
- Do not create resume/execution events.

When adapter `supportsResume` is false:

- Reject with a clear error.
- Do not consume the interaction.
- Do not call the executor.
- Do not create resume/execution events.

When current interaction is `resumable`, adapter supports resume, and adapter readiness is missing required env:

- Do not consume the interaction.
- Preserve `metadata.interaction.status: "resumable"` so the caller can retry after configuration is fixed.
- Record the existing redacted `tool.execution.skipped` event and keep the run pending.
- Return the pending run, skip event, and current resumable interaction.

When current interaction is `resumable`, adapter supports resume, and adapter readiness is ready:

- Atomically update `metadata.interaction.status` to `resumed` only if the stored interaction id still matches and the stored status is still `resumable`.
- Reject if the atomic consume returns no run, so duplicate/concurrent resumes do not create resume/execution events.
- Preserve feedback data, `respondedAt`, `resumeHandle`, and existing metadata.
- Add `metadata.interaction.metadata.resumedAt`.
- Record `tool.execution.resume_requested` with:
  - `interactionId`
  - `resumeHandle`
  - `adapterId`
  - `moduleId`
  - `externalRunId`
- Call `executeModuleRunWithAdapter` with `FakeToolAdapterExecutor`.
  - Configured adapter env produces fake success.
  - Missing adapter env produces the existing redacted skip and keeps the run pending.
- Return the final run, resume event, and resumed interaction.

## Implementation Steps

1. Add tests first.
   - Resume rejects a run with no resumable interaction.
   - Resume succeeds after feedback for a resume-capable module and records both resume-requested and fake-completed events.
   - Duplicate resume rejects after the interaction is marked `resumed`.
   - Missing adapter env on resume records redacted skip and does not expose optional env values.
   - Resume rejects adapters with `supportsResume: false` without consuming the interaction.

2. Export safe interaction helpers from `ingest-service.ts`.
   - Export `getCurrentInteraction` so resume service can reuse the existing validation.
   - Add `resumed` to `ToolInteractionStatus` and `isToolInteractionStatus`.
   - Add a repository-level atomic consume method for resumable interactions.
   - Keep existing feedback tests passing.

3. Add `resume-service.ts`.
   - Implement service rules above.
   - Use existing repository methods and `recordModuleRunEvent` or repository events consistently.
   - Use `FakeToolAdapterExecutor` only.

4. Add route and OpenAPI contract.
   - Wire `POST /module-runs/{runId}/resume`.
   - Regenerate API Zod/client outputs.

5. Update project status.
   - Mention PR #11 merged.
   - Mention active branch and resume execution scope.
   - Record validation after commands pass.

6. Review and validation.
   - Spec reviewer checks implementation against this plan.
   - Code quality reviewer checks resume safety, duplicate prevention, interaction metadata preservation, secret redaction, and no real execution.
   - Controller integrates confirmed fixes only.

## Test Plan

Required commands:

- `corepack pnpm --filter @workspace/api-server run test`
- `corepack pnpm --filter @workspace/api-server run build`
- `corepack pnpm --filter @workspace/api-spec run codegen`
- `corepack pnpm run typecheck:libs`
- `git diff --check`

Expected result:

- API server tests pass, including resume tests.
- API server build passes.
- Generated API Zod/client outputs reflect `resume`.
- Library typecheck passes.
- Diff check has no errors. CRLF warnings are acceptable on this Windows workspace when no whitespace errors are reported.

Known local caveat:

- The `@workspace/api-spec` codegen script may generate files and then fail only because it invokes bare `pnpm` inside this Windows shell. If so, run `corepack pnpm run typecheck:libs` separately and record the exact blocker.

## Follow-Up

After this PR is pushed and opened:

- Schedule one 15-minute follow-up for PR checks and Copilot/review comments.
- Fix only confirmed-safe comments.
- Merge when clean and mergeable.
- Start the next narrow PR slice after merge, likely frontend visibility for execute-ready/resume results or persistent pipeline status refresh.
