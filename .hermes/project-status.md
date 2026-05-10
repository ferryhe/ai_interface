# ai_interface Project Status

Updated: 2026-05-10

## Active Work

- Branch: `codex/agent-module-os-memory`
- Scope: Implement the AI Agent Module OS plan inside `ai_interface` only.
- Sibling repos: off-limits for this task. Module repos remain external CLI/API services.

## Current State

- Added the superseding Agent Module OS + Postgres memory plan.
- Added contract fixtures for `web_listening`, `doc_to_md`, `md_to_rag`, and `rag_to_agent`.
- Added module registry, ingest service, DB-backed repository, and API routes for module runs, events, artifacts, and module catalog.
- DB-backed ingest now upserts the static module catalog before storing module runs/artifacts, so first-time external module POSTs have the required foreign-key rows.
- Added Drizzle schema for agent threads/messages, module catalog, pipeline runs, module runs, run events, artifacts, and typed data records.
- Updated OpenAPI spec and regenerated API client/Zod outputs.
- Reworked the mockup sandbox AI OS screen into a Replit-like Agent-first console with Agent, Modules, Progress, Data, and Deploy views.
- Updated Windows native optional package overrides so local Vite/Rollup builds can run on this workspace.

## Verification

- `corepack pnpm --filter @workspace/api-server run test` passed.
- `corepack pnpm run typecheck:libs` passed.
- `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed.
- `corepack pnpm --filter @workspace/api-server run build` passed.
- `PORT=3000 BASE_PATH=/ corepack pnpm --dir artifacts/mockup-sandbox run build` passed.
- `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed after the DB repository update.
- Browser smoke opened `http://127.0.0.1:3000/preview/ai-os/AgentFirstInterface`, verified Agent/Modules/Progress/Data/Deploy navigation by DOM, and found no console errors or warnings.

## Notes

- `corepack pnpm run typecheck` on this Windows host starts correctly but the root script invokes bare `pnpm`, which is not available on PATH in this shell; equivalent library and artifact/script typechecks were run directly with `corepack pnpm` and passed.
- Browser screenshot capture timed out in the current in-app browser connection, so visual validation used DOM navigation and console checks.

## Next Action

- Commit, push, and open a PR for `codex/agent-module-os-memory`.
