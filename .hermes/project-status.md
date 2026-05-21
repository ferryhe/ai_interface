# ai_interface Project Status

Updated: 2026-05-21

## Active Work

- Branch: `codex/agent-aware-runtime-selection`
- Scope: PR 2 implementation for Agent Registry Flexible Workbench: agent-aware `POST /api/agent-runs` skill selection, planner defaults, run metadata, generated API schemas/clients, and docs/status updates.
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
- PR #46 completed the Portal chat layout fix and merged into `main` at `202ed99` on 2026-05-20.
- Portal `Request` and `Agent progress` bubbles now use content-aware sizing instead of fixed 760px width, and the message list scrolls within its available row.
- Copilot reviewed PR #46 and generated no comments. No GitHub checks were configured for the branch.
- The `codex/fix-agent-chat-layout` work branch was deleted locally and remotely after merge.
- CI branch `ci/add-github-actions` adds `.github/workflows/ci.yml` for pull requests and pushes to `main`, using Node 22, pnpm install, `pnpm run typecheck`, `pnpm run build`, and `pnpm run skill:validate`.
- `artifacts/mockup-sandbox` build requires `PORT` and `BASE_PATH`; the new CI workflow injects minimal defaults for the build step so the existing workspace build can run in GitHub Actions.
- PR 1 Agent Registry Foundation work is in progress on `codex/agent-registry-foundation`.
- Added `agents/builtin/knowledge_builder/agent.yaml` with DAG planner defaults and bindings to `web_listening`, `doc_to_md`, `md_to_rag`, and `rag_to_agent`.
- Added YAML-backed `AgentManifest` loading, override policy, `AgentRuntimeRegistry`, `/api/agents` readiness, and `corepack pnpm run agent:validate`.
- PR 1 code-quality review follow-up added focused `agent-loader` tests for source/root mismatch rejection and explicit built-in override opt-in.
- PR #49 remote feedback follow-up fixed `scripts/src/validate-agents.ts` so it discovers the repository root by walking parent directories before resolving runtime imports or loader cwd.
- PR 2 Agent-Aware Runtime Selection is implemented locally on `codex/agent-aware-runtime-selection`.
- `POST /api/agent-runs` now accepts optional `agentId`; unknown agents fail with `Agent is not registered: <agentId>`.
- Agent runs now select request `enabledSkillIds` first, then active agent skill bindings, then saved config skill settings when no agent is supplied.
- Agent planner defaults provide fallback plan mode/failure strategy, agent provider preferences are applied for the run without persisting to config, and agent metadata is stored on new thread records, messages, pipeline records, and module records.
- PR 2 spec-compliance review follow-up added runtime coverage proving agent provider/model/reasoning overrides are passed to the planner for a single run and do not persist to saved config.
- PR 2 code-quality review follow-up narrowed README/status metadata wording to new thread records and cleaned generated status-only line-ending noise.
- PR #50 remote feedback follow-up made user-message metadata attachment explicit and lazy-loads the default agent runtime registry only when an `agentId` run needs it.

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
- Portal chat layout verification:
  - Browser measured message bubbles shrinking from 760px to 483px on desktop after the CSS fix.
  - Browser mobile check at 390px width showed chat bubbles fitting inside the viewport without horizontal overflow.
  - `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
  - `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
  - `git diff --check` passed with CRLF warnings only.
- CI workflow verification:
  - `corepack enable` passed.
  - `pnpm install --frozen-lockfile` passed.
  - `pnpm run typecheck` passed.
  - `PORT=3000 BASE_PATH=/ pnpm run build` passed.
  - `pnpm run skill:validate` passed with `ok: true` and 7 skills loaded.
  - `git diff --check` passed.
