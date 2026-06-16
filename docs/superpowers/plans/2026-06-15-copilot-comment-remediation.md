# Copilot Comment Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the still-current Copilot review comments identified in `docs/copilot-comments-audit-2026-06-15.md` through small, reviewable commits.

**Architecture:** Fixes are split by ownership boundary: agent manifests/tests, mission/API runtime, generated OpenAPI contracts, Portal UI, AgentFirst/legacy UI, i18n/operator polish, and docs. Each commit must pass focused tests before review, then a separate reviewer agent must inspect the commit diff before the next commit starts.

**Tech Stack:** TypeScript, Express, React/Vite, OpenAPI/Orval, Zod, node:test, Playwright where UI behavior needs browser verification.

## Execution Status

Status as of 2026-06-16 on branch `fix/copilot-comment-remediation`: complete.

| Planned task | Commit | Review status |
|---|---|---|
| Commit 1: Restore Life-Insurance Template Agents | `85305e0` | Ready |
| Commit 2: Harden Agent and Team API Routes | `b1edb92` | Ready |
| Commit 3: Mission QA and Runtime Error Semantics | `5616a6a` | Ready |
| Commit 4: Portal Runtime UI Correctness | `0f130f3` | Ready after follow-up fixes |
| Commit 5: AgentFirst Mobile, Runtime, and Workbench Fixes | `2e9b80d` | Ready |
| Commit 6: Legacy AI Interface and Shared UI i18n Cleanup | `9c5a527` | Ready after follow-up fixes |
| Commit 7: Locale Fallback and OpenAPI Naming Polish | `032dfbc` | Ready |
| Residual audit label cleanup | `e833eab` | Ready after reviewer-requested fixes |
| Commit 8: Final Docs, Full Verification, and Audit Closure | `0316a5c` | Final branch review found one Portal module-ID contract gap |
| Final reviewer follow-up: Portal registered runtime modules | `ceb8d26` | Ready after reviewer `Nash` review |

Commit 8 was implemented by `0316a5c`, the docs closure commit that updated this plan and `docs/copilot-comments-audit-2026-06-15.md`. Final branch review then found one valid Portal/OpenAPI contract gap; `ceb8d26` fixes that follow-up.

The detailed checklist below is preserved as the original execution contract; the status table above records the completed implementation state.

Full verification after `e833eab`, plus focused verification after `ceb8d26`:

```powershell
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
corepack pnpm --dir artifacts/mockup-sandbox run test:portal
git diff --check
```

All commands passed. The API test suite reported 380 tests: 377 passed and 3 skipped for environment-gated Windows symlink / `TEST_DATABASE_URL` checks. Browser smoke also passed for desktop language toggle, Backstage, Operator, Portal entry, and mobile Portal/language switching.

---

## Review Protocol

After every commit:

1. Capture the commit boundary:
   ```powershell
   $BASE_SHA = git rev-parse HEAD~1
   $HEAD_SHA = git rev-parse HEAD
   ```
2. Dispatch a reviewer agent with:
   - Scope: the single commit just made
   - Requirements: the task section below plus linked Copilot IDs
   - Base/head SHAs: `$BASE_SHA`, `$HEAD_SHA`
3. Fix all Critical and Important findings in a follow-up commit for the same task before proceeding.
4. Re-run the task's focused validation.

Reviewer prompt template:

```text
Review commit {HEAD_SHA} against base {BASE_SHA}.

Task: <Task N title from docs/superpowers/plans/2026-06-15-copilot-comment-remediation.md>
Copilot IDs addressed: <IDs>
Requirements:
- Verify the implementation actually resolves the listed audit items.
- Check for regressions, missing tests, stale generated files, and mismatched docs.
- Findings first, severity ordered. Mark Critical/Important/Minor.
```

## Commit 1: Restore Life-Insurance Template Agents

**Copilot IDs:** `C009`, `C011`, `C130`, partially `C131`

**Files:**
- Create: `agents/custom/pricing_actuary/agent.yaml`
- Create: `agents/custom/life_uw_analyst/agent.yaml`
- Create: `agents/custom/claims_reviewer/agent.yaml`
- Create: `agents/custom/compliance_auditor/agent.yaml`
- Modify: `artifacts/api-server/src/agent-registry/agent-loader.test.ts`
- Modify: `docs/demos/life-insurance-agents.md`

