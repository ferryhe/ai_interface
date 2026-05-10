# AI Agent Module OS + Database Memory Plan

This plan supersedes `docs/plans/2026-05-05-agent-cli-contract-plan.md`.

## Goal

Build `ai_interface` as the top-level Agent console for module-driven AI workflows. Users talk to Agent, Agent calls independent module services, and every step stores displayable state and artifacts in Postgres.

## Module Boundary

The existing module repos remain independent and are not edited from this project:

- `web_listening`: monitored URLs, snapshots, extracted text, change events.
- `doc_to_md`: source documents, converted Markdown, conversion warnings, extracted assets.
- `md_to_rag`: Markdown chunks, token counts, embedding metadata, index status.
- `rag_to_agent`: generated agent configs, prompts, tools, and validation results.

`ai_interface` owns only the foreground console, API ingest contract, database memory model, and result displays.

## Storage Model

Postgres is the source of truth for v1 display data:

- Agent threads and messages.
- Module catalog metadata.
- Pipeline runs and module runs.
- Module run events.
- Displayable artifacts.
- Typed data records for snapshots, Markdown docs, chunks, RAG indexes, and generated agents.

Large binary storage is out of v1 unless a module returns it as required display data.

## API Ingest Contract

External modules integrate by POSTing standard JSON payloads to `ai_interface`:

- `GET /api/modules`
- `POST /api/module-runs`
- `GET /api/module-runs/{runId}`
- `PATCH /api/module-runs/{runId}`
- `POST /api/module-runs/{runId}/events`
- `POST /api/module-runs/{runId}/artifacts`
- `GET /api/artifacts/{artifactId}`

Idempotency is keyed by `moduleId + externalRunId`. Repeating `POST /api/module-runs` updates the same run instead of duplicating data.

## Frontend Surfaces

- `Agent`: Replit-like chat control surface with run cards, approvals, and links into results.
- `Modules`: module hub plus module detail pages.
- `Progress`: cross-module run timeline and background task state.
- `Data`: database explorer for snapshots, Markdown docs, chunks, RAG records, and generated agents.
- `Deploy`: final agent availability and publish/handoff state.

## Verification

- DB schema typecheck.
- API service tests for module validation and idempotent ingest.
- OpenAPI codegen and generated Zod/client types.
- Frontend desktop/tablet/mobile smoke.
- Required commands:
  - `pnpm run typecheck`
  - `pnpm --filter @workspace/api-server run test`
  - `PORT=3000 BASE_PATH=/ pnpm --dir artifacts/mockup-sandbox run build`
