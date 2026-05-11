# Publish Settings API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and expose basic Publish/Portal access settings so the admin Publish page can save publish state and portal-token metadata without storing plaintext tokens.

**Architecture:** Extend the existing DB-backed Agent config model with a `publishSettings` JSON object, reuse `/api/agent-config` GET/PUT, and wire the mockup Publish page to load/save those settings with an offline fallback. This PR does not add a full user/session auth system or validate Portal requests server-side.

**Tech Stack:** TypeScript, Express, Drizzle schema, OpenAPI/Orval generated clients, React mockup sandbox.

---

## Design Summary

PR #21 made Publish explain what users see after publish. This PR makes that panel start behaving like a control plane surface:

- Store publish status and portal-token metadata in the existing default Agent config.
- Never store or return the plaintext portal token.
- When a new token is submitted, store only a deterministic SHA-256 hash plus the last four visible characters.
- Keep Portal runtime behavior unchanged. The Portal still uses demo query-token preview until a later server-side auth PR.
- Keep scope limited to `ai_interface`; sibling repos are off-limits.

## File Structure

- Modify `lib/db/src/schema/module-os.ts`
  - Add `publishSettings` JSONB to `agentConfigsTable` and typed insert schema.
- Modify `artifacts/api-server/src/agent-config/agent-config-service.ts`
  - Add publish settings types, default settings, token hashing helper, and update support.
- Modify `artifacts/api-server/src/agent-config/db-repository.ts`
  - Map and upsert `publishSettings`.
- Modify `artifacts/api-server/src/agent-config/agent-config-service.test.ts`
  - Add TDD coverage for defaults, publishing updates, and no plaintext token leakage.
- Modify `lib/api-spec/openapi.yaml`
  - Add `AgentPublishSettings` and include it on `AgentConfig` / `UpdateAgentConfigRequest`.
- Modify `lib/api-spec/package.json`
  - Keep `codegen` portable in this workspace by invoking the trailing typecheck through `corepack pnpm`.
- Regenerate `lib/api-zod/src/generated/**` and `lib/api-client-react/src/generated/**`.
- Modify `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
  - Load/save publish settings through `/api/agent-config`, with visual offline fallback.
- Modify `.hermes/project-status.md`
  - Record branch, scope, validation, PR state.
- Create this plan file.

## Publish Settings Contract

Add this backend-internal type:

```ts
export type AgentPublishStatus = "draft" | "published" | "paused";
export type PortalAccessMode = "token";

export interface AgentPublishSettings {
  status: AgentPublishStatus;
  portalAccessMode: PortalAccessMode;
  portalTokenHash: string | null;
  portalTokenLast4: string | null;
  portalTokenUpdatedAt: string | null;
  publishedAt: string | null;
  versionLabel: string;
}
```

Rules:

- Default status is `draft`.
- Default `portalAccessMode` is `token`.
- Default `versionLabel` is `draft-0.3`.
- `portalTokenHash` and `portalTokenLast4` are `null` until a token is submitted.
- `setPortalToken` is an input-only field accepted by `PUT /api/agent-config`; it must never appear in responses.
- `portalTokenHash` must stay internal and must never appear in public `GET /api/agent-config` or `PUT /api/agent-config` responses.
- Empty or whitespace-only `setPortalToken` means "keep the existing token settings".

## Task 1: Backend Agent Config Contract

**Files:**
- Modify: `lib/db/src/schema/module-os.ts`
- Modify: `artifacts/api-server/src/agent-config/agent-config-service.ts`
- Modify: `artifacts/api-server/src/agent-config/db-repository.ts`
- Test: `artifacts/api-server/src/agent-config/agent-config-service.test.ts`

- [x] **Step 1: Write failing service tests**

Add tests to `agent-config-service.test.ts`:

```ts
test("creates default publish settings without a portal token", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const config = await getAgentConfig(repository);

  assert.equal(config.publishSettings.status, "draft");
  assert.equal(config.publishSettings.portalAccessMode, "token");
  assert.equal(config.publishSettings.portalTokenHash, null);
  assert.equal(config.publishSettings.portalTokenLast4, null);
  assert.equal(config.publishSettings.versionLabel, "draft-0.3");
});

test("updates publish settings and hashes portal token without returning plaintext", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const updated = await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  assert.equal(updated.publishSettings.status, "published");
  assert.equal(updated.publishSettings.portalAccessMode, "token");
  assert.equal(updated.publishSettings.portalTokenLast4, "oken");
  assert.equal(updated.publishSettings.portalTokenHash?.length, 64);
  assert.notEqual(updated.publishSettings.portalTokenHash, "portal-secret-token");
  assert.equal(JSON.stringify(updated).includes("portal-secret-token"), false);
  assert.ok(updated.publishSettings.portalTokenUpdatedAt);
  assert.ok(updated.publishSettings.publishedAt);
});