- [ ] Add the four custom template manifests. Each manifest must include:
  - `agentId`
  - `name`
  - `description`
  - `source: custom`
  - `runtimeStatus: template`
  - `teamId: insurance`
  - `instructions`
  - `identity`
  - `criticalRules`
  - `deliverables`
  - `workflow`
  - `communicationStyle`
  - `successMetrics`
  - `skills: []`
  - `planner`
  - `permissions`
  - `memory`
  - `handoffs: []`
  - `tests: []`
- [ ] Add/adjust loader tests so one custom template exercises nine-segment normalization and runtimeStatus default/explicit behavior.
- [ ] Either implement `runtimeStatus` filtering in `/api/agents` in Commit 2, or update the demo doc in this commit to remove the server-side filter claim.
- [ ] Run:
  ```powershell
  corepack pnpm --filter @workspace/api-server exec tsx --test src/agent-registry/agent-loader.test.ts
  corepack pnpm --filter @workspace/scripts run agent:validate
  ```
- [ ] Commit:
  ```powershell
  git add agents/custom artifacts/api-server/src/agent-registry/agent-loader.test.ts docs/demos/life-insurance-agents.md
  git commit -m "fix(agent-registry): restore life insurance template agents"
  ```
- [ ] Request reviewer-agent review before Commit 2.

## Commit 2: Harden Agent and Team API Routes

**Copilot IDs:** `C031`, `C032`, `C033`, `C034`, `C044`, `C045`, `C046`, `C051`, optionally `C131`

**Files:**
- Modify: `artifacts/api-server/src/routes/agents.ts`
- Modify: `artifacts/api-server/src/routes/agents.test.ts`
- Modify: `artifacts/api-server/src/routes/agent-runs.test.ts`
- Modify: `artifacts/api-server/src/routes/teams.ts`
- Modify: `artifacts/api-server/src/teams/team-service.ts`
- Create: `artifacts/api-server/src/routes/teams.test.ts`
- Modify: `lib/api-spec/openapi.yaml` if adding `runtimeStatus` query filter
- Regenerate: `lib/api-zod/src/generated/*`, `lib/api-client-react/src/generated/*` if OpenAPI changes

- [ ] Normalize `/agents` query params. Reject repeated `teamId` or `runtimeStatus` with 400, or intentionally choose first value and test it. Prefer 400 because it prevents silent filtering bugs.
- [ ] Convert filtered agent IDs to `Set` before filtering readiness.
- [ ] Add `/agents?teamId=...` route tests.
- [ ] If keeping docs' runtimeStatus example, implement `/agents?runtimeStatus=template` and add tests/spec/codegen.
- [ ] Make agent-run test helper parse JSON defensively.
- [ ] Cache team registry loading or make it dependency-injectable per router instance, then validate `/teams` response through `ListTeamsResponse.parse`.
- [ ] Wrap malformed YAML parse errors with the registry path.
- [ ] Add `/teams` route test with injected registry and agents with `teamId`.
- [ ] Run:
  ```powershell
  corepack pnpm --filter @workspace/api-server exec tsx --test src/routes/agents.test.ts src/routes/agent-runs.test.ts src/routes/teams.test.ts
  corepack pnpm --filter @workspace/api-server run typecheck
  ```
- [ ] If OpenAPI changed:
  ```powershell
  corepack pnpm --filter @workspace/api-spec run codegen
  corepack pnpm run typecheck:libs
  ```
- [ ] Commit:
  ```powershell
  git add artifacts/api-server/src/routes artifacts/api-server/src/teams lib/api-spec lib/api-zod lib/api-client-react docs/demos/life-insurance-agents.md
  git commit -m "fix(api): harden agent and team routes"
  ```
- [ ] Request reviewer-agent review before Commit 3.

## Commit 3: Mission QA and Runtime Error Semantics

**Copilot IDs:** `C016`, `C025`, `C026`, `C040`, `C060`, `C148`, `C149`, `C150`

