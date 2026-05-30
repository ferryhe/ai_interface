# ai_interface Workbench State

此文件是 `ai_interface` Workbench 文档层的当前事实源。

## 记录范围

这里只记录：

- Workbench 文档层认可的产品边界
- 当前协作路径与角色分工
- 文档层已经落地的最小治理结构

## 当前事实

- `ai_interface` 当前以 **Mission Control** 为产品叙事：Mission Center 是普通用户默认入口，Backstage 是执行/观测工作台，Operator 是高级治理入口。
- Mission Center 已落地 Mission intake、Plan Review、Execution Board 与 Approval Inbox，并保持 **approve（确认）与 execute（执行）分离**。
- `POST /api/missions/:missionId/approve` 只确认 revision 与 execution readiness；真实运行仍需显式调用 `POST /api/missions/:missionId/execute`。
- Existing API 回归目标保持不变：`/api/agents` 继续返回 manifests，`/api/skills` 继续返回 redacted readiness，`/api/agent-runs` 继续支持现有执行路径。
- Operator Backstage 已提供 agent/skill manifest 查看、`docs/workbench/*` 只读查看，以及受保护的 custom manifest mutation 入口。
- API/UI 继续以 redaction 保护 secret-like values、provider/MCP URL、token-like strings 与本地路径，不把这些值泄露给普通用户或 Operator 只读视图。
- Workbench 当前仍按三条路径组织：`normal` / `operator` / `backstage`；其中 `normal` 即 Mission Center 主路径。
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
