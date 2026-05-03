# Agent-first migration

## Goal

Move the primary AI OS mockup from an IDE-first workspace to an Agent-first workspace.

The existing `AIInterface.tsx` stays available as the developer inspector reference. The new primary module is `AgentFirstInterface.tsx`, designed around tasks, agent progress, approvals, outcomes, and inspectable implementation details.

## Product shift

Old mental model:

- User chooses files.
- AI is a side panel.
- Console and editor are always visible.

New mental model:

- User gives an objective.
- Agent progress is the main canvas.
- Code, logs, files, and preview are inspectable layers.

## Module boundary

Preview modules:

- `AIInterface.tsx`: legacy IDE-first / inspector reference.
- `AgentFirstInterface.tsx`: new Agent-first product surface.

Private implementation folders:

- `_shared/`: static data, types, theme tokens.
- `_components/`: reusable pieces for the Agent-first module.

The mockup preview plugin ignores `_` folders, so these files support the module without becoming separate preview pages.

## Initial scope

Build a complete static interactive mockup with:

- Task/project rail as the left navigation.
- Agent timeline as the central surface.
- Bottom command bar as the main user input.
- Context panel on the right for preview, changes, permissions, and runtime state.
- Inspector drawer for files, logs, and code details.
- Basic state changes for task selection, command input, plan mode, and inspector visibility.

## Out of scope

- Real agent execution.
- Real file editing.
- API integration.
- Authentication, billing, or model marketplace flows.
- Replacing the legacy `AIInterface.tsx` route.

## Acceptance criteria

- `AgentFirstInterface.tsx` is reachable at `/preview/ai-os/AgentFirstInterface`.
- Legacy `/preview/ai-os/AIInterface` still works.
- The new first viewport reads as Agent-first, not IDE-first.
- Code/files/logs are secondary and inspectable, not the default main stage.
- TypeScript typecheck passes for the mockup sandbox.
- Production build for the mockup sandbox passes.
- A screenshot can be captured for visual review.

## Verification commands

```bash
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
corepack pnpm --dir artifacts/mockup-sandbox run build
```

## Follow-up options

- Add a compact mobile layout.
- Promote the new module as the default gallery entry.
- Split the legacy interface into reusable inspector pieces only if the product direction is confirmed.
