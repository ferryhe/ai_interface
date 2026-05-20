# ai_interface Project Status

Updated: 2026-05-20

## Active Work

- Branch: `codex/docs-project-overview`
- Scope: Documentation cleanup, current project guide, and static HTML project introduction.
- Sibling repos: off-limits; edits and validation remain confined to `ai_interface`.

## Current State

- The managed Skill Registry Generalization program is complete through PR7.
- PR #36 added the unified registry context.
- PR #37 moved built-in skills to YAML-backed loading.
- PR #38 added community/custom skill developer experience.
- PR #39 added real CLI and HTTP executors.
- PR #40 added planner provider registry support.
- PR #43 added the optional MCP executor and merged at `f7f1713`.
- PR #44 added optional DAG pipeline execution and merged at `4ace710`.
- PR #44 follow-up addressed 2 Copilot comments before merge: DAG planner types now use the `dag-executor` source of truth, and DAG ready-step execution has bounded concurrency with optional `AI_INTERFACE_DAG_MAX_CONCURRENCY`.
- Work branches for the completed PRs were deleted after merge.
- Follow-up automations for merged PRs were deleted or are being removed as they complete.
- Documentation cleanup is in progress: README current-state updates, docs index, community skill guidance, Replit notes, and `docs/project-overview.html`.
- `vite-smoke.out.log` was identified as generated Vite HMR/smoke output and added to `.gitignore`; deletion is blocked while a local process holds the file open.

## Verification

- PR #44 final verification before merge:
  - `corepack pnpm --filter @workspace/api-server run test` passed with 215 passing, 1 skipped Windows symlink test, and 0 failures.
  - `corepack pnpm --filter @workspace/api-server run typecheck` passed.
  - `corepack pnpm --filter @workspace/api-server run build` passed.
  - `corepack pnpm run typecheck:libs` passed.
  - `git diff --check` passed with CRLF warnings only.
- GitHub PR #44 had no configured checks. Copilot's 2 original review threads were outdated after the follow-up fix commit, and no new comments were present before merge.
- Documentation cleanup verification:
  - `corepack pnpm run skill:validate` passed with 7 loaded skills.
  - `git diff --check` passed with CRLF warnings only.
  - README/community/Replit docs were scanned for stale "four skills" and "This PR does not" wording in current docs.

## Next Action

- Commit, push, and open the documentation cleanup PR.
