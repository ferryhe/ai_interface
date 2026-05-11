# Portal Token Verification API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the frontstage Portal unlock through a backend token verification endpoint backed by the stored Publish settings, without exposing plaintext tokens or token hashes.

**Architecture:** Add a small backend service function that checks the default Agent config publish settings and compares the submitted portal token against the stored SHA-256 hash. Expose it as `POST /api/portal-auth/verify`, regenerate API schemas/clients, and update `AgentPortalInterface` to call the endpoint while preserving local demo fallback when `/api` is offline.

**Tech Stack:** TypeScript, Express, OpenAPI/Orval, Zod, React mockup sandbox.

---

## Design Summary

PR #22 persists Publish settings and stores only `portalTokenHash` plus token metadata. This PR connects the frontstage Portal token gate to that persisted state:

- Admin Publish remains the place that sets publish status and portal token.
- Portal token verification is a narrow stateless check. It does not create sessions, cookies, JWTs, users, or refresh tokens.
- Public responses never include `portalTokenHash` or plaintext tokens.
- Portal stays usable in mockup-only mode: if `/api/portal-auth/verify` is offline, a token with at least six characters unlocks locally and clearly labels the state as demo/offline.
- Sibling repos are off-limits.

## File Structure

- Modify `artifacts/api-server/src/agent-config/agent-config-service.ts`
  - Export a portal access verification type and `verifyPortalAccess(repository, token)` helper.
  - Use constant-time comparison for same-length SHA-256 token hashes.
- Modify `artifacts/api-server/src/agent-config/agent-config-service.test.ts`
  - Add tests for missing token, draft/not published state, wrong token, and valid published token.
- Create `artifacts/api-server/src/routes/portal-auth.ts`
  - Parse `VerifyPortalAccessRequest`, call the service helper, and return `VerifyPortalAccessResponse`.
- Modify `artifacts/api-server/src/routes/index.ts`
  - Register the new `portalAuthRouter`.
- Modify `lib/api-spec/openapi.yaml`
  - Add the `portal-auth` tag, path, request schema, status enum, and response schema.
- Regenerate `lib/api-zod/src/generated/**` and `lib/api-client-react/src/generated/**`.
- Modify `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
  - Add guarded response parsing for portal verification.
  - Submit the token to `/api/portal-auth/verify`.
  - Show API authorized / invalid / not published / offline status text in the lock screen and top bar.
- Modify `.hermes/project-status.md`
  - Record PR #22 merge and the new branch scope.

## API Contract

Add:

```yaml
/portal-auth/verify:
  post:
    operationId: verifyPortalAccess
    tags: [portal-auth]
    summary: Verify Portal access token
    description: Checks a submitted Portal token against the stored Publish settings without returning secrets.
```

Request:

```ts
interface VerifyPortalAccessRequest {
  token: string;
}
```

Response:

```ts
type PortalAccessStatus =
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published";

interface VerifyPortalAccessResponse {
  status: PortalAccessStatus;
  authorized: boolean;
  publishStatus: "draft" | "published" | "paused";
  versionLabel: string;
  portalTokenLast4: string | null;
  checkedAt: string;
}
```

Rules:

- `missing_token`: submitted token is empty or whitespace.
- `not_published`: Agent config is `draft` or `paused`; do not authorize even if the token matches.
- `invalid_token`: config is `published`, but no token is configured or submitted token hash does not match.
- `authorized`: config is `published`, a token hash exists, and the submitted token hash matches.
- Never return `portalTokenHash`.
- Never store or log the submitted plaintext token.

## Task 1: Backend Verification Service

**Files:**
- Modify: `artifacts/api-server/src/agent-config/agent-config-service.ts`
- Test: `artifacts/api-server/src/agent-config/agent-config-service.test.ts`

- [x] **Step 1: Write failing service tests**

Append tests:

```ts
import { verifyPortalAccess } from "./agent-config-service";

test("portal access verification rejects missing tokens", async () => {
  const repository = new InMemoryAgentConfigRepository();

  const result = await verifyPortalAccess(repository, "   ");

  assert.equal(result.status, "missing_token");
  assert.equal(result.authorized, false);
  assert.equal(result.publishStatus, "draft");
  assert.equal(result.portalTokenLast4, null);
});