test("keeps existing portal token when publish settings update omits token", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const withToken = await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });
  const updated = await updateAgentConfig(repository, {
    publishSettings: {
      status: "paused",
      portalAccessMode: "token",
      versionLabel: "agent-v1-paused",
    },
  });

  assert.equal(updated.publishSettings.status, "paused");
  assert.equal(updated.publishSettings.portalTokenHash, withToken.publishSettings.portalTokenHash);
  assert.equal(updated.publishSettings.portalTokenLast4, "oken");
});
```

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: tests fail because `publishSettings` does not exist yet.

- [x] **Step 2: Add DB schema field**

In `agentConfigsTable`, add:

```ts
publishSettings: jsonb("publish_settings")
  .$type<{
    status: string;
    portalAccessMode: string;
    portalTokenHash: string | null;
    portalTokenLast4: string | null;
    portalTokenUpdatedAt: string | null;
    publishedAt: string | null;
    versionLabel: string;
  }>()
  .default({
    status: "draft",
    portalAccessMode: "token",
    portalTokenHash: null,
    portalTokenLast4: null,
    portalTokenUpdatedAt: null,
    publishedAt: null,
    versionLabel: "draft-0.3",
  })
  .notNull(),
```

Expected: TypeScript has a typed column for persisted publish settings.

- [x] **Step 3: Implement service types and defaults**

In `agent-config-service.ts`:

```ts
import { createHash, randomUUID } from "node:crypto";
```

Replace the current crypto import with the combined import.

Add the contract types from "Publish Settings Contract". Add:

```ts
export interface UpdateAgentPublishSettingsInput {
  status?: AgentPublishStatus;
  portalAccessMode?: PortalAccessMode;
  setPortalToken?: string;
  versionLabel?: string;
}
```

Add `publishSettings: AgentPublishSettings` to `AgentConfigRecord`, `UpdateAgentConfigInput`, and `UpsertAgentConfigInput`.

Add:

```ts
export function createDefaultPublishSettings(): AgentPublishSettings {
  return {
    status: "draft",
    portalAccessMode: "token",
    portalTokenHash: null,
    portalTokenLast4: null,
    portalTokenUpdatedAt: null,
    publishedAt: null,
    versionLabel: "draft-0.3",
  };
}

function hashPortalToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function mergePublishSettings(
  current: AgentPublishSettings,
  input?: UpdateAgentPublishSettingsInput,
): AgentPublishSettings {
  if (!input) return current;
  const token = input.setPortalToken?.trim();
  const now = new Date().toISOString();
  return {
    ...current,
    status: input.status ?? current.status,
    portalAccessMode: input.portalAccessMode ?? current.portalAccessMode,
    versionLabel: input.versionLabel ?? current.versionLabel,
    portalTokenHash: token ? hashPortalToken(token) : current.portalTokenHash,
    portalTokenLast4: token ? token.slice(-4) : current.portalTokenLast4,
    portalTokenUpdatedAt: token ? now : current.portalTokenUpdatedAt,
    publishedAt:
      input.status === "published" && current.status !== "published"
        ? now
        : current.publishedAt,
  };
}
```

Use `createDefaultPublishSettings()` in `createDefaultAgentConfig()`. Use `mergePublishSettings(current.publishSettings, input.publishSettings)` inside `updateAgentConfig`.

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: service tests pass.

- [x] **Step 4: Map DB repository**

In `db-repository.ts`, import `AgentPublishSettings`, map `row.publishSettings`, include `publishSettings` in `upsertConfig` input, insert values, and conflict update set.

Run:

```powershell
corepack pnpm --filter @workspace/api-server run build
```

Expected: build passes.

## Task 2: OpenAPI And Generated Clients

**Files:**
- Modify: `lib/api-spec/openapi.yaml`
- Generate: `lib/api-zod/src/generated/**`
- Generate: `lib/api-client-react/src/generated/**`

- [x] **Step 1: Add OpenAPI schemas**

Add schemas:

```yaml
    AgentPublishStatus:
      type: string
      enum: [draft, published, paused]
    PortalAccessMode:
      type: string
      enum: [token]
    AgentPublishSettings:
      type: object
      properties:
        status:
          $ref: "#/components/schemas/AgentPublishStatus"
        portalAccessMode:
          $ref: "#/components/schemas/PortalAccessMode"
        portalTokenLast4:
          type:
            - string
            - "null"
        portalTokenUpdatedAt:
          type:
            - string
            - "null"
          format: date-time
        publishedAt:
          type:
            - string
            - "null"
          format: date-time
        versionLabel:
          type: string
      required:
        - status
        - portalAccessMode
        - portalTokenLast4
        - portalTokenUpdatedAt
        - publishedAt
        - versionLabel
    UpdateAgentPublishSettings:
      type: object
      properties:
        status:
          $ref: "#/components/schemas/AgentPublishStatus"
        portalAccessMode:
          $ref: "#/components/schemas/PortalAccessMode"
        setPortalToken:
          type: string
        versionLabel:
          type: string
```

Add `publishSettings` to `AgentConfig.properties`, `AgentConfig.required`, and `UpdateAgentConfigRequest.properties`.

- [x] **Step 2: Regenerate clients**

Run:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
```

Expected: Orval regenerates files and the trailing `corepack pnpm -w run typecheck:libs` passes.

## Task 3: Publish Page API Wire-Up

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`

- [x] **Step 1: Add frontend local types**

Near existing config API types, add:

```ts
type PublishStatus = "draft" | "published" | "paused";

interface PublishSettingsApi {
  status: PublishStatus;
  portalAccessMode: "token";
  portalTokenLast4: string | null;
  portalTokenUpdatedAt: string | null;
  publishedAt: string | null;
  versionLabel: string;
}
```

- [x] **Step 2: Add guarded API parser**

Add a helper:

```ts
function isPublishSettingsApi(value: unknown): value is PublishSettingsApi {
  if (!isRecord(value)) return false;
  return (
    (value["status"] === "draft" ||
      value["status"] === "published" ||
      value["status"] === "paused") &&
    value["portalAccessMode"] === "token" &&
    typeof value["versionLabel"] === "string"
  );
}
```

When reading `/api/agent-config`, use this guard on `data.config.publishSettings`.

- [x] **Step 3: Make `PublishView` stateful through props**

Move publish state to `AgentFirstInterface()`:

```ts
const [publishSettings, setPublishSettings] = useState<PublishSettingsApi>({
  status: "draft",
  portalAccessMode: "token",
  portalTokenHash: null,
  portalTokenLast4: null,
  portalTokenUpdatedAt: null,
  publishedAt: null,
  versionLabel: "draft-0.3",
});
const [publishTokenDraft, setPublishTokenDraft] = useState("");
const [publishSaveState, setPublishSaveState] = useState<"local" | "saving" | "saved" | "offline" | "failed">("local");
const [publishStatusText, setPublishStatusText] = useState("Local publish settings");
```

Add `loadPublishSettings` via `useEffect` using `GET /api/agent-config`; if unavailable, leave local fallback and show `API offline - local publish settings`.

Add `savePublishSettings(nextStatus: PublishStatus)` that calls `PUT /api/agent-config` with:

```ts
{
  publishSettings: {
    status: nextStatus,
    portalAccessMode: "token",
    versionLabel: publishSettings.versionLabel,
  },
}
```

Only include `setPortalToken` when `publishTokenDraft.trim()` is non-empty. Clear the token input after a successful API load or save so a saved real token cannot be overwritten by the demo token.

Guard the response and set state. If `/api` fails, update local state only and set offline status.

- [x] **Step 4: Render settings controls in Publish**

Change `PublishView` signature to receive the settings/state props. Render:

- status badge from `publishSettings.status`
- version label input with programmatic label
- portal token input with `type="password"` and `autoComplete="off"`
- last4 row showing `Token ending ****{portalTokenLast4}` or `No saved token yet`
- buttons:
  - `Save draft`
  - `Publish`
  - `Pause`
- compact status text from `publishStatusText`

Keep existing Portal access / Frontstage visible / Admin-only cards.

- [x] **Step 5: Verify frontend**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
```

Expected: both pass.

## Task 4: Status, Verification, PR

**Files:**
- Modify: `.hermes/project-status.md`

- [x] **Step 1: Update project status**

Set active work:

```markdown
- Branch: `codex/publish-settings-api`
- Scope: DB/API-backed Publish settings and Portal token metadata for the admin Publish surface.
```

Add current state:

```markdown
- PR #21 was merged into `main` on 2026-05-11 at merge commit `93815b3`; this branch starts the Publish settings API slice from latest `main`.
- Added DB/API-backed publish settings on the default Agent config, including publish status, version label, token hash, and token last4 metadata without returning plaintext portal tokens.
- Admin Publish now loads/saves publish settings through `/api/agent-config` and keeps a local fallback when `/api` is offline.
```

- [x] **Step 2: Run final checks**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run build
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Expected: all pass; `git diff --check` may print CRLF warnings only.

- [x] **Step 3: Browser smoke**

Completed by the controller after subagent handoff.

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentFirstInterface?adminToken=admin-demo-token
```

Verify Publish renders status/version/token controls, the token input is password/autocomplete off, the page still opens Portal preview, and console has no warnings/errors.

Result: passed on `http://127.0.0.1:8081/preview/ai-os/AgentFirstInterface?adminToken=admin-demo-token`; the token field was empty/password/autocomplete-off, Portal preview opened `AgentPortalInterface?token=portal-demo-token`, and no console warnings/errors were reported.

## Self-Review

- Spec coverage: This plan persists publish settings, avoids plaintext portal token storage/return, exposes settings through the existing Agent config API, and wires the Publish UI with offline fallback.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: `AgentPublishSettings`, `UpdateAgentPublishSettingsInput`, and frontend `PublishSettingsApi` names are consistent.