- Agent Registry Foundation verification so far:
  - Initial TDD red run: `corepack pnpm --filter @workspace/api-server run test` failed because agent registry modules/routes did not exist.
  - `corepack pnpm --filter @workspace/api-spec run codegen` passed and ran `typecheck:libs`.
  - `corepack pnpm --filter @workspace/api-server run test` passed with 225 passing, 1 skipped Windows symlink test, and 0 failures.
  - `corepack pnpm run agent:validate` passed with `ok: true`, 1 agent, and no missing skill IDs.
  - `corepack pnpm run skill:validate` passed with `ok: true` and 7 skills loaded.
  - `corepack pnpm --filter @workspace/api-server run typecheck` passed.
  - `corepack pnpm --filter @workspace/api-server run build` passed.
  - `corepack pnpm run typecheck:libs` passed.
  - `git diff --check` passed with CRLF warnings only.
  - Review follow-up: direct `pnpm exec tsx --test src/agent-registry/agent-loader.test.ts` attempts failed because `tsx` was not resolved as a direct executable on this Windows shell.
  - Review follow-up: `corepack pnpm --filter @workspace/api-server run test -- src/agent-registry/agent-loader.test.ts` passed through the package script with 227 passing, 1 skipped Windows symlink test, and 0 failures.
  - Review follow-up: `corepack pnpm --filter @workspace/api-server run typecheck` passed.
  - PR #49 remote feedback follow-up reproduced the validator issue: `corepack pnpm run agent:validate` from `scripts/` failed before the fix because imports resolved under `scripts/artifacts/...`.
  - PR #49 remote feedback follow-up validation passed: `corepack pnpm run agent:validate`.
  - PR #49 remote feedback follow-up validation passed: `corepack pnpm --filter @workspace/scripts run agent:validate`.
  - PR #49 remote feedback follow-up validation passed from `scripts/`: `corepack pnpm run agent:validate`.
  - PR #49 remote feedback follow-up validation passed: `corepack pnpm --filter @workspace/scripts run typecheck`.
  - PR #49 remote feedback follow-up validation passed: `git diff --check` with CRLF warnings only.
- Agent-Aware Runtime Selection verification:
  - TDD red run: `corepack pnpm --filter @workspace/api-server run test -- src/agent-runtime/agent-runtime-service.test.ts src/routes/agent-runs.test.ts` failed with 5 expected failures covering ignored `agentId`, missing metadata, missing agent planner defaults, and route 201 for unknown agents.
  - Focused green rerun of the same command passed through the package script with 233 passing, 1 skipped Windows symlink test, and 0 failures.
  - `corepack pnpm --filter @workspace/api-server run test` passed with 233 passing, 1 skipped Windows symlink test, and 0 failures.
  - `corepack pnpm --filter @workspace/api-server run typecheck` passed.
  - `corepack pnpm --filter @workspace/api-server run build` passed.
  - `corepack pnpm --filter @workspace/api-spec run codegen` passed and ran `typecheck:libs`.
  - `corepack pnpm run typecheck:libs` passed.
  - `git diff --check` passed with CRLF warnings only.
  - Spec-compliance follow-up red/fix cycle: `corepack pnpm --filter @workspace/api-server run test -- src/agent-runtime/agent-runtime-service.test.ts` initially failed because the new fixture inherited DAG defaults without planner `stepId`; after narrowing the fixture to linear mode, the command passed with 234 passing, 1 skipped Windows symlink test, and 0 failures.
  - Code-quality follow-up cleanup: `git status --short --branch`, `git diff --name-only`, and `git diff --numstat` confirmed generated status-only files had no content diff before restoring them; `git diff --check` is the required final check for this docs/status cleanup.
  - PR #50 remote feedback follow-up: `corepack pnpm --filter @workspace/api-server run test -- src/agent-runtime/agent-runtime-service.test.ts` passed with 234 passing, 1 skipped Windows symlink test, and 0 failures.
  - PR #50 remote feedback follow-up: `corepack pnpm --filter @workspace/api-server run typecheck` passed.

## Next Action

- Report PR #50 remote feedback follow-up changes and verification results without committing, pushing, merging, or opening a PR per the current worker instructions.
