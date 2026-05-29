# README: Workbench is not a database

Workbench 文档层用于协作，不用于替代系统事实源。

## 这不是数据库

以下内容**不应**以 Workbench 文档作为最终来源：

- mission 实时状态
- run / artifact 明细
- provider 实际配置值
- model 运行时选择
- DB-backed mission 的记录明细
- first-class mission 的正式运行时对象

## 这可以记录什么

- 角色边界
- 当前协作口径
- PR 目标与验收点
- 明确的待决项
- 人工约定的最小事实源入口

## 记录原则

- 能从 API / DB / 日志直接读到的内容，不重复抄成长期状态。
- 需要长期协作共识的边界，才写进 Workbench。
- 如果一条信息会很快失效，应改写成“去哪里查”。
