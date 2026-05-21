# Agent Registry Flexible Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class Agent Registry, flexible agent creation/import, and Run/Artifact inspection so `ai_interface` becomes a business-agent orchestration console rather than only a skill catalog.

**Architecture:** Build an `AgentManifest` system parallel to the existing YAML-backed `SkillManifest` system. Agents are data files that bind instructions, provider preferences, planner defaults, permissions, memory policy, handoffs, and allowed skills; the runtime selects an agent, resolves its skills through `SkillRuntimeRegistry`, creates normal pipeline/module runs, and records agent metadata for inspection. Write surfaces stay scoped to `agents/custom` behind explicit management APIs or scripts, while built-in and community manifests remain reviewed files.

**Tech Stack:** TypeScript ESM, Express, Node `node:test`, Zod/OpenAPI/codegen, YAML manifests, React/Vite mockup sandbox, Drizzle-backed run storage, `corepack pnpm`, existing safe CLI/HTTP/MCP executor boundaries.

---

## Product Position

`ai_interface` should not compete with VS Code Agent View as a generic developer workbench. Its value is narrower and stronger:

- define business agents as reusable configuration;
- bind those agents to approved skills and tools;
- execute agent runs as observable pipelines;
- inspect intermediate events, inputs, outputs, artifacts, approvals, and failures;
- import/export enough configuration to cooperate with VS Code, Codex, Copilot, and MCP clients.

The target management model is:

```text
Agent Registry
  agent.yaml files, resolved skill bindings, provider/planner defaults, permissions, handoffs

Skill Registry
  skill.yaml files, CLI/HTTP/MCP/internal execution metadata, schemas, readiness, UI renderers

Run Inspector
  threads, pipeline runs, module runs, events, artifacts, approvals, raw JSON

Import/Export
  generate custom agent manifests, import VS Code .agent.md files, export ai_interface agents
```

## Project Boundaries

- Writable scope is only the `ai_interface` repository root for the active worker checkout.
- Sibling repositories remain off-limits unless a future task explicitly names one.
- Do not copy secrets, `.env` files, generated credentials, or unreviewed artifacts.
- Keep `moduleId` compatibility; add `agentId` without breaking existing `POST /api/agent-runs` callers.
- Real external execution remains opt-in through existing safe executor rules.
- Management write APIs may write only under `agents/custom/<agentId>/agent.yaml` and must reject path traversal, absolute paths, built-in roots, and community roots.
- Each PR starts from latest `main` on a `codex/...` branch and updates `.hermes/project-status.md`.

## Delivery Strategy

Deliver this as six sequential PRs. Each PR must leave the product in a working state and avoid UI promises that are not backed by API/runtime behavior.

1. Agent Manifest and Registry Foundation
2. Agent-Aware Runtime Selection
3. Run and Artifact Inspector Indexes
4. Safe Agent Creation and Import
5. Agent/Skill/Run/Artifact Workbench UI
6. VS Code and MCP Interop Export

## PR 1: Agent Manifest and Registry Foundation

### Goal

Create a file-backed `AgentManifest` contract and read-only `AgentRuntimeRegistry` that can list built-in, community, and custom agents, validate their skill references, and expose them through `GET /api/agents`.

### Files

- Create: `agents/builtin/knowledge_builder/agent.yaml`
- Create: `agents/community/README.md`
- Create: `agents/custom/.gitkeep`
- Modify: `.gitignore`
- Create: `artifacts/api-server/src/agent-registry/agent-manifest.ts`
- Create: `artifacts/api-server/src/agent-registry/agent-loader.ts`
- Create: `artifacts/api-server/src/agent-registry/agent-runtime-registry.ts`
- Create: `artifacts/api-server/src/agent-registry/agent-loader.test.ts`
- Create: `artifacts/api-server/src/agent-registry/agent-runtime-registry.test.ts`
- Create: `artifacts/api-server/src/routes/agents.ts`
- Create: `artifacts/api-server/src/routes/agents.test.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Create: `scripts/src/validate-agents.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Agent Manifest Contract

- [ ] Add `AgentManifest` and related types in `agent-manifest.ts`:

