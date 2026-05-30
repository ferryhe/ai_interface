# Workbench Governance

Workbench 是 `ai_interface` 的 mission control 文档层：只定义协作边界、事实源与交接口径，不替代 runtime、API、DB 或 UI。

## 产品边界

- Foreground / normal path：面向普通用户的 Agent 对话与任务推进。
- Operator path：面向值守/运营/交付人员的执行、观测、回放与处理。
- Backstage path：面向研发/治理/质量的配置、诊断、验收与协作记录。
- Workbench docs 只描述这些路径如何协作，不直接保存数据库事实，不承诺替代产品内状态。

## Mission control 约束

- `ai_interface` 负责编排 Agent、Skill、Run、Artifact 的前台与工作台协作体验。
- mission 的运行时真实状态仍以 API、DB、日志、artifact 为准。
- **approve（批准）与 execute（执行）解耦：**`approve` 只表示用户已接受计划/动作意图，不代表该动作已完成执行；实际执行仍以 runtime / run / artifact / event 状态为准。
- Workbench 文档层只保留“人需要共同理解与持续维护的最小事实”。
- **work in progress is intentional**：允许文档存在进行中、待决、未闭环条目，但必须明确谁负责、下一步是什么、什么不在这里记录。

## 三条路径

### 1. normal

给普通用户看的路径：

- 只暴露任务目标、进度、结果、需要确认的动作。
- 不要求用户理解 provider、model、内部角色切分。
- normal user 不以 provider/model 作为主要交互对象。

### 2. operator

给运营/值守/执行人员看的路径：

- 处理 run 观察、异常升级、人工确认、回放与交接。
- 关注任务是否可继续、是否需要介入，而不是底层实现细节。

### 3. backstage

给研发/治理/QA/负责人看的路径：

- 维护角色职责、事实源、项目状态、验收标准。
- 允许记录待决、风险、边界与非目标。
- 这里只是协作文档层，不是数据库。

## 角色职责入口

- 团队与角色映射：`docs/workbench/teams/team-registry.yaml`
- 项目事实源：`docs/workbench/projects/ai_interface/STATE.md`
- 当前 PR 进度：`docs/workbench/projects/ai_interface/docs/progress.md`
- 角色说明：`docs/workbench/roles/`
- 边界说明：`docs/workbench/README-is-not-database.md`

## 使用方式

1. 先看 `STATE.md` 确认当前文档层承认的事实。
2. 再看 `progress.md` 确认当前 PR 目标、验收与待决。
3. 按角色文档执行协作，不把运行时瞬时状态写成长期事实。
4. 任何需要数据库/接口/日志才能确认的内容，都回到系统事实源验证。

## PR4-PR10 新增模块索引

- **PR4 Safe Agent Creation / Import**
  - `POST /api/agent-manifests`
  - custom-only `agents/custom/*` 写入保护
  - VS Code `.agent.md` import / export 互操作面
- **PR5 Mission Center / Plan Review**
  - Mission intake、Plan Review、approve / execute 分离入口
  - Mission Center 成为 normal-user 默认入口
- **PR6 Agent interop export**
  - `GET /api/agents/:agentId/export/vscode-agent`
  - `GET /api/agents/:agentId/export/mcp-tool`
- **PR7 Mission persistence foundation**
  - mission / revision 持久化、revision 冲突保护、board projection 基础能力
- **PR8 Operator Backstage read-only**
  - Operator manifest viewer
  - Workbench docs viewer
  - redacted UI-only governance inspection
- **PR9 Operator manifest mutation guards**
  - `POST /api/skill-manifests`
  - guarded custom manifest mutation
  - built-in / community / path traversal 保护
- **PR10 Knowledge Builder mission demo**
  - `docs/contracts/fixtures/knowledge-builder-mission.json`
  - `docs/demos/knowledge-builder-mission.md`
  - Knowledge Builder mission walkthrough / smoke reference

这些模块共同构成当前的 Mission Control 体验：Mission Center 面向普通用户，Backstage 面向执行观测，Operator 面向高级治理与受保护修改。
