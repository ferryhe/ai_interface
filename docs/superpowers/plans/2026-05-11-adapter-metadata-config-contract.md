# Adapter Metadata Config Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend contract that tells the Agent console which external adapter each business skill uses, which environment variables are required, and whether each adapter is ready without exposing secret values.

**Architecture:** Keep business modules independent and external. Add a read-only adapter registry in the API server, expose redacted readiness through `GET /api/tool-adapters`, and attach adapter metadata to Agent-created module runs so later executor PRs can safely pick HTTP or CLI adapters. This PR does not execute tools, spawn CLI processes, call sibling repos, or store plaintext secrets.

**Tech Stack:** TypeScript, Node test runner, Express, OpenAPI/Orval, Zod-generated validators and React client output.

---

## Scope And Boundaries

- Current repo: `C:\Project\ai_interface`.
- Branch: `codex/adapter-metadata-config-contract`.
- Sibling repositories remain off-limits; URLs are metadata only.
- This PR must not add real execution, shell spawning, HTTP calls to module services, or secret persistence.
- Required validation:
  - `corepack pnpm --filter @workspace/api-server run test`
  - `corepack pnpm --filter @workspace/api-server run build`
  - `corepack pnpm run typecheck:libs`
  - `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck`
  - `git diff --check`

## File Map

- Create `artifacts/api-server/src/tool-adapters/adapter-registry.ts`
  - Owns adapter definitions and redacted readiness calculation.
- Create `artifacts/api-server/src/tool-adapters/adapter-registry.test.ts`
  - Tests registry coverage, readiness state, and secret redaction.
- Create `artifacts/api-server/src/routes/tool-adapters.ts`
  - Exposes `GET /api/tool-adapters`.
- Modify `artifacts/api-server/src/routes/index.ts`
  - Mounts the new route.
- Modify `artifacts/api-server/src/agent-runtime/skill-registry.ts`
  - References adapter metadata instead of duplicating loose adapter fields.