```ts
import type { AgentProvider, AgentReasoningEffort } from "../agent-config/agent-config-service";
import type { AgentRuntimePlanMode, DagFailureStrategy } from "../agent-runtime/agent-runtime-service";
import type { SkillId } from "../skill-runtime/skill-manifest";

export type AgentId = string;
export type AgentSource = "builtin" | "community" | "custom" | "external";
export type AgentMemoryPromotionMode = "manual" | "run_summary" | "disabled";

export interface AgentSkillBinding {
  skillId: SkillId;
  required: boolean;
}

export interface AgentHandoff {
  targetAgentId: AgentId;
  description: string;
}

export interface AgentManifest {
  agentId: AgentId;
  name: string;
  title?: string;
  description: string;
  source: AgentSource;
  instructions: string;
  skills: AgentSkillBinding[];
  provider?: {
    provider?: AgentProvider;
    modelId?: string;
    reasoningEffort?: AgentReasoningEffort;
  };
  planner: {
    mode: AgentRuntimePlanMode;
    failureStrategy: DagFailureStrategy;
  };
  permissions: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
  memory: {
    promotionMode: AgentMemoryPromotionMode;
  };
  handoffs: AgentHandoff[];
  tests: Array<{
    name: string;
    prompt: string;
    expectedSkillIds: SkillId[];
  }>;
}
```

- [ ] Use these defaults when optional YAML sections are omitted:

```ts
export const defaultAgentManifestValues = {
  planner: {
    mode: "linear",
    failureStrategy: "fail_fast",
  },
  permissions: {
    approvalRequired: false,
    canUseNetwork: false,
    canWriteDatabase: true,
  },
  memory: {
    promotionMode: "run_summary",
  },
  handoffs: [],
  tests: [],
} as const;
```

### YAML Loader

- [ ] Add `agent-loader.ts` with this public function:

```ts
export interface LoadAgentManifestsOptions {
  roots?: string[];
  cwd?: string;
  readFile?: (path: string) => Promise<string>;
  exists?: (path: string) => boolean;
  env?: Record<string, string | undefined>;
}

export async function loadAgentManifests(
  options: LoadAgentManifestsOptions = {},
): Promise<AgentManifest[]> {
  // scan roots, parse agent.yaml, normalize defaults, validate, sort
}
```

- [ ] Load default roots in this order:

```ts
const DEFAULT_AGENT_ROOTS = [
  "agents/builtin",
  "agents/community",
  "agents/custom",
];
```

- [ ] Apply the same override policy used by skills:
  - community cannot override built-in `agentId`;
  - custom can override community for local testing;
  - custom cannot override built-in unless `AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE=1`.

- [ ] Validate every `agentId` with the shared `AGENT_ID_PATTERN` used by manifest writing:

```ts
export const AGENT_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
```

- [ ] Validate referenced `skillId` values as non-empty strings so existing skill IDs remain compatible with the skill manifest contract.
- [ ] Validate `planner.mode` as `"linear" | "dag"`.
- [ ] Validate `planner.failureStrategy` as `"fail_fast" | "continue_independent"`.
- [ ] Validate `memory.promotionMode` as `"manual" | "run_summary" | "disabled"`.

### Built-In Agent

- [ ] Add `agents/builtin/knowledge_builder/agent.yaml`:

```yaml
agentId: knowledge_builder
name: Knowledge Builder
description: Turn approved web and document sources into a RAG-backed agent configuration.
source: builtin
instructions: |
  Build an inspectable knowledge pipeline from approved sources. Plan with the smallest
  set of enabled skills that can monitor sources, convert documents, prepare RAG records,
  and generate an agent configuration. Preserve intermediate artifacts for review.
skills:
  - skillId: web_listening
    required: false
  - skillId: doc_to_md
    required: false
  - skillId: md_to_rag
    required: true
  - skillId: rag_to_agent
    required: true
planner:
  mode: dag
  failureStrategy: fail_fast
permissions:
  approvalRequired: true
  canUseNetwork: true
  canWriteDatabase: true
memory:
  promotionMode: run_summary
handoffs: []
tests:
  - name: build_from_markdown
    prompt: Build an agent from approved Markdown source material.
    expectedSkillIds:
      - md_to_rag
      - rag_to_agent
```

### Runtime Registry

- [ ] Add `AgentRuntimeRegistry`:

