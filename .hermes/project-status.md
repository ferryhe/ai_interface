# ai_interface Project Status

Updated: 2026-05-20

## Active Work

- Branch: `codex/dag-pipeline-execution`
- Scope: PR7 of the Skill Registry Generalization program: add optional DAG plan mode while preserving the existing linear execution default.
- Sibling repos: off-limits; edits and validation remain confined to `ai_interface`.

## Current State

- PR #43 (`codex/mcp-executor`) was merged into `main` at `f7f1713` on 2026-05-20, and the work branch was deleted locally and remotely.
- The `pr-43-follow-up` heartbeat automation was deleted after the merge.
- PR7 has started from latest `main` on branch `codex/dag-pipeline-execution`.
- PR7 implementation is complete locally: `linear`/`dag` plan mode support, optional `stepId`/`dependsOn` metadata, DAG validation, dependency-aware execution batches, approval blocking, and failure strategy handling have been implemented.
- Backward compatibility requirement: missing `mode` defaults to `linear`; existing linear plans preserve current module-run order and DAG metadata is only attached in DAG mode.
- PR7 review gate passed with no blocking findings. The reviewer requested hardening tests for missing `stepId`, duplicate `stepId`, and `continue_independent`; those tests were added.
- Unrelated untracked `vite-smoke.out.log` remains untouched.

## Verification

- PR #43 follow-up validation before merge:
  - `corepack pnpm --filter @workspace/api-server run test` passed with 200 passing, 1 skipped on Windows symlink privilege (`EPERM`), and 0 failures.
  - `corepack pnpm --filter @workspace/api-server run typecheck` passed.
  - `corepack pnpm --filter @workspace/api-server run build` passed.
  - `git diff --check` passed with CRLF warnings only.
- PR7 focused TDD validation:
  - RED run failed as expected before implementation: missing DAG executor plus failing service assertions for default `linear`, unknown dependency rejection, and approval blocking.
  - `corepack pnpm --filter @workspace/api-server run test -- src/agent-runtime/dag-executor.test.ts src/agent-runtime/agent-runtime-service.test.ts` passed after implementation with 209 passing, 1 skipped Windows symlink test, and 0 failures.
  - Follow-up RED caught an empty invalid DAG planner fallback regression; the fix resets fallback plans to deterministic `linear` mode.
  - `corepack pnpm --filter @workspace/api-server run test -- src/agent-runtime/agent-runtime-service.test.ts` passed after the fallback fix with 210 passing, 1 skipped Windows symlink test, and 0 failures.
  - Review hardening added DAG validation tests for missing `stepId` and duplicate `stepId`, plus `continue_independent` behavior coverage where an independent branch continues after a separate failed dependency branch.
  - `corepack pnpm --filter @workspace/api-server run test -- src/agent-runtime/dag-executor.test.ts` passed after review hardening with 213 passing, 1 skipped Windows symlink test, and 0 failures.
  - `corepack pnpm --filter @workspace/api-spec run codegen` passed and regenerated generated clients/types.
- PR7 full verification passed:
  - Latest api-server test run (`corepack pnpm --filter @workspace/api-server run test`) passed with 213 passing, 1 skipped Windows symlink test, and 0 failures.
  - `corepack pnpm --filter @workspace/api-server run typecheck` passed.
  - `corepack pnpm --filter @workspace/api-server run build` passed.
  - `corepack pnpm run typecheck:libs` passed.
  - `git diff --check` passed with CRLF warnings only.
  - UI was not touched; mockup-sandbox typecheck was not run.

## Next Action

- Run final controller validation, commit PR7, push `codex/dag-pipeline-execution`, and open the PR.