**Files:**
- Modify: `artifacts/api-server/src/agent-runtime/dag-executor.ts`
- Modify: `artifacts/api-server/src/agent-runtime/dag-executor.test.ts`
- Modify: `artifacts/api-server/src/mission/mission-plan.ts`
- Modify: mission plan tests under `artifacts/api-server/src/mission/*test.ts`
- Modify: `artifacts/api-server/src/tool-adapters/resume-service.ts`
- Modify: `artifacts/api-server/src/routes/modules.ts`
- Modify: `artifacts/api-server/src/routes/modules.test.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`, `lib/api-client-react/src/generated/*`

- [ ] Change unsupported QA assertions (`json_schema`, `content_contains`) to fail closed with a reason until implemented.
- [ ] Add tests for fail-closed QA behavior.
- [ ] Validate mission step `role` enum and `evidenceContract` shape in `validateMissionPlan()`.
- [ ] Export shared activation profile defaults, e.g. `DEFAULT_ACTIVATION_PROFILE`.
- [ ] Add tests for invalid role, invalid evidenceContract, and default constant use.
- [ ] Introduce `ModuleRunNotFoundError` in resume service.
- [ ] Route `ModuleRunNotFoundError` to 404 without string matching.
- [ ] Update OpenAPI:
  - `evidenceContract.additionalProperties: false`
  - express QA reviewer requirements using `oneOf` if practical
  - `activationProfile` defaults
- [ ] Run:
  ```powershell
  corepack pnpm --filter @workspace/api-server exec tsx --test src/agent-runtime/dag-executor.test.ts src/mission/*.test.ts src/routes/modules.test.ts
  corepack pnpm --filter @workspace/api-spec run codegen
  corepack pnpm run typecheck:libs
  corepack pnpm --filter @workspace/api-server run typecheck
  ```
- [ ] Commit:
  ```powershell
  git add artifacts/api-server/src/agent-runtime artifacts/api-server/src/mission artifacts/api-server/src/tool-adapters artifacts/api-server/src/routes/modules.ts artifacts/api-server/src/routes/modules.test.ts lib/api-spec lib/api-zod lib/api-client-react
  git commit -m "fix(runtime): fail closed mission qa and typed resume errors"
  ```
- [ ] Request reviewer-agent review before Commit 4.

## Commit 4: Portal Runtime UI Correctness

