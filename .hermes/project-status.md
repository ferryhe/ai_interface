# ai_interface Project Status

Updated: 2026-05-20

## Active Work

- Branch: `codex/mcp-executor`
- Scope: PR6 of the Skill Registry Generalization program: add an optional, real-mode MCP tool executor for manifest-declared MCP skills.
- Sibling repos: off-limits; edits and validation remain confined to `ai_interface`.

## Current State

- `codex/mcp-executor` was fast-forwarded from `bceb961` to `origin/main` at `0eb13dc`, which includes PR #41 ai_actuary CLI executor support and PR #42 actuarial pipeline runner/API visibility.
- PR6 MCP executor changes were reapplied on top of the updated main branch. The only manual merge conflict was `.hermes/project-status.md`; manifest, adapter, OpenAPI, and generated client changes auto-merged and were regenerated from the combined source.
- Combined runtime intent: main's `ai_actuary` CLI/working-directory/pipeline additions are preserved, while PR6 keeps MCP metadata (`mcpServerEnv`, `mcpToolName`), MCP adapter kind support, and the real-mode-only MCP executor path.
- Added a narrow Windows compatibility fix for main's manifest-owned CLI allowlist parsing so executable paths containing spaces still match their allowed command prefixes.
- Added a narrow Windows test compatibility guard for the actuarial pipeline symlink test: it now skips only when the host denies symlink creation before the service assertion can run.
- Addressed the confirmed P2 MCP redaction review finding: env-derived MCP secrets are scrubbed in raw, slash-normalized, slash-escaped, and JSON-escaped forms, and JSON-quoted header/token-like values are redacted from MCP result content and caught error messages.
- PR6 review gates passed: spec review found no blockers; code-quality/security review found one MCP redaction gap, and re-review approved after the escaped-secret/header regression fix.
- Opened PR #43 for `codex/mcp-executor`: https://github.com/ferryhe/ai_interface/pull/43
- Scheduled follow-up automation `pr-43-follow-up` to check GitHub checks and remote review/Copilot comments about 15 minutes after PR creation, then merge and clean up the work branch if clean.
- Unrelated untracked `vite-smoke.out.log` remains untouched.

## Verification

- `corepack pnpm --filter @workspace/api-spec run codegen` passed and ran `typecheck:libs`.
- `corepack pnpm --filter @workspace/api-server run test` passed with 194 passing, 1 skipped on Windows symlink privilege (`EPERM`), and 0 failures after adding MCP escaped-secret/header regression coverage.
- `corepack pnpm --filter @workspace/api-server run typecheck` passed.
- `corepack pnpm --filter @workspace/api-server run build` passed.
- `corepack pnpm run typecheck:libs` passed.
- `git diff --check` passed with CRLF warnings only.
- Controller validation passed after re-running `corepack pnpm --filter @workspace/api-spec run codegen`, `corepack pnpm --filter @workspace/api-server run test`, `corepack pnpm --filter @workspace/api-server run typecheck`, `corepack pnpm --filter @workspace/api-server run build`, `corepack pnpm run typecheck:libs`, and `git diff --check`.

## Next Action

- Wait for `pr-43-follow-up` to evaluate remote checks/reviews/Copilot comments, apply only confirmed-safe fixes if needed, merge PR #43 if clean, delete `codex/mcp-executor`, update `main`, then start PR7 from latest `main`.
