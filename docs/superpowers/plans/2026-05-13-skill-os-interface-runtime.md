# Skill OS Interface Runtime PR Plan

Date: 2026-05-13

## Goal

Move `ai_interface` from a fixed four-module console toward a generic Skill OS v1. The PR keeps the current module-run database/API compatibility while adding manifest-driven skills, a `/api/skills` contract, and a Replit-style Foreground/Backstage interface.

## Scope

- Add a generic skill manifest runtime for built-in and registered custom skills.
- Register four built-in project skills:
  - `web_listening` -> `../web_listening`
  - `doc_to_md` -> `../doc_to_md`
  - `md_to_rag` -> `../c-ross-2`
  - `rag_to_agent` -> `../c-ross-2`
- Add redacted project path and adapter readiness to `GET /api/skills`.
- Preserve `moduleId` compatibility and add `skillId` to Agent plan/run semantics.
- Update planner normalization so only enabled/registered skills become run steps.
- Add Foreground/Backstage switching to `AgentFirstInterface`.
- Add Backstage skill catalog, manifest details, Run I/O, Events, Artifacts, Raw JSON, and sandboxed Skill UI iframe behavior.
- Add generic artifact renderers for Markdown, table-like JSON arrays, JSON objects, text, and file/image placeholders.
- Update OpenAPI, generated Zod schemas, generated React client, README, and project status.

## Out Of Scope

- Executing real sibling project commands.
- Copying code, secrets, `.env` files, or generated credentials from sibling projects.
- Building a DAG workflow engine. v1 remains an ordered linear flow.
- Injecting skill HTML into the foreground user chat.

## Backend Implementation

1. Add `artifacts/api-server/src/skill-runtime/skill-manifest.ts`.
2. Define `SkillManifest`, `SkillUi`, `SkillExecution`, `SkillPermissionDefaults`, `SkillArtifactRenderer`, and readiness types.
3. Create built-in manifests for the four project skills with input/output schemas, interaction kinds, artifact kinds, UI metadata, permission defaults, execution metadata, and project metadata.
4. Add `createSkillManifestRegistry` for built-in plus custom manifests.
5. Add `listSkillReadiness` with env/default sibling path existence checks that return only redacted metadata.
6. Add `GET /api/skills`.
7. Update module run creation to allow registered skill IDs while preserving unknown-module rejection.
8. Update Agent runtime planning to:
   - use explicit `enabledSkillIds` when provided;
   - build enabled definitions from skill manifests;
   - normalize planner output by `skillId`;
   - warn and drop unknown or disabled skill steps;
   - store `skillId`, skill UI, project, and artifact metadata on module runs.

## Frontend Implementation

1. Add Foreground/Backstage mode switch to `AgentFirstInterface`.
2. Keep existing Agent/Modules/Progress/Data/Configure/Publish as Foreground.
3. Add Backstage:
   - skill catalog;
   - selected skill detail;
   - readiness and adapter summary;
   - Run I/O tab;
   - Events tab;
   - Artifacts tab;
   - Skill UI iframe tab when `htmlEntrypoint` exists;
   - Raw JSON tab.
4. Add links from Foreground run/module surfaces into Backstage skill detail.
5. Auto-select the Skill UI tab for open-on-trigger approval/blocked/waiting runs.

## API And Codegen

1. Update `lib/api-spec/openapi.yaml`.
2. Add `/skills` path and schemas for skill manifests/readiness.
3. Convert `ModuleId` from fixed enum to string to allow registered skill compatibility.
4. Add `skillId` to Agent plan steps and optional compatibility fields around module/artifact contracts.
5. Run `corepack pnpm --filter @workspace/api-spec run codegen`.

## Tests

Backend tests:

- `/api/skills` returns the four built-in skill manifests and readiness.
- built-in manifests map to the requested project paths.
- custom skill manifests can be registered and used by planner/runtime.
- unknown module IDs still reject unless registered as a skill.
- unknown planner skill IDs are dropped with warnings.
- readiness does not leak env values or configured local path values.

Frontend validation:

- `AgentFirstInterface` typechecks.
- production build succeeds with the default preview set to `ai-os/AgentFirstInterface`.
- browser smoke verifies Foreground, Backstage, four-skill catalog, manifest detail, I/O, artifacts, raw JSON, and Skill UI iframe behavior.

Required commands:

```bash
corepack pnpm --filter @workspace/api-server run test
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm run typecheck:libs
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
```

```powershell
$env:PORT='8080'
$env:BASE_PATH='/'
$env:VITE_DEFAULT_PREVIEW='ai-os/AgentFirstInterface'
corepack pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

## Deliverables

- One PR on a `codex/...` branch.
- `/api/skills` contract and generated clients.
- Built-in manifests for `web_listening`, `doc_to_md`, `md_to_rag`, and `rag_to_agent`.
- Manifest-driven Agent planner/runtime compatibility.
- Working Foreground/Backstage UI in the current browser target.
- Generic artifact renderer and Skill HTML iframe tab behavior.
- README updated with Agent OS overview, manifest contract, project mappings, setup, and verification.
- `.hermes/project-status.md` updated with branch state, changed files, checks, blockers, and next action.
