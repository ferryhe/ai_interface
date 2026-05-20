# ai_interface Project Status

Updated: 2026-05-20T12:09:02Z

## Active Work

- Branch: `feat/actuarial-pipeline-runner`
- Scope: PR5 of the ai_actuary tool-decomposition rollout: actuarial pipeline runner/API visibility in `ai_interface` using the existing ai_actuary CLI/file-artifact contract; no TypeScript actuarial calculation reimplementation.
- PR4 `feat/skill-manifest-cli-executor` is merged as #41 (`6205aea`).
- PR5 is open as #42: https://github.com/ferryhe/ai_interface/pull/42
- This tick inspected live GitHub state (`mergeStateStatus=CLEAN`, `mergeable=MERGEABLE`, no checks reported) and fetched inline Copilot comments.
- Accepted/fixed all 5 in-scope Copilot comments: route request/response Zod validation, trimmed accepted start body strings, bounded/nonfatal artifact payload reads, bounded/nonfatal stdout/stderr log previews, and the missing OpenAPI `pipelines` tag.
- Review gate: Codex CLI remained blocked in this environment from the prior attempt; substituted independent delegate reviewers. Initial delegate review found the log-preview read still unbounded; after fixing with `open().read()` bounded by `MAX_ARTIFACT_TEXT_BYTES`, final delegate re-review reported no blockers.

## Verification

- `corepack pnpm --filter @workspace/api-spec run codegen` ✅
- `corepack pnpm --filter @workspace/api-server run test -- runner.test.ts pipelines.test.ts` ✅ (`181 passed`; package script ran the api-server test suite)
- `corepack pnpm --filter @workspace/api-server run typecheck` ✅
- `corepack pnpm --filter @workspace/api-server run build` ✅
- `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` ✅
- `git diff --check` ✅
- Independent delegate re-review ✅ no blockers after bounded log-read fix.

## Dirty / Untracked State Noticed

- `ai_interface` has intentional PR5 follow-up changes pending commit/push in this tick.
- Sibling `ai_actuary` keeps the intentionally untracked rollout plan doc `docs/plans/2026-05-20-ai-actuary-tool-decomposition-pr-plan.md` and local tracker/status updates.

## Next Safe Action

- Commit and push this PR5 follow-up, update rollout state, then stop this tick. On the next scheduled run, re-check PR #42 remote comments/checks; merge if clean, otherwise fix only confirmed in-scope issues.
