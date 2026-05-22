# Community Skills

Community skills are repository-managed manifests that can be reviewed and
shared with the project without changing core TypeScript runtime code.

## Contributor Workflow

1. Create `skills/community/<skillId>/skill.yaml`.
2. Run `corepack pnpm run skill:validate`.
3. Run API tests with `corepack pnpm --filter @workspace/api-server run test`.
4. Open a PR with the manifest and any documentation changes.

Keep community manifests declarative. The runtime can now load community
manifests, plan with provider fallback, and execute supported CLI, HTTP, and
MCP adapters only when real execution is explicitly enabled. Add code only when
the skill needs a core-owned executor or API change; ordinary skills should stay
manifest-only.

## Complete Manifest Template

Use `skills/community/example_reporter/skill.yaml` as the checked-in example.
A usable manifest needs the full contract, not just `project` and `execution`:

```yaml
skillId: my_skill
moduleId: my_skill
name: My Skill
title: My Skill
description: Short user-facing description of what this skill does.
category: transform
project:
  source: community
  defaultSiblingPath: ../my_skill
  envPath: MY_SKILL_PROJECT_PATH
  repoUrl: https://github.com/example/my_skill
  packageName: my_skill
execution:
  kind: cli
  adapterId: my_skill.cli.v1
  requiredEnv:
    - MY_SKILL_CLI_PATH
  optionalEnv:
    - MY_SKILL_WORKDIR
  timeoutMs: 120000
  maxOutputBytes: 1048576
  command:
    - my-skill
    - run
    - --json
  workingDirectory: project
  allowedCommands:
    - my-skill run --json
  supportsResume: false
  readinessHint: Set MY_SKILL_CLI_PATH to enable CLI handoffs.
inputSchema:
  type: object
  additionalProperties: false
  properties:
    prompt:
      type: string
  required:
    - prompt
outputSchema:
  type: object
  additionalProperties: true
interactionKinds:
  - question
artifactKinds:
  - report_markdown
ui:
  mode: auto
  openOnTrigger: false
  preferredRenderer: markdown
permissions:
  approvalRequired: true
  canUseNetwork: false
  canWriteDatabase: true
```

`project.defaultSiblingPath` and `project.envPath` drive project readiness
metadata. Some existing built-in adapters still have core-owned sibling
fallback checks for executor-specific files, such as runner scripts. Treat those
as runtime implementation details until the manifest contract grows an explicit
project readiness section for required files.
