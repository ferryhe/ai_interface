# PR11 Progress - Polish + Regression Hardening

## 目标

完成 Mission Control 改造的最后收尾，确认 Mission-first 叙事、前端入口 polish、回归测试与 handoff 文档都已闭环：

- README / docs / workbench 文档与当前产品入口一致
- Mission Center 成为 normal-user 默认路径
- Backstage / Operator 入口清晰且高级路径不影响存量 API
- approve / execute 分离、redaction、并发/幂等规则有测试保护

## 本 PR 范围

- `README.md`
- `docs/README.md`
- `docs/workbench/README.md`
- `artifacts/mockup-sandbox/src/components/mission/MissionCenterShell.tsx`
- `artifacts/mockup-sandbox/src/components/mission/ExecutionBoard.tsx`
- `artifacts/mockup-sandbox/src/components/approvals/ApprovalInbox.tsx`
- `artifacts/mockup-sandbox/src/components/mockups/ai-os/AgentFirstInterface.tsx`
- `artifacts/mockup-sandbox/src/components/mockups/ai-os/AIInterface.tsx`
- `artifacts/api-server/src/routes/missions.test.ts`
- `docs/workbench/projects/ai_interface/STATE.md`
- `docs/workbench/projects/ai_interface/docs/progress.md`

## 验收要点

- `README.md` 改为 Mission-first 叙事，并明确 Mission Center / Backstage / Operator 三条入口。
- `docs/README.md` 提供 Mission Control 链接索引。
- `docs/workbench/README.md` 补齐 PR4-PR10 模块索引。
- Mission Center 仍是默认 normal-user path。
- Operator Backstage 仍是 advanced path。
- 可见 TODO 文案已清理。
- 空态 / 加载态 / 异常态文案能解释 approve / execute 分离与运行时回链。
- 存量 `/api/agents`、`/api/skills`、`/api/agent-runs` 回归不受影响。
- API/UI 不泄露 secret values。

## 待决

- 是否需要后续为 Mission Center / Operator 增加浏览器级自动化 smoke，而不只依赖 build + API regression。
- 是否需要把更多 normal-user 文案统一从 “Backstage” 细分为 “Execution Backstage” 与 “Operator Backstage”。

## Delivery / Checks / Handoff

### Delivery

- Mission-first README、docs 索引与 workbench 模块说明已更新。
- 前端补齐 Mission Center / Backstage / Operator 入口，并优化加载/空态文案。
- 额外回归测试覆盖 approve 后不自动 execute，直到显式调用 `/execute` 才创建 runtime runs。
- 可见 TODO 文案已从 mock UI 清理。

### Checks

- `corepack pnpm --filter @workspace/api-server run test`
- `corepack pnpm --filter @workspace/api-server run typecheck`
- `PORT=8080 BASE_PATH=/ VITE_DEFAULT_PREVIEW=ai-os/AgentFirstInterface corepack pnpm --dir artifacts/mockup-sandbox run build`
- `git diff --check`

### Handoff

- PR11 作为这一轮 Mission Control 改造的收尾 PR，重点是 polish、回归保护与文档对齐，而不是再扩展新能力面。
- 若后续继续演进，优先补浏览器自动化 smoke 与更细的 normal-user / operator 文案边界。