test("portal access verification blocks unpublished configs", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "draft",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "draft-build",
    },
  });

  const result = await verifyPortalAccess(repository, "portal-secret-token");

  assert.equal(result.status, "not_published");
  assert.equal(result.authorized, false);
  assert.equal(result.publishStatus, "draft");
  assert.equal(result.versionLabel, "draft-build");
  assert.equal(result.portalTokenLast4, "oken");
});

test("portal access verification rejects wrong tokens", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const result = await verifyPortalAccess(repository, "wrong-token");

  assert.equal(result.status, "invalid_token");
  assert.equal(result.authorized, false);
  assert.equal(result.publishStatus, "published");
  assert.equal(result.versionLabel, "agent-v1");
  assert.equal(JSON.stringify(result).includes("portal-secret-token"), false);
});

test("portal access verification authorizes a published matching token", async () => {
  const repository = new InMemoryAgentConfigRepository();
  await updateAgentConfig(repository, {
    publishSettings: {
      status: "published",
      portalAccessMode: "token",
      setPortalToken: "portal-secret-token",
      versionLabel: "agent-v1",
    },
  });

  const result = await verifyPortalAccess(repository, "portal-secret-token");

  assert.equal(result.status, "authorized");
  assert.equal(result.authorized, true);
  assert.equal(result.publishStatus, "published");
  assert.equal(result.portalTokenLast4, "oken");
  assert.equal(result.versionLabel, "agent-v1");
  assert.ok(result.checkedAt);
  assert.equal(JSON.stringify(result).includes("portal-secret-token"), false);
});
```

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: fails because `verifyPortalAccess` does not exist.

- [x] **Step 2: Implement verification helper**

In `agent-config-service.ts`, change the crypto import:

```ts
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
```

Add:

```ts
export type PortalAccessStatus =
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published";

export interface PortalAccessVerification {
  status: PortalAccessStatus;
  authorized: boolean;
  publishStatus: AgentPublishStatus;
  versionLabel: string;
  portalTokenLast4: string | null;
  checkedAt: string;
}