```ts
export interface AgentRuntimeRegistry {
  listAgents(): AgentManifest[];
  listAgentIds(): string[];
  getAgent(agentId: string): AgentManifest | null;
  hasAgent(agentId: string): boolean;
  listSkillIdsForAgent(agentId: string): string[];
  validateSkillReferences(): Array<{
    agentId: string;
    missingSkillIds: string[];
  }>;
}
```

- [ ] Implement `createAgentRuntimeRegistry(agentManifests, skillRegistry)` so it clones returned manifests and resolves skill references through the existing `SkillRuntimeRegistry`.
- [ ] Export `defaultAgentRuntimeRegistry` using `loadAgentManifests()` and `defaultSkillRuntimeRegistry`.

### API

- [ ] Add `GET /api/agents` returning:

```json
{
  "agents": [],
  "readiness": []
}
```

- [ ] Include readiness entries with no secret or absolute path values:

```ts
export interface AgentReadiness {
  agentId: string;
  status: "ready" | "missing_skills";
  missingSkillIds: string[];
  enabledSkillIds: string[];
}
```

### Tests

- [ ] `agent-loader.test.ts` verifies built-in `knowledge_builder` loads with normalized defaults.
- [ ] `agent-loader.test.ts` verifies duplicate `agentId` errors include both manifest paths.
- [ ] `agent-loader.test.ts` verifies community cannot override built-in.
- [ ] `agent-loader.test.ts` verifies custom can override community.
- [ ] `agent-loader.test.ts` verifies custom cannot override built-in without `AI_INTERFACE_ALLOW_BUILTIN_AGENT_OVERRIDE=1`.
- [ ] `agent-runtime-registry.test.ts` verifies missing skill references are reported but do not crash listing.
- [ ] `routes/agents.test.ts` verifies injected registries can serve one custom agent with one custom skill.
- [ ] `scripts/src/validate-agents.ts` prints redacted JSON with agent IDs, sources, skill IDs, and missing skill IDs.

### Verification

```powershell
corepack pnpm run agent:validate
corepack pnpm run skill:validate
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
git diff --check
```

## PR 2: Agent-Aware Runtime Selection

### Goal

Allow `POST /api/agent-runs` to specify `agentId`, derive enabled skills and planner defaults from that agent, and record agent metadata on threads, pipeline runs, messages, and module runs.

### Files

- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
- Modify: `artifacts/api-server/src/routes/agent-runs.ts`
- Modify: `artifacts/api-server/src/routes/agent-runs.test.ts`
- Modify: `artifacts/api-server/src/agent-config/agent-config-service.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Runtime Changes

- [ ] Extend `CreateAgentRunInput`:

```ts
export interface CreateAgentRunInput {
  message: string;
  agentId?: string;
  threadId?: string;
  title?: string;
  metadata?: JsonObject;
  executionMode?: AgentRunExecutionMode;
  enabledSkillIds?: string[];
}
```

- [ ] Add an optional `agentRegistry` to `createAgentRun` options:

```ts
options: {
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  planner?: AgentPlanner;
  skillManifests?: SkillManifest[];
  registry?: SkillRuntimeRegistry;
  agentRegistry?: AgentRuntimeRegistry;
} = {}
```

- [ ] Resolve the active agent before selecting skills:

```ts
const activeAgent = input.agentId
  ? agentRegistry.getAgent(input.agentId)
  : null;

if (input.agentId && !activeAgent) {
  throw new Error(`Agent is not registered: ${input.agentId}`);
}
```

- [ ] Skill selection precedence:
  - `input.enabledSkillIds` when provided;
  - `activeAgent.skills.map((binding) => binding.skillId)` when `agentId` is provided;
  - existing config-based skill settings when `agentId` is omitted.

- [ ] Planner defaults:
  - agent `planner.mode` becomes the fallback when the planner omits `mode`;
  - agent `planner.failureStrategy` becomes the fallback when the planner omits `failureStrategy`;
  - agent provider fields override saved config only for this run and do not persist to DB.

- [ ] Add agent metadata to newly created records:

```ts
metadata: {
  source: "agent-runtime",
  agentId: activeAgent?.agentId,
  agentName: activeAgent?.title ?? activeAgent?.name,
  agentSkillIds: activeAgent?.skills.map((binding) => binding.skillId),
}
```

### Tests

- [ ] Existing `POST /api/agent-runs` behavior passes when no `agentId` is supplied.
- [ ] Unknown `agentId` returns 400 with `Agent is not registered`.
- [ ] `agentId: "knowledge_builder"` selects exactly the skills declared by that agent when `enabledSkillIds` is absent.
- [ ] `enabledSkillIds` overrides the agent skill list for a single run.
- [ ] Missing skill references in an agent are filtered with a warning and do not create module runs.
- [ ] Agent planner defaults set DAG mode when a deterministic planner omits `mode`.
- [ ] Pipeline run metadata includes `agentId`, `agentName`, and `agentSkillIds`.
- [ ] Module run metadata includes `agentId` and the selected skill ID.

### Verification

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
git diff --check
```

