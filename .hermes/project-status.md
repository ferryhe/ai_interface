# ai_interface Project Status

Updated: 2026-05-20T11:37:14Z

## Active Work

- Branch: `feat/actuarial-pipeline-runner`
- Scope: PR5 of the ai_actuary tool-decomposition rollout: actuarial pipeline runner/API visibility in `ai_interface` using the existing ai_actuary CLI/file-artifact contract; no TypeScript actuarial calculation reimplementation.
- PR4 `feat/skill-manifest-cli-executor` is merged as #41 (`6205aea`).
- PR5 is open as #42: https://github.com/ferryhe/ai_interface/pull/42
- Head commit at PR creation: `401c1e4`.
- Remote state at creation: `mergeStateStatus=CLEAN`, `mergeable=MERGEABLE`, no checks reported yet.
- Review gate: Codex CLI was attempted and blocked because the ChatGPT account does not support `gpt-5.2-codex`; substituted independent delegate reviewers. Accepted fixes aligned the manifest with ai_actuary's tool-runner contract, documented/auto-injected `X-AI-Interface-Command-Intent: actuarial-pipeline-run`, and guarded read routes with localhost/same-origin checks. Final delegate re-review reported no blockers.

## Verification

- `corepack pnpm --filter @workspace/api-spec run codegen` ✅
- `corepack pnpm --filter @workspace/api-server run test -- runner.test.ts pipelines.test.ts` ✅ (`181 passed`; package script ran the api-server test suite)
- `corepack pnpm --filter @workspace/api-server run typecheck` ✅
- `corepack pnpm --filter @workspace/api-server run build` ✅
- `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` ✅
- `git diff --check` ✅

## Dirty / Untracked State Noticed

- `ai_interface` worktree is clean after pushing PR5.
- Sibling `ai_actuary` keeps the intentionally untracked rollout plan doc `docs/plans/2026-05-20-ai-actuary-tool-decomposition-pr-plan.md` and local tracker/status updates.

## Next Safe Action

- Stop this tick. On the next scheduled run, inspect PR #42 checks, reviews, issue comments, and inline comments; fix only confirmed in-scope issues, otherwise squash-merge if clean and proceed to PR6.
