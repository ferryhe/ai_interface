# ai_interface Project Status

Updated: 2026-05-30

## Active Work

- Branch: `main`
- Scope: Documentation cleanup — remove workbench/archive/plans, update bilingual READMEs.

## Current State

- `ai_interface` is an AI Team Mission Control console with three user paths: Mission Center (normal), Backstage (execution/inspection), Operator (governance).
- Mission Center provides intake, plan review, approval, and execution handoff for normal users.
- Backstage offers Agents, Skills, Runs, and Artifacts inspection tabs.
- Operator Backstage provides read-only manifest viewing and guarded custom-manifest mutation.
- Built-in skills: web_listening, doc_to_md, md_to_rag, rag_to_agent, climate_monitor, ai_actuary.
- Built-in agent: knowledge_builder.
- Skill and Agent manifests are YAML-backed with builtin/community/custom loading and override policies.
- Planner providers: OpenAI (default), Anthropic, Ollama, deterministic fallback.
- DAG execution supported with configurable concurrency (AI_INTERFACE_DAG_MAX_CONCURRENCY).
- All API responses redact secret values, provider/MCP URLs, tokens, and local paths.

## Verification

```bash
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm run typecheck:libs
corepack pnpm run skill:validate
corepack pnpm run agent:validate
```