## PR 3: Run and Artifact Inspector Indexes

### Goal

Make the "middle process" easy to inspect by adding list/filter endpoints for agent runs, module runs, run events, and artifacts, without changing execution semantics.

### Files

- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Modify: `artifacts/api-server/src/agent-runtime/db-repository.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
- Modify: `artifacts/api-server/src/modules/ingest-service.ts`
- Modify: `artifacts/api-server/src/modules/db-repository.ts`
- Modify: `artifacts/api-server/src/modules/db-repository.test.ts`
- Create: `artifacts/api-server/src/routes/run-inspector.ts`
- Create: `artifacts/api-server/src/routes/run-inspector.test.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### API

- [ ] Add `GET /api/runs` with filters:

```text
agentId
skillId
moduleId
status
limit
```

- [ ] Add `GET /api/runs/:pipelineRunId/timeline` returning ordered thread messages, pipeline state, module runs, and run events.
- [ ] Add `GET /api/artifacts` with filters:

```text
pipelineRunId
moduleRunId
kind
limit
```

- [ ] Redact raw adapter env values, tokens, provider keys, local provider URLs, MCP server URLs, and absolute configured local paths from all inspector responses.

### Tests

- [ ] `GET /api/runs?agentId=knowledge_builder` returns only runs whose metadata contains that `agentId`.
- [ ] `GET /api/runs?skillId=md_to_rag` returns runs with at least one matching module run.
- [ ] `GET /api/runs/:pipelineRunId/timeline` returns events in creation order.
- [ ] `GET /api/artifacts?pipelineRunId=...` returns artifacts from all module runs in that pipeline.
- [ ] Inspector redaction test confirms configured env values do not appear in serialized JSON.

### Verification

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
git diff --check
```

## PR 4: Safe Agent Creation and Import

### Goal

Make adding agents low-friction while keeping write access narrow: local scripts and an optional API create or import manifests only under `agents/custom`.

### Files

- Create: `artifacts/api-server/src/agent-registry/agent-manifest-writer.ts`
- Create: `artifacts/api-server/src/agent-registry/agent-manifest-writer.test.ts`
- Create: `artifacts/api-server/src/agent-registry/vscode-agent-importer.ts`
- Create: `artifacts/api-server/src/agent-registry/vscode-agent-importer.test.ts`
- Create: `artifacts/api-server/src/routes/agent-manifests.ts`
- Create: `artifacts/api-server/src/routes/agent-manifests.test.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Create: `scripts/src/create-agent.ts`
- Create: `scripts/src/import-vscode-agent.ts`
- Modify: `scripts/package.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Safe Writer

- [ ] Add a writer that accepts only `agentId` and manifest data, then writes to:

```ts
resolve(cwd, "agents", "custom", agentId, "agent.yaml")
```

- [ ] Reject `agentId` values that do not match:

```ts
const AGENT_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
```

- [ ] Reject existing custom agents unless `overwrite: true`.
- [ ] Reject built-in/community target roots unconditionally.
- [ ] Re-load the written manifest and return the normalized result.

### Create Script

- [ ] Add `corepack pnpm run agent:create -- --agent-id my_agent --name "My Agent" --skills doc_to_md,md_to_rag` that writes a valid custom agent manifest.
- [ ] The generated file must include:

```yaml
agentId: my_agent
name: My Agent
description: Custom agent created from the local generator.
source: custom
instructions: |
  Use the selected skills to complete the user's request while preserving
  intermediate artifacts for review.
skills:
  - skillId: doc_to_md
    required: false
  - skillId: md_to_rag
    required: false
