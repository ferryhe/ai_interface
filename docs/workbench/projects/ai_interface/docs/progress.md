# PR1 Progress - Workbench Governance

## 目标

在 `ai_interface` 仓库建立 Workbench Governance 的最小文档层，形成：

- 清晰的 mission control 产品边界
- 可协作的角色定义
- 项目级事实源入口
- PR1 的验收与待决记录

## 本 PR 范围

- `docs/workbench/README.md`
- `docs/workbench/README-is-not-database.md`
- `docs/workbench/projects/ai_interface/STATE.md`
- `docs/workbench/projects/ai_interface/docs/progress.md`
- `docs/workbench/teams/team-registry.yaml`
- `docs/workbench/roles/*.md`
- `docs/plans/2026-05-29-boss-agent-mission-control-multi-pr-plan.md` 的 PR1 交付模板 section
- `README.md` 的 Workbench 入口链接

## 验收要点

- 已明确 normal / operator / backstage 三条路径。
- 已明确 workbench docs 不是 DB / runtime 事实源。
- 已定义 boss-agent、research-agent、builder-agent、qa-agent 的职责边界。
- 已在 team registry 中给出至少 `boss-agent`、`research-agent`、`builder-agent`、`qa-agent` 与 `ops` 映射。
- 已强调 normal user 不看 provider/model 细节。
- 本 PR 不引入 API、DB、UI runtime 改动。
- 已为 PR1 补充 Delivery / Checks / Handoff 交付说明 section。

## 待决

- operator path 后续是否需要单独的角色文档或值守手册。
- mission 在产品内成为 first-class object 后，Workbench 文档层如何只保留索引而不复制状态。

## Delivery / Checks / Handoff

### Delivery

- Workbench Governance docs-only 最小闭环已落地，覆盖 README、STATE、progress、team registry 与四个核心角色文档。
- `team-registry.yaml` 的 roleId 已与角色文件名保持一致：`boss-agent`、`research-agent`、`builder-agent`、`qa-agent`。
- `README.md` 保持为入口链接，不扩展为状态面板。

### Checks

- 必跑验收：`git diff --check`。
- docs-only 范围检查：不引入 API、DB、UI runtime 改动。

### Handoff

- 后续 PR 延续同一节奏：每个 PR 文档记录交付内容、验收命令与交接待决。
- 若 operator path 扩展为独立值守面，需要新增对应角色文档或值守手册。
- 若 mission 成为 first-class object，Workbench 继续只保留索引与协作边界，不复制运行时状态。
