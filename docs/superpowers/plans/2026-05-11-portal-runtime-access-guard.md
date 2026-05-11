# Portal Runtime Access Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require verified Publish Portal tokens for frontstage Portal runtime write actions after a user unlocks the Portal.

**Architecture:** Keep `/api/portal-auth/verify` as the token check source of truth, and add a small Express route guard for runtime writes that identify themselves as `agent-portal`. Admin/mockup runtime calls remain unchanged. The Portal UI sends the verified token in headers for Agent run creation, feedback, resume, and detail reads so the current API and future read guards share one client contract.

**Tech Stack:** Express 5, TypeScript, `@workspace/api-zod`, existing in-memory route tests, OpenAPI YAML, Vite React mockup sandbox.

---

## File Structure

- Create `artifacts/api-server/src/routes/portal-access-guard.ts`: reusable header extraction and portal runtime access guard.
- Modify `artifacts/api-server/src/routes/agent-runs.ts`: export a route factory and require the guard for Portal-origin `POST /agent-runs`.
- Create `artifacts/api-server/src/routes/agent-runs.test.ts`: route tests proving Portal writes need a valid token and admin/runtime calls remain available.
- Modify `artifacts/api-server/src/routes/modules.ts`: export a route factory and require the guard for Portal-origin feedback/resume write actions.
- Create `artifacts/api-server/src/routes/modules.test.ts`: route tests proving Portal feedback/resume writes need a valid token and successful tokened writes still work.
- Modify `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`: retain the verified token separately and send `X-AI-Interface-Surface` plus `X-Portal-Token` on Portal runtime API calls.
- Modify `lib/api-spec/openapi.yaml`: document the optional Portal runtime headers and `403` responses on guarded writes.
- Modify generated API files only if `corepack pnpm --filter @workspace/api-spec run codegen` changes them.
- Modify `.hermes/project-status.md`: record the new slice, checks, and next action.

## Task 1: Backend Portal Runtime Guard

**Files:**
- Create: `artifacts/api-server/src/routes/portal-access-guard.ts`
- Modify: `artifacts/api-server/src/routes/agent-runs.ts`
- Create: `artifacts/api-server/src/routes/agent-runs.test.ts`

- [ ] **Step 1: Write route tests first**

Create `artifacts/api-server/src/routes/agent-runs.test.ts` with tests that:

```ts
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import { InMemoryAgentRuntimeRepository } from "../agent-runtime/agent-runtime-service";
import { createAgentRunsRouter } from "./agent-runs";

async function requestAgentRun(input: {
  runtimeRepository: InMemoryAgentRuntimeRepository;
  configRepository: InMemoryAgentConfigRepository;
  body: unknown;
  headers?: Record<string, string>;
}): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const app = express();
  app.use(express.json());
  app.use(createAgentRunsRouter(input.runtimeRepository, input.configRepository));

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/agent-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.headers ?? {}),
      },
      body: JSON.stringify(input.body),
    });
    const text = await response.text();
    return { status: response.status, text, json: JSON.parse(text) };
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("agent run route rejects Portal-origin writes without a verified token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const response = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Run this from the frontstage Portal.",
      executionMode: "execute_ready",
      metadata: { source: "agent-portal" },
    },
  });

  assert.equal(response.status, 403);
  assert.equal(response.text.includes("Portal access denied"), true);
  assert.equal(runtimeRepository.threads.length, 0);
  assert.equal(runtimeRepository.pipelineRuns.length, 0);
  assert.equal(runtimeRepository.moduleRuns.length, 0);
});

test("agent run route accepts Portal-origin writes with a published matching token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const response = await requestAgentRun({
    runtimeRepository,
    configRepository,
    headers: {
      "X-AI-Interface-Surface": "agent-portal",
      "X-Portal-Token": "portal-secret-token",
    },
    body: {
      message: "Run this from the frontstage Portal.",
      executionMode: "execute_ready",
      metadata: { source: "agent-portal" },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.json["status"], "missing_key");
  assert.equal(runtimeRepository.threads.length, 1);
  assert.equal(runtimeRepository.pipelineRuns.length, 1);
  assert.equal(runtimeRepository.moduleRuns.length, 4);
  assert.equal(response.text.includes("portal-secret-token"), false);
});

test("agent run route keeps non-Portal runtime writes available without a portal token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();

  const response = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Run this from the admin console.",
      metadata: { source: "mockup-sandbox" },
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.json["status"], "missing_key");
  assert.equal(runtimeRepository.threads.length, 1);
});
```

