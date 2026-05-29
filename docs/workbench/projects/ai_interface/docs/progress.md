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
- `README.md` 的 Workbench 入口链接

## 验收要点

- 已明确 normal / operator / backstage 三条路径。
- 已明确 workbench docs 不是 DB / runtime 事实源。
- 已定义 boss-agent、research-agent、builder-agent、qa-agent 的职责边界。
- 已在 team registry 中给出至少 `boss-agent`, `research`, `builder`, `qa`, `ops` 映射。
- 已强调 normal user 不看 provider/model 细节。
- 本 PR 不引入 API、DB、UI runtime 改动。

## 待决

- operator path 后续是否需要单独的角色文档或值守手册。
- mission 在产品内成为 first-class object 后，Workbench 文档层如何只保留索引而不复制状态。
- 后续是否补充跨 PR 的节奏规范（如 intake / handoff / sign-off 模板）。
