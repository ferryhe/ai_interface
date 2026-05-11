# Portal Runtime Read Access Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a verified Portal token for Portal-origin runtime read endpoints while keeping admin and non-Portal reads unchanged.

**Architecture:** Reuse the existing `isPortalRuntimeRequest` and `requirePortalRuntimeAccess` helpers introduced for Portal runtime writes. Add guards only when a request declares `X-AI-Interface-Surface: agent-portal`; normal backend/admin reads still work without a Portal token. Document the headers and `403` responses in OpenAPI, then regenerate public API outputs.

**Tech Stack:** Express routes, Node test runner, in-memory repositories, Zod-generated API contracts, OpenAPI/Orval codegen, pnpm workspaces.

---

## File Structure

- Modify `artifacts/api-server/src/routes/agent-runs.ts`: guard `GET /agent-runs/:pipelineRunId` for Portal-origin reads before loading run detail.
- Modify `artifacts/api-server/src/routes/agent-runs.test.ts`: add tests for Portal read denial, Portal read success with token, and non-Portal read success without token.
- Modify `artifacts/api-server/src/routes/modules.ts`: guard `GET /module-runs/:runId` and `GET /artifacts/:artifactId` for Portal-origin reads before returning detail.
- Modify `artifacts/api-server/src/routes/modules.test.ts`: add tests for module-run and artifact Portal read denial/success and non-Portal read success.
- Modify `lib/api-spec/openapi.yaml`: document Portal runtime headers and `403` responses on the three guarded read endpoints.
- Regenerate generated API contract files under `lib/api-zod/generated` and `artifacts/mockup-sandbox/src/lib/api-client/generated` by running the existing codegen script.
- Modify `.hermes/project-status.md`: record branch goal, validation commands, and PR status.

## Task 1: Guard Portal Runtime Reads