planner:
  mode: linear
  failureStrategy: fail_fast
permissions:
  approvalRequired: false
  canUseNetwork: false
  canWriteDatabase: true
memory:
  promotionMode: run_summary
handoffs: []
tests: []
```

### VS Code `.agent.md` Import

- [ ] Parse YAML front matter when present.
- [ ] Treat Markdown body as `instructions`.
- [ ] Map `tools` or `skills` front matter entries to skill bindings when they match registered `skillId` values.
- [ ] Store unmatched entries in a warning list and do not invent skills.

### Optional API

- [ ] Add `POST /api/agent-manifests` only when `AI_INTERFACE_MANIFEST_WRITE_MODE=custom` is set.
- [ ] Return 403 when the env flag is not set.
- [ ] Accept JSON input and create a custom manifest through `agent-manifest-writer.ts`.

### Tests

- [ ] Writer rejects `../bad` and absolute-path-like agent IDs.
- [ ] Writer creates `agents/custom/my_agent/agent.yaml` for a valid request.
- [ ] Writer rejects overwrite when the custom manifest already exists.
- [ ] Importer maps `.agent.md` front matter plus Markdown body into an `AgentManifest`.
- [ ] Importer warns for unmatched VS Code tool names.
- [ ] API returns 403 unless `AI_INTERFACE_MANIFEST_WRITE_MODE=custom`.
- [ ] API creates and validates a custom agent when the env flag is enabled.

### Verification

```powershell
corepack pnpm run agent:create -- --agent-id smoke_agent --name "Smoke Agent" --skills md_to_rag,rag_to_agent
corepack pnpm run agent:validate
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
git diff --check
```

After the smoke command, remove only `agents/custom/smoke_agent/agent.yaml` and its empty containing directory if it was created by the smoke command in the same PR.

## PR 5: Agent/Skill/Run/Artifact Workbench UI

### Goal

Upgrade the frontend from a skill-centric view into a lightweight workbench with four primary surfaces: Agents, Skills, Runs, and Artifacts.

### Files

- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx` only if portal run visibility changes
- Create: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_components/AgentCatalog.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_components/AgentDetail.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_components/AgentManifestWizard.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_components/RunInspector.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_components/ArtifactInspector.tsx`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_shared/types.ts`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_shared/data.ts`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_shared/theme.ts`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### UI Structure

- [ ] Replace the Backstage single skill catalog with tabs:

```text
Agents | Skills | Runs | Artifacts
```

- [ ] Agent catalog shows:
  - name/title;
  - source;
  - readiness;
  - skill count;
  - last run status when available.

- [ ] Agent detail shows:
  - instructions;
  - bound skills;
  - planner mode;
  - permissions;
  - handoffs;
  - manifest JSON.

- [ ] New Agent wizard supports:
  - name;
  - description;
  - instructions;
  - skill multi-select;
  - planner mode;
  - permissions;
  - generated YAML preview.

- [ ] If `POST /api/agent-manifests` returns 403, show generated YAML and explain only through button labels/status text that local write mode is disabled.
- [ ] Test Run button calls `POST /api/agent-runs` with the selected `agentId`.
- [ ] Run Inspector shows ordered module steps, events, status, active skill, and raw JSON.
- [ ] Artifact Inspector shows artifacts grouped by pipeline run and module run.

### Tests and Smoke

- [ ] `corepack pnpm --dir artifacts/mockup-sandbox run typecheck` passes.
- [ ] Mockup build passes with:

```powershell
$env:PORT='8080'
$env:BASE_PATH='/'
$env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'
corepack pnpm --dir artifacts/mockup-sandbox run build
```

- [ ] Browser smoke verifies:
  - Agents tab renders `Knowledge Builder`;
  - Skills tab still renders existing skills;
  - Runs tab renders at least mock or API-backed run rows;
  - Artifacts tab renders an empty state without layout shift;
  - New Agent wizard produces valid YAML preview;
  - mobile width has no horizontal overflow.

### Verification

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'
$env:BASE_PATH='/'
$env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'
corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

## PR 6: VS Code and MCP Interop Export

### Goal

Let `ai_interface` cooperate with developer agent tools by exporting selected agents as VS Code-compatible `.agent.md` files and exposing run entrypoints as MCP-callable tools.

