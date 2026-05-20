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