- Modify `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
  - Stores adapter id/kind/source/readiness-related metadata on planned module runs.
- Modify `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`
  - Verifies planned runs include adapter metadata.
- Modify `lib/api-spec/openapi.yaml`
  - Adds `GET /tool-adapters` and adapter schemas.
- Regenerate generated API files under:
  - `lib/api-zod/src/generated/**`
  - `lib/api-client-react/src/generated/**`
- Modify `.hermes/project-status.md`
  - Records branch, scope, and validation.

## Task 1: Add Adapter Registry And Readiness Tests

**Files:**

- Create: `artifacts/api-server/src/tool-adapters/adapter-registry.ts`
- Create: `artifacts/api-server/src/tool-adapters/adapter-registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/api-server/src/tool-adapters/adapter-registry.test.ts` with these tests:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  adapterDefinitions,
  getAdapterDefinition,
  listAdapterReadiness,
} from "./adapter-registry";

test("registers one adapter for each business module", () => {
  assert.deepEqual(
    adapterDefinitions.map((adapter) => adapter.moduleId),
    ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
  );
  assert.equal(getAdapterDefinition("doc_to_md").adapterKind, "http");
  assert.equal(getAdapterDefinition("md_to_rag").adapterKind, "cli");
});

test("reports missing required env without exposing env values", () => {
  const readiness = listAdapterReadiness({
    DOC_TO_MD_API_BASE_URL: "https://doc.example.internal",
    DOC_TO_MD_API_TOKEN: "secret-token",
  });

  const docToMd = readiness.find((item) => item.moduleId === "doc_to_md");
  assert.equal(docToMd?.status, "ready");
  assert.equal(docToMd?.configured, true);
  assert.deepEqual(docToMd?.missingRequiredEnv, []);
  assert.deepEqual(docToMd?.configuredOptionalEnv, ["DOC_TO_MD_API_TOKEN"]);
  assert.equal(JSON.stringify(docToMd).includes("secret-token"), false);

  const webListening = readiness.find(
    (item) => item.moduleId === "web_listening",
  );
  assert.equal(webListening?.status, "missing_required_env");
  assert.deepEqual(webListening?.missingRequiredEnv, [
    "WEB_LISTENING_CLI_PATH",
  ]);
});

test("throws for unknown adapter module ids", () => {
  assert.throws(
    () => getAdapterDefinition("unknown" as never),
    /Adapter is not registered: unknown/,
  );
});
```

- [ ] **Step 2: Verify the tests fail for the expected reason**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: FAIL because `./adapter-registry` does not exist.

- [ ] **Step 3: Implement the adapter registry**

Create `artifacts/api-server/src/tool-adapters/adapter-registry.ts`:

```ts
import type { ModuleId } from "../modules/registry";

export type ToolAdapterKind = "http" | "cli";
export type ToolAdapterReadinessStatus = "ready" | "missing_required_env";

export interface ToolAdapterDefinition {
  adapterId: string;
  moduleId: ModuleId;
  adapterKind: ToolAdapterKind;
  displayName: string;
  description: string;
  sourceRepo: string;
  requiredEnv: string[];
  optionalEnv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  allowedCommands: string[];
  supportsResume: boolean;
  readinessHint: string;
}

export interface ToolAdapterReadiness extends Omit<
  ToolAdapterDefinition,
  "requiredEnv" | "optionalEnv"
> {
  requiredEnv: string[];
  optionalEnv: string[];
  configured: boolean;
  status: ToolAdapterReadinessStatus;
  missingRequiredEnv: string[];
  configuredOptionalEnv: string[];
}

export interface ToolAdapterListResponse {
  adapters: ToolAdapterDefinition[];
  readiness: ToolAdapterReadiness[];
}

export const adapterDefinitions: ToolAdapterDefinition[] = [
  {
    adapterId: "web_listening.cli.v1",
    moduleId: "web_listening",
    adapterKind: "cli",
    displayName: "Web Listening CLI",
    description:
      "Runs the external web_listening CLI or service adapter for monitored URL discovery, snapshots, and manifests.",
    sourceRepo: "https://github.com/ferryhe/web_listening",
    requiredEnv: ["WEB_LISTENING_CLI_PATH"],
    optionalEnv: ["WEB_LISTENING_WORKDIR", "WEB_LISTENING_API_BASE_URL"],
    timeoutMs: 120000,
    maxOutputBytes: 1048576,
    allowedCommands: [
      "discover",
      "classify",
      "plan-scope",
      "bootstrap-scope",
      "run-scope",
      "export-manifest",
    ],
    supportsResume: true,
    readinessHint:
      "Set WEB_LISTENING_CLI_PATH to the approved CLI executable path before enabling execution.",
  },
  {
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
    adapterKind: "http",
    displayName: "Doc to Markdown API",
    description:
      "Calls the external doc_to_md conversion API for engine readiness, conversion, Markdown, traces, and assets.",
    sourceRepo: "https://github.com/ferryhe/doc_to_md",
    requiredEnv: ["DOC_TO_MD_API_BASE_URL"],
    optionalEnv: ["DOC_TO_MD_API_TOKEN"],
    timeoutMs: 120000,
    maxOutputBytes: 1048576,
    allowedCommands: [],
    supportsResume: true,
    readinessHint:
      "Set DOC_TO_MD_API_BASE_URL to the approved conversion service URL. Tokens stay in environment variables.",
  },
  {
    adapterId: "md_to_rag.cli.v1",
    moduleId: "md_to_rag",
    adapterKind: "cli",
    displayName: "Markdown to RAG CLI",
    description:
      "Runs the external c-ross-2 CLI adapter for ready-data builds, validation, section search, and evidence metadata.",
    sourceRepo: "https://github.com/ferryhe/c-ross-2",
    requiredEnv: ["CROSS2_CLI_PATH"],
    optionalEnv: ["CROSS2_WORKDIR", "CROSS2_API_BASE_URL"],
    timeoutMs: 180000,
    maxOutputBytes: 1048576,
    allowedCommands: [
      "build-ready-data",
      "validate-ready-data",
      "search sections",
      "evidence",
    ],
    supportsResume: false,
    readinessHint:
      "Set CROSS2_CLI_PATH to the approved c-ross-2 entrypoint before enabling execution.",
  },
  {
    adapterId: "rag_to_agent.http.v1",
    moduleId: "rag_to_agent",
    adapterKind: "http",
    displayName: "RAG to Agent API",
    description:
      "Calls the external agent-generation API for engine config, planning, chat, and validation artifacts.",
    sourceRepo: "https://github.com/ferryhe/c-ross-2",
    requiredEnv: ["RAG_TO_AGENT_API_BASE_URL"],
    optionalEnv: ["RAG_TO_AGENT_API_TOKEN"],
    timeoutMs: 120000,
    maxOutputBytes: 1048576,
    allowedCommands: [],
    supportsResume: true,
    readinessHint:
      "Set RAG_TO_AGENT_API_BASE_URL to the approved agent-generation service URL. Tokens stay in environment variables.",
  },
];

export function getAdapterDefinition(
  moduleId: ModuleId,
): ToolAdapterDefinition {
  const definition = adapterDefinitions.find(
    (adapter) => adapter.moduleId === moduleId,
  );
  if (!definition) {
    throw new Error(`Adapter is not registered: ${String(moduleId)}`);
  }
  return definition;
}

function hasEnvValue(
  env: Record<string, string | undefined>,
  name: string,
): boolean {
  return Boolean(env[name]?.trim());
}

export function getAdapterReadiness(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
): ToolAdapterReadiness {
  const missingRequiredEnv = adapter.requiredEnv.filter(
    (name) => !hasEnvValue(env, name),
  );
  const configuredOptionalEnv = adapter.optionalEnv.filter((name) =>
    hasEnvValue(env, name),
  );
  return {
    ...adapter,
    requiredEnv: [...adapter.requiredEnv],
    optionalEnv: [...adapter.optionalEnv],
    configured: missingRequiredEnv.length === 0,
    status: missingRequiredEnv.length === 0 ? "ready" : "missing_required_env",
    missingRequiredEnv,
    configuredOptionalEnv,
  };
}

export function listAdapterReadiness(
  env: Record<string, string | undefined> = process.env,
): ToolAdapterReadiness[] {
  return adapterDefinitions.map((adapter) => getAdapterReadiness(adapter, env));
}
```

- [ ] **Step 4: Verify the tests pass**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: PASS, including the three new adapter registry tests.

## Task 2: Attach Adapter Metadata To Runtime Skill Definitions

**Files:**

- Modify: `artifacts/api-server/src/agent-runtime/skill-registry.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts`

- [ ] **Step 1: Write the failing runtime metadata test**

Add this assertion to the first test in `artifacts/api-server/src/agent-runtime/agent-runtime-service.test.ts` after the module id assertion:

```ts
assert.equal(
  result.moduleRuns[0]?.metadata?.["adapterId"],
  "web_listening.cli.v1",
);
assert.equal(result.moduleRuns[0]?.metadata?.["adapterKind"], "cli");
assert.equal(result.moduleRuns[0]?.metadata?.["supportsResume"], true);
assert.equal(
  result.moduleRuns[1]?.metadata?.["adapterId"],
  "doc_to_md.http.v1",
);
```

- [ ] **Step 2: Verify the test fails**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: FAIL because planned module run metadata does not include `adapterId`.

- [ ] **Step 3: Update skill definitions to carry adapter metadata**

In `artifacts/api-server/src/agent-runtime/skill-registry.ts`:

1. Import the adapter type and lookup:

```ts
import {
  getAdapterDefinition,
  type ToolAdapterDefinition,
} from "../tool-adapters/adapter-registry";
```

2. Add to `BusinessSkillDefinition`:

```ts
adapter: ToolAdapterDefinition;
```

3. For each `businessSkillDefinitions` item, add `adapter: getAdapterDefinition("<moduleId>")`.

- [ ] **Step 4: Store adapter metadata in planned module runs**

In `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts`, inside the `metadata` object passed to `createModuleRun`, add these keys:

```ts
        adapterId: definition.adapter.adapterId,
        adapterKind: definition.adapter.adapterKind,
        adapterRequiredEnv: definition.adapter.requiredEnv,
        adapterOptionalEnv: definition.adapter.optionalEnv,
        adapterTimeoutMs: definition.adapter.timeoutMs,
        adapterMaxOutputBytes: definition.adapter.maxOutputBytes,
        adapterAllowedCommands: definition.adapter.allowedCommands,
        supportsResume: definition.adapter.supportsResume,
        readinessHint: definition.adapter.readinessHint,
```

- [ ] **Step 5: Verify runtime tests pass**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: PASS.

## Task 3: Expose `GET /api/tool-adapters`

**Files:**

- Create: `artifacts/api-server/src/routes/tool-adapters.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/**`
- Regenerate: `lib/api-client-react/src/generated/**`

- [ ] **Step 1: Create the Express route**

Create `artifacts/api-server/src/routes/tool-adapters.ts`:

```ts
import { Router, type IRouter } from "express";
import { GetToolAdaptersResponse } from "@workspace/api-zod";

import {
  adapterDefinitions,
  listAdapterReadiness,
} from "../tool-adapters/adapter-registry";

const router: IRouter = Router();

router.get("/tool-adapters", (_req, res) => {
  const data = GetToolAdaptersResponse.parse({
    adapters: adapterDefinitions,
    readiness: listAdapterReadiness(process.env),
  });
  res.json(data);
});

export default router;
```

- [ ] **Step 2: Mount the route**

In `artifacts/api-server/src/routes/index.ts`, add:

```ts
import toolAdaptersRouter from "./tool-adapters";
```

Then mount it before modules:

```ts
router.use(toolAdaptersRouter);
```

- [ ] **Step 3: Add OpenAPI path**

In `lib/api-spec/openapi.yaml`, add under `paths`:

```yaml
/tool-adapters:
  get:
    operationId: getToolAdapters
    tags: [tool-adapters]
    summary: List tool adapters and redacted readiness
    description: Returns adapter metadata and environment-variable readiness without exposing secret values.
    responses:
      "200":
        description: Tool adapter registry
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ToolAdapterListResponse"
```

- [ ] **Step 4: Add OpenAPI schemas**

In `lib/api-spec/openapi.yaml`, add these schemas under `components.schemas`:

```yaml
ToolAdapterKind:
  type: string
  enum:
    - http
    - cli
ToolAdapterReadinessStatus:
  type: string
  enum:
    - ready
    - missing_required_env
ToolAdapterDefinition:
  type: object
  properties:
    adapterId:
      type: string
    moduleId:
      $ref: "#/components/schemas/ModuleId"
    adapterKind:
      $ref: "#/components/schemas/ToolAdapterKind"
    displayName:
      type: string
    description:
      type: string
    sourceRepo:
      type: string
      format: uri
    requiredEnv:
      type: array
      items:
        type: string
    optionalEnv:
      type: array
      items:
        type: string
    timeoutMs:
      type: integer
      minimum: 1
    maxOutputBytes:
      type: integer
      minimum: 1
    allowedCommands:
      type: array
      items:
        type: string
    supportsResume:
      type: boolean
    readinessHint:
      type: string
  required:
    - adapterId
    - moduleId
    - adapterKind
    - displayName
    - description
    - sourceRepo
    - requiredEnv
    - optionalEnv
    - timeoutMs
    - maxOutputBytes
    - allowedCommands
    - supportsResume
    - readinessHint
ToolAdapterReadiness:
  allOf:
    - $ref: "#/components/schemas/ToolAdapterDefinition"
    - type: object
      properties:
        configured:
          type: boolean
        status:
          $ref: "#/components/schemas/ToolAdapterReadinessStatus"
        missingRequiredEnv:
          type: array
          items:
            type: string
        configuredOptionalEnv:
          type: array
          items:
            type: string
      required:
        - configured
        - status
        - missingRequiredEnv
        - configuredOptionalEnv
ToolAdapterListResponse:
  type: object
  properties:
    adapters:
      type: array
      items:
        $ref: "#/components/schemas/ToolAdapterDefinition"
    readiness:
      type: array
      items:
        $ref: "#/components/schemas/ToolAdapterReadiness"
  required:
    - adapters
    - readiness
```

- [ ] **Step 5: Regenerate clients and validators**

Run:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
```

Expected: Orval regenerates files. If the script fails only because it invokes bare `pnpm`, keep generated files and run `corepack pnpm run typecheck:libs` later.

- [ ] **Step 6: Verify route build**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run build
```

Expected: PASS. Failure `GetToolAdaptersResponse` missing means codegen was not run or generated outputs were not updated.

## Task 4: Update Project Status And Validate

**Files:**

- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Update `.hermes/project-status.md`**

Set active work to:

```md
- Branch: `codex/adapter-metadata-config-contract`
- Scope: Add redacted tool adapter metadata and readiness contract for the four business skills.
- Sibling repos: off-limits. Adapter source repo URLs are metadata only; no external code is read or copied.
```

Append current state bullets:

```md
- PR #8 was merged into `main`; this branch starts the next autonomous runtime slice from latest `main`.
- Added a tool adapter registry for `web_listening`, `doc_to_md`, `md_to_rag`, and `rag_to_agent` with adapter kind, env requirements, timeout/output limits, allowed commands, resume support, and source repo metadata.
- Added redacted adapter readiness so the UI can show whether each external tool is configured without exposing environment variable values.
- Agent-created module runs now include adapter metadata needed by later executor/resume PRs.
- Added `GET /api/tool-adapters` and regenerated API Zod/React clients.
```

Append verification bullets after running commands:

```md
- Adapter metadata validation: `corepack pnpm --filter @workspace/api-server run test` passed.
- Adapter metadata validation: `corepack pnpm --filter @workspace/api-server run build` passed.
- Adapter metadata validation: `corepack pnpm run typecheck:libs` passed.
- Adapter metadata validation: `corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` passed.
- Adapter metadata validation: `git diff --check` passed with CRLF warnings only.
```

- [ ] **Step 2: Run all required checks**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run build
corepack pnpm run typecheck:libs
corepack pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck
git diff --check
```

Expected: all pass. `git diff --check` may print CRLF warnings and still exit 0.

- [ ] **Step 3: Controller self-review**

Check:

```powershell
git diff --stat
rg -n "secret-token|API_TOKEN.*secret|process.env\\[[^\\]]+\\].*res\\.json" artifacts/api-server/src lib/api-spec
```

Expected:

- Diff includes only planned files and generated clients.
- No actual secret values are returned from routes or readiness payloads.

## Handoff To Reviewers

Spec reviewer should verify:

- Exactly four adapters exist, one per business module.
- Readiness exposes env var names and booleans only, never env values.
- Runtime module run metadata includes adapter id/kind/readiness contract fields.
- No executor, process spawn, HTTP adapter call, or sibling repo read was added.
- OpenAPI and generated clients include `GET /api/tool-adapters`.

Code quality reviewer should verify:

- Registry definitions are plain data with narrow helper functions.
- No duplicated adapter metadata creates drift between skill registry and adapter registry.
- Error behavior is deterministic for unknown module ids.
- Generated files are consistent with OpenAPI.
- Tests cover missing-env and ready-env paths.