### Files

- Create: `artifacts/api-server/src/agent-registry/vscode-agent-exporter.ts`
- Create: `artifacts/api-server/src/agent-registry/vscode-agent-exporter.test.ts`
- Create: `artifacts/api-server/src/agent-registry/mcp-tool-exporter.ts`
- Create: `artifacts/api-server/src/agent-registry/mcp-tool-exporter.test.ts`
- Modify: `artifacts/api-server/src/routes/agents.ts`
- Modify: `artifacts/api-server/src/routes/agents.test.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `README.md`
- Modify: `.hermes/project-status.md`

### Export Shapes

- [ ] Add `GET /api/agents/:agentId/export/vscode-agent` returning Markdown:

```markdown
---
description: Turn approved web and document sources into a RAG-backed agent configuration.
tools:
  - web_listening
  - doc_to_md
  - md_to_rag
  - rag_to_agent
---

Build an inspectable knowledge pipeline from approved sources. Plan with the smallest
set of enabled skills that can monitor sources, convert documents, prepare RAG records,
and generate an agent configuration. Preserve intermediate artifacts for review.
```

- [ ] Add `GET /api/agents/:agentId/export/mcp-tool` returning redacted JSON metadata for an MCP wrapper:

```json
{
  "name": "run_knowledge_builder",
  "description": "Run the Knowledge Builder agent through ai_interface.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": { "type": "string" },
      "executionMode": { "type": "string", "enum": ["plan_only", "execute_ready"] }
    },
    "required": ["message"]
  }
}
```

- [ ] Do not expose API keys, local provider URLs, MCP server URLs, or configured local paths in export responses.

### Tests

- [ ] VS Code exporter includes front matter and instructions for `knowledge_builder`.
- [ ] VS Code exporter includes only registered skill IDs.
- [ ] MCP exporter generates deterministic tool names from agent IDs.
- [ ] Export endpoints return 404 for unknown agents.
- [ ] Redaction test confirms secret-looking env values are not serialized.

### Verification

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
git diff --check
```

## Global Acceptance Criteria

- A built-in agent appears in `GET /api/agents`.
- A custom agent can be created by adding or generating `agents/custom/<agentId>/agent.yaml`.
- Agent manifests can bind existing skills without TypeScript registration changes.
- `POST /api/agent-runs` can run with `agentId`.
- Run records preserve agent identity and selected skill graph.
- The workbench shows Agents, Skills, Runs, and Artifacts as first-class surfaces.
- Inspector surfaces reveal intermediate process details without exposing secrets.
- VS Code-style `.agent.md` import/export is supported through bounded parsers/exporters.
- Existing skill registry, fake execution default, safe real execution opt-in, and `moduleId` compatibility remain intact.

## Managed PR Protocol

For each PR:

- [ ] Run `git status --short --branch` before editing.
- [ ] Identify unrelated local changes and avoid staging them.
- [ ] Start from latest `main` on a fresh `codex/...` branch.
- [ ] Keep each PR scoped to the files listed in its section.
- [ ] Write failing focused tests before implementation changes.
- [ ] Run the verification commands listed for that PR.
- [ ] Update `.hermes/project-status.md`.
- [ ] Commit only scoped files.
- [ ] Push branch and create a PR.
- [ ] About 15 minutes after PR creation, check GitHub checks and review/Copilot comments.
- [ ] Fix only confirmed-safe comments, rerun focused/full checks, and push follow-up commits.

## Decisions Locked By This Plan

- Agents are first-class manifests, not just prompts stored in ad hoc metadata.
- Skills remain the unit of execution; agents select and orchestrate skills.
- Runs remain the unit of observation; inspectors read normal thread, pipeline, module-run, event, and artifact records.
- The first write path is custom-only and path-safe.
- UI comes after backend contracts so the workbench reflects real state.
- VS Code interop is import/export, not a replacement for `ai_interface` runtime semantics.

## Explicit Non-Goals

- No sibling repository edits.
- No secret copying.
- No arbitrary local script execution through agent import.
- No broad marketplace or network install workflow.
- No removal of existing skill APIs.
- No breaking change to existing `POST /api/agent-runs` callers.
- No force-push, branch deletion, or history rewrite without explicit approval.
