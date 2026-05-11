# ai_interface Project Status

Updated: 2026-05-11

## Active Work

- Branch: `codex/configure-agent-control-plane`
- Scope: Implement the Configure Agent control plane inside `ai_interface` only.
- Sibling repos: off-limits for this task. Module repos remain external CLI/API services.

## Current State

- Replit Run button/workflow now starts the mockup sandbox on port 8080 and opens the Agent Module OS page by default.
- Mockup sandbox root can render `ai-os/AgentFirstInterface` when `VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface` is set.
- Follow-up for PR #4 evaluated Copilot review comments and applied confirmed-safe fixes.
- Module run creation now uses DB conflict upsert on `(module_id, external_run_id)` to keep idempotent ingest race-safe.
- `threadId` was removed from the public create-module-run contract until thread linkage has storage semantics.
- `pipelineRunId` now has explicit existence validation before module runs are stored.
- Added the superseding Agent Module OS + Postgres memory plan.
- Added contract fixtures for `web_listening`, `doc_to_md`, `md_to_rag`, and `rag_to_agent`.
- Added module registry, ingest service, DB-backed repository, and API routes for module runs, events, artifacts, and module catalog.
- DB-backed ingest now upserts the static module catalog before storing module runs/artifacts, so first-time external module POSTs have the required foreign-key rows.
- Added Drizzle schema for agent threads/messages, module catalog, pipeline runs, module runs, run events, artifacts, and typed data records.
- Updated OpenAPI spec and regenerated API client/Zod outputs.
- Reworked the mockup sandbox AI OS screen into a Replit-like Agent-first console with Agent, Modules, Progress, Data, and Deploy views.
- Updated Windows native optional package overrides so local Vite/Rollup builds can run on this workspace.
- PR #4 was confirmed merged on 2026-05-10 before this branch was created from latest `main`.
- Added a DB-backed Agent configuration model with default OpenAI Responses runtime settings, module skill controls, memory settings, and safety settings.
- Added `/api/agent-config` GET/PUT and `/api/agent-config/test-connection`; the connection endpoint only reports whether `OPENAI_API_KEY` is present.
- Added a Configure view to the Agent Module OS UI with Provider, Model, Skills, Memory, Safety, and Runtime Preview sections; it falls back to local draft state when `/api` is offline.
- Split Configure skills into business module skills and lightweight general skills. Business skills remain the fixed module chain; general skills track installed/available status, on-demand install allowance, approval, and network flags.
- Added detailed Configure explanations: a capability map, section-level explainers, and per-skill purpose/trigger/action/result/boundary guidance so users can understand what each feature does.
- Reworked Configure skill explanations into compact per-row `?` help controls and added switch guides for business/general skill toggles.
- PR #5 follow-up found two actionable Copilot comments and applied narrow fixes: `GET /api/agent-config` now returns a 500 `ErrorResponse` on unexpected failures, and Configure form controls now have programmatic label associations.

## Verification

- Run action validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Run action validation: `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Run action validation: `.replit` parsed as TOML with `runButton = "Project"`, `Agent Module OS` workflow, and port 8080 mapped to external 80.
- Run action browser smoke: `http://127.0.0.1:8080/` rendered `Agent Module OS` with all four module IDs and no console warnings/errors.
- Follow-up validation: `corepack pnpm --filter @workspace/api-server run test` passed with 6 tests.
- Follow-up validation: `corepack pnpm --filter @workspace/api-server run build` passed.
- Follow-up validation: `corepack pnpm run typecheck:libs` passed.
- Follow-up validation: `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed.
- Follow-up validation: `PORT=3000 BASE_PATH=/ corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- `corepack pnpm --filter @workspace/api-server run test` passed.
- `corepack pnpm run typecheck:libs` passed.
- `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed.
- `corepack pnpm --filter @workspace/api-server run build` passed.
- `PORT=3000 BASE_PATH=/ corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed after the DB repository update.
- Browser smoke opened `http://127.0.0.1:3000/preview/ai-os/AgentFirstInterface`, verified Agent/Modules/Progress/Data/Deploy navigation by DOM, and found no console errors or warnings.
- Configure validation: `corepack pnpm --filter @workspace/api-server run test` passed with 9 tests.
- Configure validation: `corepack pnpm --filter @workspace/api-server run build` passed.
- Configure validation: `corepack pnpm run typecheck:libs` passed.
- Configure validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Configure validation: `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Configure validation: `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed.
- Configure browser smoke opened `http://127.0.0.1:8081/`, clicked Configure, verified Provider/Model/Skills/Memory/Safety/Runtime Preview sections, and found no console warnings/errors.
- Skill split validation: `corepack pnpm --filter @workspace/api-server run test` passed with 9 tests after first observing the expected failing tests for missing business/general skill fields.
- Skill split validation: `corepack pnpm run typecheck:libs` passed.
- Skill split validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Skill split validation: `corepack pnpm --filter @workspace/api-server run build` passed.
- Skill split validation: `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Skill split validation: `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed.
- Skill split browser smoke opened `http://127.0.0.1:8081/`, verified Business Skills and General Skills sections plus Web Search/File Tools rows, and found no console warnings/errors.
- Explanation UI validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Explanation UI validation: `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Explanation UI browser smoke opened `http://127.0.0.1:8081/`, verified capability map plus Purpose/When used/Agent action/Result/Boundary details, and found no console warnings/errors.
- Skill help popover validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- Skill help popover validation: `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- Skill help popover browser smoke opened `http://127.0.0.1:8081/`, verified Business Skills and General Skills switch guides, confirmed details are hidden until a per-row `?` is opened, and found no console warnings/errors.
- PR #5 follow-up: GitHub reported PR #5 OPEN, mergeable, merge state clean, with no checks reported on the branch.
- PR #5 follow-up validation: `corepack pnpm --filter @workspace/api-server run test` passed with 9 tests.
- PR #5 follow-up validation: `corepack pnpm --filter @workspace/api-server run build` passed.
- PR #5 follow-up validation: `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passed.
- PR #5 follow-up validation: `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- PR #5 follow-up validation: `git diff --check` passed with CRLF warnings only.
- PR #5 follow-up browser smoke opened `http://127.0.0.1:8081/`, verified Configure labels can locate Model/System prompt/Promotion/Collection/Retention days/Max tool steps controls, verified Endpoint/Reasoning groups are named, and found no console warnings/errors.

## Notes

- `corepack pnpm run typecheck` on this Windows host starts correctly but the root script invokes bare `pnpm`, which is not available on PATH in this shell; equivalent library and artifact/script typechecks were run directly with `corepack pnpm` and passed.
- Browser screenshot capture timed out in the current in-app browser connection, so visual validation used DOM navigation and console checks.

## Next Action

- Continue PR #5 review/check follow-up on `codex/configure-agent-control-plane`.