**Files:**
- Modify: `artifacts/api-server/src/routes/agent-runs.ts`
- Modify: `artifacts/api-server/src/routes/agent-runs.test.ts`
- Modify: `artifacts/api-server/src/routes/modules.ts`
- Modify: `artifacts/api-server/src/routes/modules.test.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Generated: `lib/api-zod/generated/*`
- Generated: `artifacts/mockup-sandbox/src/lib/api-client/generated/*`
- Modify: `.hermes/project-status.md`

- [ ] **Step 1: Write failing Agent run read tests**

Add a helper that can request both `POST /agent-runs` and `GET /agent-runs/:pipelineRunId`, or extend `requestAgentRun` with a small local Express app callback. Add these tests in `artifacts/api-server/src/routes/agent-runs.test.ts`:

```ts
test("agent run route rejects Portal-origin reads without a verified token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const created = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Create an admin-owned run.",
      metadata: { source: "mockup-sandbox" },
    },
  });
  const pipelineRunId = (created.json["pipelineRun"] as { id: string }).id;

  const response = await requestAgentRunDetail({
    runtimeRepository,
    configRepository,
    pipelineRunId,
    headers: { "X-AI-Interface-Surface": "agent-portal" },
  });

  assert.equal(response.status, 403);
  assert.equal(response.text.includes("Portal access denied"), true);
});

test("agent run route accepts Portal-origin reads with a published matching token", async () => {
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
  const created = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Create an admin-owned run.",
      metadata: { source: "mockup-sandbox" },
    },
  });
  const pipelineRunId = (created.json["pipelineRun"] as { id: string }).id;

  const response = await requestAgentRunDetail({
    runtimeRepository,
    configRepository,
    pipelineRunId,
    headers: {
      "X-AI-Interface-Surface": "agent-portal",
      "X-Portal-Token": "portal-secret-token",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.json["pipelineRun"] && typeof response.json["pipelineRun"], "object");
  assert.equal(response.text.includes("portal-secret-token"), false);
});

test("agent run route keeps non-Portal reads available without a portal token", async () => {
  const runtimeRepository = new InMemoryAgentRuntimeRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const created = await requestAgentRun({
    runtimeRepository,
    configRepository,
    body: {
      message: "Create an admin-owned run.",
      metadata: { source: "mockup-sandbox" },
    },
  });
  const pipelineRunId = (created.json["pipelineRun"] as { id: string }).id;

  const response = await requestAgentRunDetail({
    runtimeRepository,
    configRepository,
    pipelineRunId,
  });

  assert.equal(response.status, 200);
});
```

- [ ] **Step 2: Write failing module read tests**

Add tests in `artifacts/api-server/src/routes/modules.test.ts` for `GET /module-runs/:runId` and `GET /artifacts/:artifactId`. Use `createModuleRun` and `recordModuleRunArtifact` to seed data:

```ts
test("modules route rejects Portal module-run reads without a verified token", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `portal-read-test-${randomUUID()}`,
    title: "Convert document",
  });

  const response = await withModulesApp(repository, configRepository, (baseUrl) =>
    fetch(`${baseUrl}/module-runs/${run.id}`, {
      headers: { "X-AI-Interface-Surface": "agent-portal" },
    }),
  );

  assert.equal(response.status, 403);
});

test("modules route accepts Portal module-run reads with a published matching token", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(configRepository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `portal-read-test-${randomUUID()}`,
    title: "Convert document",
  });

  const response = await withModulesApp(repository, configRepository, (baseUrl) =>
    fetch(`${baseUrl}/module-runs/${run.id}`, {
      headers: {
        "X-AI-Interface-Surface": "agent-portal",
        Authorization: "Bearer portal-secret-token",
      },
    }),
  );

  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(text.includes("portal-secret-token"), false);
});

test("modules route keeps non-Portal module-run reads available without a portal token", async () => {
  const repository = new InMemoryModuleRunRepository();
  const configRepository = new InMemoryAgentConfigRepository();
  const { run } = await createModuleRun(repository, {
    moduleId: "doc_to_md",
    externalRunId: `portal-read-test-${randomUUID()}`,
    title: "Convert document",
  });

  const response = await withModulesApp(repository, configRepository, (baseUrl) =>
    fetch(`${baseUrl}/module-runs/${run.id}`),
  );

  assert.equal(response.status, 200);
});
```

Mirror the same denial/success/non-Portal pattern for `GET /artifacts/:artifactId` after creating an artifact with:

```ts
const artifact = await recordModuleRunArtifact(repository, run.id, {
  artifactKind: "markdown",
  title: "Converted markdown",
  contentText: "# Converted",
});
```

- [ ] **Step 3: Run tests to confirm red**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected before implementation: the new Portal-origin read tests fail because the unguarded GET endpoints return `200`.

- [ ] **Step 4: Implement the minimal route guards**

In `artifacts/api-server/src/routes/agent-runs.ts`, add this before `getAgentRunDetail`:

```ts
if (isPortalRuntimeRequest(req)) {
  const access = await requirePortalRuntimeAccess(req, configRepository);
  if (!access.allowed) {
    res.status(403).json(errorResponse(access.error));
    return;
  }
}
```

In `artifacts/api-server/src/routes/modules.ts`, add the same check before `getModuleRunDetail` in `GET /module-runs/:runId`, and before `repository.findArtifactById` in `GET /artifacts/:artifactId`.

- [ ] **Step 5: Document the guarded read endpoints**

Update `lib/api-spec/openapi.yaml`:

```yaml
/module-runs/{runId}:
  get:
    description: >-
      Returns module run detail. Portal-origin reads send
      `X-AI-Interface-Surface: agent-portal` and require a verified Portal
      token through `X-Portal-Token` or `Authorization: Bearer <token>`.
    parameters:
      - $ref: "#/components/parameters/RunId"
      - $ref: "#/components/parameters/PortalSurface"
      - $ref: "#/components/parameters/PortalToken"
    responses:
      "403":
        description: Portal access denied
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ErrorResponse"
```

Apply the same parameter and `403` response pattern to `GET /artifacts/{artifactId}` and `GET /agent-runs/{pipelineRunId}` with endpoint-specific descriptions.

- [ ] **Step 6: Regenerate API outputs**

Run:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
```

Expected: generated API Zod/client files update if operation parameter types change.

- [ ] **Step 7: Run verification**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
git diff --check
```

Expected: all commands exit `0`; `git diff --check` may print existing CRLF warnings but must not report whitespace errors.

- [ ] **Step 8: Update project status**

Append a short status entry to `.hermes/project-status.md` stating:

```md
- PR #24 was merged into `main`; this branch starts the Portal runtime read access guard slice from latest `main`.
- Portal-origin reads for Agent run detail, module run detail, and artifact detail now require the published Portal token, while non-Portal/admin reads remain available.
- OpenAPI documents Portal runtime headers and `403` responses for the guarded read endpoints; API outputs were regenerated.
```

Also record every verification command and result under `## Notes`.

## Self-Review

- Spec coverage: The plan protects the three runtime read endpoints used by Portal detail views and keeps non-Portal/admin access unchanged.
- Placeholder scan: No TBD/TODO/fill-in-later placeholders remain.
- Type consistency: The plan reuses existing `AgentConfigRepository`, `ModuleRunRepository`, `isPortalRuntimeRequest`, and `requirePortalRuntimeAccess` names already present in the codebase.
