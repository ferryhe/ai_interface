# ai_interface Workbench State

此文件是 `ai_interface` Workbench 文档层的当前事实源。

## 记录范围

这里只记录：

- Workbench 文档层认可的产品边界
- 当前协作路径与角色分工
- 文档层已经落地的最小治理结构

## 当前事实

- `ai_interface` 的 Workbench Governance 在本 PR 先以 docs-only 方式落地。
- 本层不改 API、DB、UI runtime 行为。
- Workbench 当前按三条路径组织：`normal` / `operator` / `backstage`。
- normal path 面向普通用户，默认不暴露 provider/model 作为主要认知对象。
- 角色文档位于 `docs/workbench/roles/`。
- 团队与角色映射位于 `docs/workbench/teams/team-registry.yaml`。
- 当前 PR 进度记录位于 `docs/workbench/projects/ai_interface/docs/progress.md`。

## 不在此文件记录

以下内容不在本文件维护：

- **DB-backed mission** 的运行时记录
- **first-class mission** 的对象定义或生命周期状态
- 数据库中的真实进度、事件、artifact、审批流
- API 返回的实时 run/agent/skill 详情

需要这些信息时，应回到 API、DB、日志或运行时界面确认。