function hashesMatch(actualHash: string, expectedHash: string): boolean {
  if (actualHash.length !== expectedHash.length) return false;
  return timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

export async function verifyPortalAccess(
  repository: AgentConfigRepository,
  tokenInput: string,
): Promise<PortalAccessVerification> {
  const config = await getAgentConfig(repository);
  const settings = config.publishSettings;
  const checkedAt = new Date().toISOString();
  const base = {
    authorized: false,
    publishStatus: settings.status,
    versionLabel: settings.versionLabel,
    portalTokenLast4: settings.portalTokenLast4,
    checkedAt,
  };
  const token = tokenInput.trim();
  if (!token) return { ...base, status: "missing_token" };
  if (settings.status !== "published") return { ...base, status: "not_published" };
  if (!settings.portalTokenHash) return { ...base, status: "invalid_token" };
  const actualHash = hashPortalToken(token);
  if (!hashesMatch(actualHash, settings.portalTokenHash)) {
    return { ...base, status: "invalid_token" };
  }
  return { ...base, status: "authorized", authorized: true };
}
```

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
```

Expected: service tests pass.

## Task 2: Route And OpenAPI Contract

**Files:**
- Create: `artifacts/api-server/src/routes/portal-auth.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Generate: `lib/api-zod/src/generated/**`
- Generate: `lib/api-client-react/src/generated/**`

- [x] **Step 1: Add route**

Create `portal-auth.ts`:

```ts
import { Router, type IRouter } from "express";
import { VerifyPortalAccessBody, VerifyPortalAccessResponse } from "@workspace/api-zod";

import { DbAgentConfigRepository } from "../agent-config/db-repository";
import { verifyPortalAccess } from "../agent-config/agent-config-service";

const router: IRouter = Router();
const repository = new DbAgentConfigRepository();

function errorResponse(message: string): { error: string } {
  return { error: message };
}

router.post("/portal-auth/verify", async (req, res) => {
  const body = VerifyPortalAccessBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json(errorResponse(body.error.message));
    return;
  }

  try {
    const verification = await verifyPortalAccess(repository, body.data.token);
    const data = VerifyPortalAccessResponse.parse({
      ...verification,
      checkedAt: new Date(verification.checkedAt),
    });
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json(errorResponse(message));
  }
});

export default router;
```

Register in `routes/index.ts`:

```ts
import portalAuthRouter from "./portal-auth";
router.use(portalAuthRouter);
```

- [x] **Step 2: Add OpenAPI schemas**

Add top-level tag:

```yaml
  - name: portal-auth
```

Add path after `/agent-config/test-connection`:

```yaml
  /portal-auth/verify:
    post:
      operationId: verifyPortalAccess
      tags: [portal-auth]
      summary: Verify Portal access token
      description: Checks a submitted Portal token against stored Publish settings without returning secrets.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/VerifyPortalAccessRequest"
      responses:
        "200":
          description: Portal access verification result
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/VerifyPortalAccessResponse"
        "400":
          description: Invalid verification payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "500":
          description: Verification failed
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
```

Add schemas:

```yaml
    PortalAccessStatus:
      type: string
      enum: [authorized, missing_token, invalid_token, not_published]
    VerifyPortalAccessRequest:
      type: object
      properties:
        token:
          type: string
      required:
        - token
    VerifyPortalAccessResponse:
      type: object
      properties:
        status:
          $ref: "#/components/schemas/PortalAccessStatus"
        authorized:
          type: boolean
        publishStatus:
          $ref: "#/components/schemas/AgentPublishStatus"
        versionLabel:
          type: string
        portalTokenLast4:
          type:
            - string
            - "null"
        checkedAt:
          type: string
          format: date-time
      required:
        - status
        - authorized
        - publishStatus
        - versionLabel
        - portalTokenLast4
        - checkedAt
```

- [x] **Step 3: Regenerate**

Run:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
```

Expected: passes.

- [x] **Step 4: Verify backend build**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run build
```

Expected: passes.

## Task 3: Portal UI Token Gate Wire-Up

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`

- [x] **Step 1: Add UI types and guards**

Add near Portal run state types:

```ts
type PortalAccessState =
  | "idle"
  | "checking"
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published"
  | "offline"
  | "failed";

type PortalAccessStatus =
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published";

interface PortalAccessVerificationResponse {
  status: PortalAccessStatus;
  authorized: boolean;
  publishStatus: "draft" | "published" | "paused";
  versionLabel: string;
  portalTokenLast4: string | null;
  checkedAt: string;
}
```

Add guards:

```ts
function isPortalAccessStatus(value: unknown): value is PortalAccessStatus {
  return (
    value === "authorized" ||
    value === "missing_token" ||
    value === "invalid_token" ||
    value === "not_published"
  );
}

function isPublishStatus(value: unknown): value is PortalAccessVerificationResponse["publishStatus"] {
  return value === "draft" || value === "published" || value === "paused";
}

function isPortalAccessVerificationResponse(
  value: unknown,
): value is PortalAccessVerificationResponse {
  if (!isJsonObject(value)) return false;
  return (
    isPortalAccessStatus(value["status"]) &&
    typeof value["authorized"] === "boolean" &&
    isPublishStatus(value["publishStatus"]) &&
    typeof value["versionLabel"] === "string" &&
    isNullableString(value["portalTokenLast4"]) &&
    typeof value["checkedAt"] === "string"
  );
}
```

- [x] **Step 2: Add state and labels**

Replace the initial unlock state with:

```ts
const [isUnlocked, setIsUnlocked] = useState(false);
const [portalAccessState, setPortalAccessState] = useState<PortalAccessState>(
  initialToken ? "checking" : "idle",
);
const [portalAccessStatusText, setPortalAccessStatusText] = useState(
  initialToken ? "Checking Portal token" : "Enter Portal token",
);
const [portalAccessVersionLabel, setPortalAccessVersionLabel] = useState("draft-0.3");
```

Add a `useMemo` or small function:

```ts
function portalAccessStateLabel(state: PortalAccessState): string {
  if (state === "checking") return "Checking";
  if (state === "authorized") return "API authorized";
  if (state === "missing_token") return "Token required";
  if (state === "invalid_token") return "Invalid token";
  if (state === "not_published") return "Not published";
  if (state === "offline") return "Demo offline";
  if (state === "failed") return "Verification failed";
  return "Locked";
}
```

- [x] **Step 3: Implement verification action**

Change `submitToken` to async and add:

```ts
async function verifyPortalToken(tokenInput: string): Promise<void> {
  const cleanToken = tokenInput.trim();
  if (!cleanToken) {
    setPortalAccessState("missing_token");
    setPortalAccessStatusText("Enter a Portal token to continue");
    return;
  }

  setPortalAccessState("checking");
  setPortalAccessStatusText("Checking Portal token");

  try {
    const response = await fetch("/api/portal-auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cleanToken }),
    });
    if (!response.ok) throw new Error(`Portal access API returned ${response.status}`);
    const data: unknown = await response.json();
    if (!isPortalAccessVerificationResponse(data)) {
      throw new Error("Portal access API returned an unexpected payload");
    }
    setPortalAccessVersionLabel(data.versionLabel);
    setPortalAccessState(data.status);
    if (data.authorized) {
      setIsUnlocked(true);
      setPortalAccessStatusText(`Published Agent ${data.versionLabel} unlocked`);
      return;
    }
    if (data.status === "not_published") {
      setPortalAccessStatusText(`Agent is ${data.publishStatus}; Portal is not open yet`);
      return;
    }
    if (data.status === "invalid_token") {
      setPortalAccessStatusText("Token was checked by API and rejected");
      return;
    }
    setPortalAccessStatusText("Enter a Portal token to continue");
  } catch {
    if (cleanToken.length >= 6) {
      setIsUnlocked(true);
      setPortalAccessState("offline");
      setPortalAccessStatusText("API offline - local demo Portal unlocked");
      return;
    }
    setPortalAccessState("failed");
    setPortalAccessStatusText("Portal access API unavailable");
  }
}
```

Add an effect for query-token preview:

```ts
useMemo(() => {
  if (initialToken) void verifyPortalToken(initialToken);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

If the repo lint dislikes using `useMemo` for side effects, import `useEffect` and use `useEffect` instead.

Change `submitToken`:

```ts
async function submitToken(event: FormEvent<HTMLFormElement>): Promise<void> {
  event.preventDefault();
  await verifyPortalToken(token);
}
```

- [x] **Step 4: Render access status**

In the lock screen:

- Disable the button when `portalAccessState === "checking"` or token is empty.
- Button label is `Checking` during verification and `Enter Portal` otherwise.
- Replace the demo-only `<em>` with the live status text:

```tsx
<em>{portalAccessStatusText}</em>
```

In the unlocked topbar, replace `Demo token active` with:

```tsx
{portalAccessStateLabel(portalAccessState)}
```

Also show the version label in a compact pill or reuse the status text if the layout would get crowded.

- [x] **Step 5: Verify frontend**

Run:

```powershell
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
```

Expected: both pass.

## Task 4: Status And Final Validation

**Files:**
- Modify: `.hermes/project-status.md`

- [x] **Step 1: Update project status**

Set active work:

```markdown
- Branch: `codex/portal-token-verification-api`
- Scope: Server-backed Portal token verification and frontstage token gate API wire-up.
```

Add current state:

```markdown
- PR #22 was merged into `main` on 2026-05-11 at merge commit `115b1e7`; this branch starts the Portal token verification slice from latest `main`.
- Added `POST /api/portal-auth/verify` so the frontstage Portal can check submitted tokens against stored Publish settings without returning token hashes or plaintext tokens.
- Portal token gate now calls the verification API when available and falls back to clearly labeled local demo access when `/api` is offline.
```

- [x] **Step 2: Run final checks**

Run:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
$env:PORT='8080'; $env:BASE_PATH='/'; $env:VITE_DEFAULT_PREVIEW='ai-os/AgentPortalInterface'; corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Expected: all pass; `git diff --check` may print CRLF warnings only.

- [x] **Step 3: Browser smoke**

Open:

```text
http://127.0.0.1:8081/preview/ai-os/AgentPortalInterface
```

Verify:

- Lock screen renders and button is disabled for an empty token.
- A six-character token unlocks the Portal when `/api` is offline and shows the offline/demo status.
- `?token=portal-demo-token` still opens the Portal preview.
- Chat, Steps, Data, Sources, and Result nav remain present.
- Console has no warnings/errors.

Result: passed. The in-app browser verified the locked token screen, disabled empty-token submit, query-token local demo/offline unlock, Chat/Steps/Data/Sources/Result navigation, and no console warnings/errors. Direct token typing in the browser automation hit the known virtual clipboard limitation, so the unlock path was verified with `?token=portal-demo-token`.

## Self-Review

- Spec coverage: The backend can verify stored Publish tokens, the public API has request/response schemas, and the Portal lock screen uses the API with local fallback.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: `PortalAccessStatus`, `VerifyPortalAccessRequest`, and `VerifyPortalAccessResponse` are used consistently across service, route, OpenAPI, generated clients, and UI guards.
