# ai_interface Project Status

Updated: 2026-05-20

## Active Work

- Branch: `main`
- Scope: Skill Registry Generalization program and follow-up documentation cleanup are complete.
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
- PR #45 completed documentation cleanup and merged into `main` at `08d9ab0` on 2026-05-20.
- Documentation cleanup is complete: README current-state updates, docs index, community skill guidance, retired Replit workspace files, and `docs/project-overview.html`.
- `vite-smoke.out.log` was identified as generated Vite HMR/smoke output and added to `.gitignore`; deletion is blocked while a local process holds the file open.
- `.replit`, `.replitignore`, and `replit.md` were removed because development is no longer Replit-based.
- Merged PR #45 for `codex/docs-project-overview`: https://github.com/ferryhe/ai_interface/pull/45
- PR #45 follow-up found 1 actionable Copilot comment on the README skills table separator and fixed it.
- The `codex/docs-project-overview` work branch was deleted locally and remotely after merge.
- Historical local branches `codex/skill-os-interface-runtime` and `codex/address-ai-interface-review-comments` were cleaned up after confirming their work was merged. Local and remote branch lists now only show `main` / `origin/main`.
- Runtime smoke on 2026-05-20: the Vite frontend is already listening on `8080` and `8081`; the API build succeeds and the API responds to `/api/healthz` and `/api/skills` when launched with `PORT` and `DATABASE_URL`, but DB-backed routes such as `/api/agent-config` return 500 without a reachable Postgres database. The current Vite dev server does not proxy `/api`, so `8080/api/*` returns the frontend HTML fallback rather than API JSON.

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
  - Current README, community docs, project guide, and status notes were scanned for stale "four skills" and "This PR does not" wording.
  - PR #45 follow-up validation after the README table fix passed: `corepack pnpm run skill:validate` and `git diff --check`.
- Runtime smoke:
  - `corepack pnpm --filter @workspace/api-server run build` passed.
  - Temporary API launch with `PORT=3000` and placeholder `DATABASE_URL` returned `{"status":"ok"}` from `/api/healthz`.
  - Temporary API launch returned 7 skills from `/api/skills`: `web_listening`, `doc_to_md`, `md_to_rag`, `rag_to_agent`, `climate_monitor`, `ai_actuary`, and `example_reporter`.
  - Temporary API launch returned 500 from `/api/agent-config` because the placeholder Postgres connection is not backed by a running database.
  - Existing Vite dev servers returned `Mockup Canvas` HTML on `8080` and `8081`; same-origin `/api/healthz` on those ports returned HTML fallback.

## Next Action

- No active PR or leftover work branch in the Skill Registry Generalization or documentation cleanup program. For full local runtime, start/provision Postgres and add or run an API proxy/reverse proxy if the Vite UI should call the API on the same origin.
