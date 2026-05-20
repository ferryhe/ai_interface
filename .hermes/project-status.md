# ai_interface Project Status

Updated: 2026-05-20T11:36:02Z

## Active Work

- Branch: `feat/actuarial-pipeline-runner`
- Scope: PR5 of the ai_actuary tool-decomposition rollout: actuarial pipeline runner/API visibility in `ai_interface` using the existing ai_actuary CLI/file-artifact contract; no TypeScript actuarial calculation reimplementation.
- PR4 `feat/skill-manifest-cli-executor` is merged as #41 (`6205aea`).
- PR5 implementation is ready to commit/open: added built-in actuarial pipeline manifest, local runner service, pipeline routes, OpenAPI/generated clients, and command/read guards.
- Review gate: Codex CLI was attempted and blocked because the ChatGPT account does not support `gpt-5.2-codex`; substituted independent delegate reviewers. Accepted fixes aligned the manifest with ai_actuary's tool-runner contract, documented/auto-injected `X-AI-Interface-Command-Intent: actuarial-pipeline-run`, and guarded read routes with localhost/same-origin checks. Final delegate re-review reported no blockers.

## Verification

- `corepack pnpm --filter @workspace/api-spec run codegen` ✅
- `corepack pnpm --filter @workspace/api-server run test -- runner.test.ts pipelines.test.ts` ✅ (`181 passed`; package script ran the api-server test suite)
- `corepack pnpm --filter @workspace/api-server run typecheck` ✅
- `corepack pnpm --filter @workspace/api-server run build` ✅
- `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` ✅
- `git diff --check` ✅

## Dirty / Untracked State Noticed

- Current PR5 files are still uncommitted before controller commit/push/PR creation.
- Sibling `ai_actuary` keeps the intentionally untracked rollout plan doc `docs/plans/2026-05-20-ai-actuary-tool-decomposition-pr-plan.md`.

## Next Safe Action

- Commit and push `feat/actuarial-pipeline-runner`, open PR5, update rollout state with the PR number/URL, then stop this tick and wait for the next scheduled remote review/check cycle.