- [ ] **Step 2: Run the focused route test and confirm it fails**

Run: `corepack pnpm --filter @workspace/api-server exec tsx --test src/routes/agent-runs.test.ts`

Expected before implementation: TypeScript/runtime failure because `createAgentRunsRouter` does not exist.

- [ ] **Step 3: Add the reusable guard**

Create `artifacts/api-server/src/routes/portal-access-guard.ts` with:

```ts
import type { Request } from "express";

import {
  verifyPortalAccess,
  type AgentConfigRepository,
} from "../agent-config/agent-config-service";
import type { JsonObject } from "../modules/ingest-service";

const portalSurface = "agent-portal";

function firstHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readPortalToken(req: Request): string {
  const tokenHeader = firstHeaderValue(req.headers["x-portal-token"]).trim();
  if (tokenHeader) return tokenHeader;

  const authorization = firstHeaderValue(req.headers.authorization).trim();
  const bearerPrefix = "Bearer ";
  if (authorization.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length).trim();
  }

  return "";
}

export function isPortalRuntimeRequest(
  req: Request,
  metadata?: JsonObject,
): boolean {
  const surface = firstHeaderValue(req.headers["x-ai-interface-surface"]).trim();
  return surface === portalSurface || metadata?.["source"] === portalSurface;
}

export async function requirePortalRuntimeAccess(
  req: Request,
  repository: AgentConfigRepository,
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const verification = await verifyPortalAccess(repository, readPortalToken(req));
  if (verification.authorized) return { allowed: true };
  return {
    allowed: false,
    error: `Portal access denied: ${verification.status}`,
  };
}
```

- [ ] **Step 4: Export an Agent runs router factory and apply the guard**

Modify `artifacts/api-server/src/routes/agent-runs.ts` so it exports:

```ts
export function createAgentRunsRouter(
  runtimeRepository: AgentRuntimeRepository,
  configRepository: AgentConfigRepository,
): IRouter {
  const router: IRouter = Router();
  ...
  return router;
}

const router = createAgentRunsRouter(
  new DbAgentRuntimeRepository(),
  new DbAgentConfigRepository(),
);
```

Inside `POST /agent-runs`, after body validation and before `createAgentRun`, add:

```ts
if (isPortalRuntimeRequest(req, body.data.metadata)) {
  const access = await requirePortalRuntimeAccess(req, configRepository);
  if (!access.allowed) {
    res.status(403).json(errorResponse(access.error));
    return;
  }
}
```

- [ ] **Step 5: Run the focused route test and confirm it passes**

Run: `corepack pnpm --filter @workspace/api-server exec tsx --test src/routes/agent-runs.test.ts`

Expected: all tests in `agent-runs.test.ts` pass.

## Task 2: Guard Portal Feedback and Resume Writes

**Files:**
- Modify: `artifacts/api-server/src/routes/modules.ts`
- Create: `artifacts/api-server/src/routes/modules.test.ts`

- [ ] **Step 1: Write route tests first**

Create `artifacts/api-server/src/routes/modules.test.ts` with tests that:

```ts
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";

import {
  InMemoryAgentConfigRepository,
  updateAgentConfig,
} from "../agent-config/agent-config-service";
import {
  createModuleRun,
  InMemoryModuleRunRepository,
  requestModuleRunInteraction,
  submitModuleRunFeedback,
} from "../modules/ingest-service";
import { createModulesRouter } from "./modules";

async function withModulesApp<T>(
  repository: InMemoryModuleRunRepository,
  configRepository: InMemoryAgentConfigRepository,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(createModulesRouter(repository, configRepository));

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      (server as Server).close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function createInteractiveRun(repository: InMemoryModuleRunRepository): Promise<string> {
  const { run } = await createModuleRun(repository, {
    moduleId: "rag_to_agent",
    externalRunId: "portal-runtime-guard-test",
    title: "Generate agent",
  });
  await requestModuleRunInteraction(repository, run.id, {
    kind: "approval",
    title: "Approve generated agent",
    message: "Approve this generated agent?",
    resumeHandle: "resume-generated-agent",
    metadata: { source: "agent-portal" },
  });
  return run.id;
}

test("modules route rejects Portal feedback without a token before mutating the run", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const runId = await createInteractiveRun(repository);

  const response = await withModulesApp(repository, configRepository, (baseUrl) =>
    fetch(`${baseUrl}/module-runs/${runId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-Interface-Surface": "agent-portal",
      },
      body: JSON.stringify({
        approved: true,
        metadata: { source: "agent-portal" },
      }),
    }),
  );

  assert.equal(response.status, 403);
  const run = await repository.findModuleRunById(runId);
  assert.equal(run?.metadata?.["interaction"] && typeof run.metadata["interaction"], "object");
  assert.equal(
    (run?.metadata?.["interaction"] as { status?: string }).status,
    "waiting_for_approval",
  );
});