**Copilot IDs:** `C095`, `C096`, `C097`, `C098`, `C099`, `C100`, `C101`, `C102`, `C103`, `C104`, `C105`, `C107`, `C108`, `C111`, `C112`, `C113`, `C114`, `C115`

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx`
- Modify/create focused tests if existing test harness covers Portal; otherwise add Playwright smoke under the existing UI test location.

- [ ] Add explicit blocked icon handling.
- [ ] Include API `userMessage` or submitted prompt in Portal messages when available.
- [ ] Submit `approved` only for approval interactions; omit for non-approval feedback.
- [ ] Preserve/recompute cached detail state instead of forcing `"ready"`.
- [ ] Guard detail/source/result status updates against stale in-flight selections.
- [ ] Add selected/expanded accessibility state for "View details".
- [ ] Render artifact preview with `artifactPreview !== null`, preserving empty string content.
- [ ] Avoid `{}` placeholder previews when detailed artifact content is not loaded.
- [ ] Scope `.portal-record-row div` to the intended direct child or add a dedicated class.
- [ ] Clear runtime data and caches in `lockPortalAfterRuntimeAccessDenied()`.
- [ ] Render sync status fallback whenever `latestPortalRun` exists.
- [ ] Rename structured message state/setters from `...Text` to `...Message`, keeping translated derived `...Text` variables.
- [ ] Run:
  ```powershell
  corepack pnpm --dir artifacts/mockup-sandbox run typecheck
  corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
  ```
- [ ] Browser/Playwright smoke:
  - unlock Portal demo
  - switch views
  - open details/source/result drawers
  - submit non-approval feedback payload without `approved:false`
  - verify empty preview still renders drawer chrome
  - verify sync pill fallback appears after API-backed run state exists
- [ ] Commit:
  ```powershell
  git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentPortalInterface.tsx artifacts/mockup-sandbox
  git commit -m "fix(portal): harden runtime detail and feedback state"
  ```
- [ ] Request reviewer-agent review before Commit 5.

## Commit 5: AgentFirst Mobile, Runtime, and Workbench Fixes

**Copilot IDs:** `C068`, `C069`, `C070`, `C071`, `C072`, `C073`, `C075`, `C076`, `C081`, `C091`, `C092`

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
- Modify: `artifacts/mockup-sandbox/src/i18n/locales/en-US.ts`
- Modify: `artifacts/mockup-sandbox/src/i18n/locales/zh-CN.ts`

- [ ] Add `aria-pressed` or radio semantics to runtime execution mode segmented buttons.
- [ ] Fix `resultRecordCount` pluralization in en-US.
- [ ] Add synchronous in-flight refs for `submitCommand()` and workbench test-run submission.
- [ ] Align/rename narrowed ToolInteraction API types or use generated-compatible fields.
- [ ] Store runtime action status by run id.
- [ ] Extract one `PORTAL_DEMO_PREVIEW_URL` helper/constant.
- [ ] Replace remaining undefined `var(--text)` usages with an existing valid color token.
- [ ] Change Backstage auto-open effect to run once per triggering run id instead of on every array refresh.
- [ ] Store local fallback workbench run text as keys/values or rebuild it on locale change.
- [ ] Keep mobile Portal navigation available; do not hide `.portal-mode-switch` without an alternate mobile Portal entry.
- [ ] Run:
  ```powershell
  corepack pnpm --dir artifacts/mockup-sandbox run typecheck
  corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
  ```
- [ ] Browser/Playwright smoke:
  - mobile width <= 760 shows a Portal entry
  - language switch still reachable
  - runtime mode state is exposed
  - repeated submit cannot create duplicate request
- [ ] Commit:
  ```powershell
  git add artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx artifacts/mockup-sandbox/src/i18n/locales
  git commit -m "fix(agent-first): restore mobile portal and stabilize runtime ui"
  ```
- [ ] Request reviewer-agent review before Commit 6.

## Commit 6: Legacy AI Interface and Shared UI i18n Cleanup

**Copilot IDs:** `C061`, `C062`, `C063`, `C064`, `C066`, `C116`, `C117`, `C118`, `C119`, `C121`, `C122`

**Files:**
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/AIInterface.tsx`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_components/AgentDetail.tsx`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_components/BottomDock.tsx`
- Modify: `artifacts/mockup-sandbox/src/components/mockups/ai-os/_shared/data.ts`
- Modify: `artifacts/mockup-sandbox/src/components/operator/ManifestEditor.tsx`
- Modify: locale files as needed

- [ ] Remove unused monolith translation helper/imports.
- [ ] Store shell welcome/deploy logs as structured keys, not pretranslated strings.
- [ ] Move provider/executor architecture subtitles to locale resources.
- [ ] Lower mobile language switcher below lightweight click-away overlays or raise those overlays consistently; verify it no longer intercepts chat-tier click-away.
- [ ] Render `teamId` and `runtimeStatus` independently of `agent.identity`.
- [ ] Render deliverables, workflow, communication style, and success metrics in AgentDetail.
- [ ] Align BottomDock visible label, tooltip, and aria-label for Run/Stop.
- [ ] Move demo Markdown artifact content to locale resources.
- [ ] For JSON `SyntaxError`, display localized invalid JSON message in ManifestEditor.
- [ ] Run:
  ```powershell
  corepack pnpm --dir artifacts/mockup-sandbox run typecheck
  corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
  ```
- [ ] Browser/Playwright smoke:
  - language switch updates shell/deploy text after locale toggle
  - command/chat overlays close correctly on mobile
  - Agent detail shows nine-segment fields
- [ ] Commit:
  ```powershell
  git add artifacts/mockup-sandbox/src/components/mockups/ai-os artifacts/mockup-sandbox/src/components/operator artifacts/mockup-sandbox/src/i18n/locales
  git commit -m "fix(ui): complete shared i18n and detail rendering"
  ```
- [ ] Request reviewer-agent review before Commit 7.

## Commit 7: Locale Fallback and OpenAPI Naming Polish

**Copilot IDs:** `C006`, `C013`, `C019`, `C020`, `C021`, `C023`, `C024`, `C049`, `C055`, `C123`, `C124`, `C125`, `C126`, `C127`, `C128`, `C129`, `C141`, `C144`, `C145`

**Files:**
- Modify: `README.md`
- Modify: `artifacts/api-server/src/agent-registry/agent-manifest.ts`
- Modify: agent loader/OpenAPI references to `AgentSuccessMetric`
- Modify: `artifacts/api-server/src/climate-monitor/service.ts`
- Modify: `artifacts/api-server/src/skill-runtime/skill-manifest.ts`
- Modify: `artifacts/api-server/src/tool-adapters/cli-executor.ts`
- Modify: `artifacts/mockup-sandbox/src/i18n/locale.ts`
- Modify: `artifacts/mockup-sandbox/src/i18n/locales/en-US.ts`
- Modify: `artifacts/mockup-sandbox/src/i18n/locales/zh-CN.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate generated API artifacts

- [ ] Document `PORT` as required for the API server and `LOG_LEVEL` as optional.
- [ ] Rename singular metric type/schema to `AgentSuccessMetric`, preserving exported compatibility only if needed.
- [ ] Simplify misleading Climate Monitor configured-by types or introduce a discriminated internal type.
- [ ] Ensure internal skill execution does not masquerade as CLI readiness; either omit adapter materialization for internal or expose a clear internal kind path.
- [ ] Make CLI project fallback require explicit `projectFallback.envPath` for discovery-sensitive adapters, or document and test the regex fallback behavior.
- [ ] Use `navigatorLanguage` in `detectInitialLocale()` after query and storage preferences.
- [ ] Replace slug-style en-US labels with human-readable text.
- [ ] Translate remaining zh-CN English fallback strings.
- [ ] Add `runtimeStatus.default: runnable` in OpenAPI.
- [ ] Add a migration/changelog note for arbitrary string `ModuleId`.
- [ ] Run:
  ```powershell
  corepack pnpm --filter @workspace/api-spec run codegen
  corepack pnpm run typecheck:libs
  corepack pnpm --filter @workspace/api-server run typecheck
  corepack pnpm --dir artifacts/mockup-sandbox run typecheck
  corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
  ```
- [ ] Commit:
  ```powershell
  git add README.md artifacts/api-server/src lib/api-spec lib/api-zod lib/api-client-react artifacts/mockup-sandbox/src/i18n
  git commit -m "fix(i18n): polish locale fallbacks and api contracts"
  ```
- [ ] Request reviewer-agent review before Commit 8.

## Commit 8: Final Docs, Full Verification, and Audit Closure

**Copilot IDs:** close residual doc and audit bookkeeping.

**Files:**
- Modify: `docs/copilot-comments-audit-2026-06-15.md`
- Modify: affected docs from previous tasks if needed

- [ ] Update the audit report with resolved commit hashes for each fixed still-existing ID.
- [ ] If any item is intentionally deferred, move it to a "Deferred With Rationale" section and state why.
- [ ] Run full verification:
  ```powershell
  corepack pnpm --filter @workspace/api-server run test
  corepack pnpm --filter @workspace/api-server run typecheck
  corepack pnpm --filter @workspace/api-spec run codegen
  corepack pnpm run typecheck:libs
  corepack pnpm --dir artifacts/mockup-sandbox run typecheck
  corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
  git diff --check
  ```
- [ ] Run browser smoke across desktop/mobile for AgentFirst, Portal, Admin/Operator, and language toggle.
- [ ] Commit:
  ```powershell
  git add docs
  git commit -m "docs: close copilot comment remediation audit"
  ```
- [ ] Request final reviewer-agent review across the entire branch.

## Execution Notes

- Start execution from clean latest `main`.
- Do not mix unrelated files into a commit.
- If a task proves larger than expected, split it before coding and update this plan first.
- Prefer focused tests for every behavior change before implementation.
- Generated OpenAPI artifacts must be committed in the same commit as their source spec change.