test("modules route accepts Portal feedback with a published matching token", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const runId = await createInteractiveRun(repository);
  await updateAgentConfig(configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const response = await withModulesApp(repository, configRepository, (baseUrl) =>
    fetch(`${baseUrl}/module-runs/${runId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-Interface-Surface": "agent-portal",
        "X-Portal-Token": "portal-secret-token",
      },
      body: JSON.stringify({
        approved: true,
        resumeHandle: "resume-generated-agent",
        metadata: { source: "agent-portal" },
      }),
    }),
  );

  const text = await response.text();
  const json = JSON.parse(text) as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal((json["interaction"] as { status?: string }).status, "resumable");
  assert.equal(text.includes("portal-secret-token"), false);
});

test("modules route rejects Portal resume without a token before consuming feedback", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const runId = await createInteractiveRun(repository);
  await submitModuleRunFeedback(repository, runId, {
    approved: true,
    resumeHandle: "resume-generated-agent",
    metadata: { source: "agent-portal" },
  });

  const response = await withModulesApp(repository, configRepository, (baseUrl) =>
    fetch(`${baseUrl}/module-runs/${runId}/resume`, {
      method: "POST",
      headers: { "X-AI-Interface-Surface": "agent-portal" },
    }),
  );

  assert.equal(response.status, 403);
  const run = await repository.findModuleRunById(runId);
  assert.equal(
    (run?.metadata?.["interaction"] as { status?: string }).status,
    "resumable",
  );
});
```

- [ ] **Step 2: Run the focused modules route test and confirm it fails**

Run: `corepack pnpm --filter @workspace/api-server exec tsx --test src/routes/modules.test.ts`

Expected before implementation: TypeScript/runtime failure because `createModulesRouter` does not exist.

- [ ] **Step 3: Export a modules router factory and apply the guard**

Modify `artifacts/api-server/src/routes/modules.ts` so it exports:

```ts
export function createModulesRouter(
  repository: ModuleRunRepository,
  agentConfigRepository: AgentConfigRepository,
): IRouter {
  const router: IRouter = Router();
  ...
  return router;
}

const router = createModulesRouter(
  new DbModuleRunRepository(),
  new DbAgentConfigRepository(),
);
```

Before `submitModuleRunFeedback`, guard only Portal-origin requests:

```ts
if (isPortalRuntimeRequest(req, body.data.metadata)) {
  const access = await requirePortalRuntimeAccess(req, agentConfigRepository);
  if (!access.allowed) {
    res.status(403).json(errorResponse(access.error));
    return;
  }
}
```

Before `resumeModuleRunExecution`, guard only requests with `X-AI-Interface-Surface: agent-portal`:

```ts
if (isPortalRuntimeRequest(req)) {
  const access = await requirePortalRuntimeAccess(req, agentConfigRepository);
  if (!access.allowed) {
    res.status(403).json(errorResponse(access.error));
    return;
  }
}
```

- [ ] **Step 4: Run focused route tests and confirm they pass**

Run:

```powershell
corepack pnpm --filter @workspace/api-server exec tsx --test src/routes/agent-runs.test.ts
corepack pnpm --filter @workspace/api-server exec tsx --test src/routes/modules.test.ts
```

Expected: both focused route suites pass.

## Task 3: Portal Client Headers and API Contract

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate only if codegen changes are produced.

- [ ] **Step 1: Store the verified token separately**

In `AgentPortalInterface.tsx`, add state near the existing token state:

```ts
const [authorizedPortalToken, setAuthorizedPortalToken] = useState("");
```

When access is locked or token verification fails, call `setAuthorizedPortalToken("")`. When the API authorizes a token, call `setAuthorizedPortalToken(cleanToken)`. When local offline demo unlocks, call `setAuthorizedPortalToken(cleanToken)` from `fallBackToLocalDemoIfApiUnavailable`.

- [ ] **Step 2: Add a Portal runtime headers helper**

Add:

```ts
function portalRuntimeHeaders(
  tokenValue: string,
  input: Record<string, string> = {},
): Record<string, string> {
  const headers = {
    ...input,
    "X-AI-Interface-Surface": "agent-portal",
  };
  const cleanToken = tokenValue.trim();
  if (cleanToken) headers["X-Portal-Token"] = cleanToken;
  return headers;
}
```

- [ ] **Step 3: Use the helper for Portal API calls**

Use `portalRuntimeHeaders(authorizedPortalToken, { "Content-Type": "application/json" })` for:

- `POST /api/agent-runs`
- `POST /api/module-runs/{runId}/feedback`

Use `portalRuntimeHeaders(authorizedPortalToken)` for:

- `POST /api/module-runs/{runId}/resume`
- `GET /api/module-runs/{runId}`
- `GET /api/artifacts/{artifactId}`

Do not send these headers to `/api/portal-auth/verify`.

- [ ] **Step 4: Document the guarded writes in OpenAPI**

In `lib/api-spec/openapi.yaml`, update descriptions for:

- `POST /agent-runs`
- `POST /module-runs/{runId}/feedback`
- `POST /module-runs/{runId}/resume`

Mention that Portal-origin requests send `X-AI-Interface-Surface: agent-portal` and require `X-Portal-Token` or `Authorization: Bearer <token>`. Add `403` responses using `ErrorResponse` for these three operations.

- [ ] **Step 5: Run type/codegen checks**

Run:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

Expected: all pass. If codegen changes generated files, keep them. If no generated files changed, do not force changes.

## Task 4: Full Verification, Status, and PR

**Files:**
- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Run backend validation**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run build
```

Expected: all tests and build pass.

- [ ] **Step 2: Run frontend build and whitespace validation**

Run:

```powershell
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Expected: build exits 0; `git diff --check` has no errors. CRLF warnings from existing files are acceptable only if exit code is 0.

- [ ] **Step 3: Browser smoke**

Open `http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface?token=portal-demo-token`, confirm:

- the Portal still unlocks in local demo/offline mode when `/api` is unavailable;
- Chat, Steps, Data, Sources, and Result views render;
- no browser console warnings/errors appear.

- [ ] **Step 4: Update project status**

Update `.hermes/project-status.md` with:

- branch `codex/portal-runtime-access-guard`;
- scope: Portal runtime writes now require verified Publish Portal token when the request is Portal-origin;
- validation commands and results;
- next action: follow up on the new PR after GitHub processes checks/comments.

- [ ] **Step 5: Commit, push, create PR**

Run:

```powershell
git status --short
git add artifacts/api-server/src/routes/portal-access-guard.ts artifacts/api-server/src/routes/agent-runs.ts artifacts/api-server/src/routes/agent-runs.test.ts artifacts/api-server/src/routes/modules.ts artifacts/api-server/src/routes/modules.test.ts artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx lib/api-spec/openapi.yaml lib/api-zod/src/generated lib/api-client-react/src/generated docs/superpowers/plans/2026-05-11-portal-runtime-access-guard.md .hermes/project-status.md
git commit -m "Guard Portal runtime writes with access token"
git push -u origin codex/portal-runtime-access-guard
gh pr create --base main --head codex/portal-runtime-access-guard --title "Guard Portal runtime writes with access token" --body "..."
```

Expected: PR is created for this branch.

## Self-Review

- Spec coverage: tokened Portal runtime writes are covered on Agent run creation, feedback, and resume; admin/mockup calls remain unchanged; Portal UI sends headers; OpenAPI documents guarded writes.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: `metadata.source = "agent-portal"`, `X-AI-Interface-Surface`, and `X-Portal-Token` are the same names in backend tests, guard, and frontend calls.
