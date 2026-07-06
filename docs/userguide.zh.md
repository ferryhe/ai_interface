# ai_interface 用户指南

English version: [`userguide.md`](userguide.md)

本文面向两类使用者：

- **前台用户**：在 Mission Center / Mission Portal 中提交任务、审核计划、确认审批、查看结果；token/public 用户进入同一个 Mission Portal 的 token 模式。
- **后台/运营用户**：在唯一 Backstage 工作区中检查 Runs、Artifacts、Agents、Skills、Teams、Approvals、Settings、发布控制和 manifest。后台操作必须保留可追溯证据，因为系统事实源来自 runtime、API、数据库和日志，而不是界面文字。

## 1. 本地启动

在 PowerShell 中启动 API。API server 要求显式设置 `PORT`；因为当前 `@workspace/api-server` 的 `dev` script 使用 Bash 风格的 `export`，PowerShell 下建议直接运行 build + start：

```powershell
$env:PORT="3001"
$env:NODE_ENV="development"
$env:DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DATABASE"
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run start
```

如果只是做本地 E2E 冒烟测试、暂时没有 Postgres，可以使用内存仓库模式。这个模式不持久化数据，适合验证 HTTP/API/UI 链路：

```powershell
$env:PORT="3001"
$env:NODE_ENV="development"
$env:AI_INTERFACE_REPOSITORY_MODE="memory"
$env:AI_INTERFACE_MANIFEST_WRITE_MODE="custom"
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run start
```

如果使用 Git Bash / WSL / Bash，可以运行：

```bash
PORT=3001 corepack pnpm --filter @workspace/api-server run dev
```

在另一个 PowerShell 中启动前端预览：

```powershell
$env:PORT="8080"
$env:BASE_PATH="/"
$env:VITE_DEFAULT_PREVIEW="ai-os/AgentFirstInterface"
$env:API_PROXY_TARGET="http://127.0.0.1:3001"
corepack pnpm --dir artifacts/mockup-sandbox run dev
```

打开前端：

```text
http://127.0.0.1:8080/preview/ai-os/AgentFirstInterface
```

如果当前开发服务器已经使用其他端口，以终端输出的 Vite URL 为准。

下文 API 示例默认 API 端口为 `3001`。如果你启动 API 时使用其他 `$env:PORT` / `PORT`，所有 API URL 必须同步改成同一个端口。

## 2. 前台操作：Mission Center

Mission Center 是普通用户的默认路径。前台用户不需要理解底层 manifest，只需要用业务语言描述目标，然后审阅系统生成的计划。

### 2.1 提交任务

1. 打开 AgentFirst 页面。
2. 保持在 Mission Center。
3. 在任务输入框中描述目标，例如：

```text
把我批准的网页和文档资料做成一个可问答的知识库 Agent。
```

4. 提交任务。

预期结果：

- 页面生成 Mission Plan。
- 计划展示角色、步骤、依赖、风险和需要人工确认的动作。
- 如果使用 `knowledge_builder`，计划通常会涉及 `web_listening`、`doc_to_md`、`md_to_rag`、`rag_to_agent`。

### 2.2 审核计划

1. 查看计划摘要，确认目标是否被正确理解。
2. 查看步骤顺序和依赖关系。
3. 特别检查需要审批的动作：
   - 网络访问，例如抓取网页资料。
   - 数据库或检索库写入，例如构建 RAG corpus。
   - 关键业务结论，例如核保、理赔、合规判断。
4. 如果计划不对，选择修改/重新生成计划。
5. 如果计划正确，确认计划。

注意：确认计划不等于开始执行。系统故意把 `approve` 和 `execute` 分开，防止用户误触发高风险动作。

### 2.3 执行任务

1. 在计划确认后选择执行。
2. 查看 Execution Board。
3. 对等待审批的步骤逐项处理。
4. 执行过程中查看每一步状态：
   - `pending`
   - `running`
   - `approval_required`
   - `succeeded`
   - `failed`
   - `blocked`

预期结果：

- 每个运行步骤生成可检查的事件和产物。
- QA 或审核步骤能说明是否满足交付要求。
- 最终产物可以回溯到输入资料和中间处理结果。

### 2.4 查看前台交付

前台用户主要看三类信息：

| 信息 | 用途 |
|---|---|
| Chat / Agent 回复 | 理解当前任务状态和下一步动作 |
| Steps / Execution Board | 看到每个步骤是否完成、卡在哪里 |
| Data / Sources / Result | 查看资料、来源、结果和可追溯证据 |

如果任务发布到 Portal，可从 AgentFirst 页面点击 **View Portal**，或使用轻量 Mission Portal token URL 直接打开：

```text
/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Portal token 模式让终端用户停留在 Mission Portal 查看进度、提交反馈、处理批准或补充资料；不得暴露 Backstage、manifest、provider/model 设置或 publish token。

## 3. 后台操作：Backstage

后台用于治理、排错和上线前确认。每一步都要回答两个问题：

- 当前配置是否真实可运行？
- 运行结果是否可审计、可复现、可解释？

### 3.1 进入 Backstage

1. 打开 AgentFirst 页面。
2. 点击 **Backstage**。
3. 查看 Runs、Artifacts、Agents、Skills、Teams、Approvals、Settings 等工作区。

为什么要这样做：

- Mission Center 展示的是业务视图；Backstage 展示的是事实源视图。
- Agent 是否绑定正确 skill、skill 是否 ready、运行是否有事件和产物，都需要在 Backstage 里确认。

验收点：

- Runs 能显示 runtime I/O、事件、审批状态、活跃 skill、raw JSON 和错误。
- Artifacts 能按 pipeline / module run 分组显示中间产物和最终产物。
- Agents 能显示 `runtimeStatus`、`teamId`、九段式定义和绑定 skill。
- Skills 能显示执行方式、必需环境变量、权限、readiness、事件、产物和按需 Skill UI。
- Teams 与 Approvals 能展示归属关系和跨 indexed runs 的阻断项。
- Settings 承载 provider/model 配置、发布状态/token 与受保护 manifest 治理。

### 3.2 检查 Agent 配置

操作步骤：

1. 在 Backstage 打开 Agents。
2. 选择目标 Agent，例如 `knowledge_builder`。
3. 检查：
   - `runtimeStatus` 是否为 `runnable`。
   - `teamId` 是否正确。
   - 绑定 skill 是否符合任务目标。
   - `identity`、`criticalRules`、`deliverables`、`workflow`、`communicationStyle`、`successMetrics` 是否完整。
   - 权限是否声明了审批、网络、数据库写入等高风险能力。

为什么要这样做：

- `runtimeStatus: runnable` 表示该 Agent 可执行；`template` 只表示模板，不应被当成线上运行 Agent。
- `teamId` 用于团队过滤和治理归属。
- 九段式定义是 Agent 的业务边界，能防止“只有 prompt 没有规则”的不可控行为。
- 权限声明决定哪些步骤必须进入审批。

### 3.3 检查 Skill 就绪状态

操作步骤：

1. 在 Backstage 打开 Skills。
2. 找到目标 skill，例如 `web_listening` 或 `doc_to_md`。
3. 检查：
   - `execution.kind`
   - `adapterId`
   - `requiredEnv`
   - `optionalEnv`
   - `readinessHint`
   - `permissions`
   - `inputSchema` 和 `outputSchema`

为什么要这样做：

- Skill 是实际执行单元。Agent 只是编排和角色定义，真正执行要靠 Skill adapter。
- 必需环境变量缺失时，运行时会跳过或进入不可用状态，不能假装已经执行成功。
- `inputSchema` / `outputSchema` 定义了上下游契约，能防止不同模块之间传错数据。
- `permissions` 明确哪些动作需要人工批准。

### 3.4 检查运行记录

操作步骤：

1. 在 Backstage 打开 Runs。
2. 选择当前 mission 或 pipeline run。
3. 检查每个 module run：
   - 输入 JSON
   - 输出 JSON
   - runtime events
   - tool interaction / feedback / resume 状态
   - skipped / failed 的原因
4. 打开对应 Artifacts。

为什么要这样做：

- 运行记录是审计依据。
- 如果前台显示“完成”，后台必须能看到完成所依据的事件、产物和状态。
- 如果步骤失败或跳过，后台需要定位是权限、环境变量、外部服务还是输入数据问题。

### 3.5 在 Settings 中处理治理

操作步骤：

1. 打开 **Backstage → Settings**。
2. 查看 provider/model 配置、发布状态/token、manifest 治理面板。
3. 对自定义 manifest 做只读审核后再进行受保护变更。
4. 只有在本地受保护模式允许时，才提交自定义 manifest 变更。
5. 放弃本地草稿时使用显式 discard/reload 控件；普通切换标签页不得静默清空草稿。
6. 修改 manifest 或 settings 后重新运行校验和相关测试。

为什么要这样做：

- Settings 是 Backstage 内的高级治理区，不是第二个后台入口。
- 内置和社区 manifest 默认应只读，防止把运行时事实源改乱。
- 自定义 manifest、provider 或发布设置变更可能改变权限、工具、数据流、token 和审批要求，必须通过校验后才能进入运行路径。

### 3.6 从 Settings 发布 Portal

操作步骤：

1. 在 **Backstage → Settings** 检查 Portal 设置。
2. 确认 publish status。
3. 设置或轮换 Portal token。
4. 使用轻量 Mission Portal token URL（`/preview/ai-os/AgentPortalInterface?token=...`）打开终端用户视图。
5. 在移动端和桌面端都测试语言切换、步骤、数据、来源和结果。

为什么要这样做：

- Portal 是终端用户入口，必须和后台治理隔离。
- token 只用于访问发布后的 Portal，不应暴露后台管理能力。
- 移动端入口和语言切换属于真实用户路径，必须在发布前确认。

## 4. 简单 Skill 定义

当前项目内置了两个最容易理解的资料处理 Skill：收集资料和转换资料。

### 4.1 收集资料：`web_listening`

文件：

```text
skills/builtin/web_listening/skill.yaml
```

用途：

- 监控网页。
- 创建快照。
- 提取文本。
- 发现页面变化。

关键定义：

| 字段 | 当前值 | 含义 |
|---|---|---|
| `skillId` | `web_listening` | Skill ID |
| `moduleId` | `web_listening` | Runtime module ID |
| `category` | `source` | 来源采集类 Skill |
| `execution.kind` | `cli` | 通过 CLI adapter 执行 |
| `adapterId` | `web_listening.cli.v1` | 工具适配器 |
| `requiredEnv` | `WEB_LISTENING_CLI_PATH` | 必须配置 CLI 路径 |
| `optionalEnv` | `WEB_LISTENING_WORKDIR`, `WEB_LISTENING_API_BASE_URL` | 可选工作目录/API 地址 |
| `permissions.canUseNetwork` | `true` | 需要网络能力 |
| `permissions.approvalRequired` | `true` | 需要审批 |

输入：

- `siteUrl`
- `monitoringGoal`
- `stage`

输出：

- `manifest`
- `snapshots`
- `events`

产物类型：

- `web_snapshot`
- `extracted_text`
- `change_event`

使用时机：

- 用户要从网页、公告、文档站点或监管网站收集资料。
- 任务涉及网络访问，必须先审批。

### 4.2 转换资料：`doc_to_md`

文件：

```text
skills/builtin/doc_to_md/skill.yaml
```

用途：

- 把源文档转换为 Markdown。
- 保留转换警告。
- 提取图片、表格或其他 assets。
- 生成可追溯的 trace。

关键定义：

| 字段 | 当前值 | 含义 |
|---|---|---|
| `skillId` | `doc_to_md` | Skill ID |
| `moduleId` | `doc_to_md` | Runtime module ID |
| `category` | `transform` | 转换类 Skill |
| `execution.kind` | `http` | 通过 HTTP adapter 执行 |
| `adapterId` | `doc_to_md.http.v1` | 工具适配器 |
| `requiredEnv` | `DOC_TO_MD_API_BASE_URL` | 必须配置转换服务地址 |
| `optionalEnv` | `DOC_TO_MD_API_TOKEN` | 可选 API token |
| `ui.mode` | `renderer` | 前台可用 renderer 展示 Markdown |

输入：

- `sourceArtifactIds`
- `engine`
- `includeAssets`

输出：

- `markdown`
- `quality`
- `trace`
- `assets`

产物类型：

- `markdown_document`
- `conversion_warning`
- `document_asset`

使用时机：

- 用户已有 PDF、Word、HTML、截图或其他资料，需要转成可索引、可审阅、可交给 RAG 的 Markdown。
- 上游通常来自 `web_listening` 或人工上传资料。

## 5. Demo：Knowledge Builder

Demo 文档：

```text
docs/demos/knowledge-builder-mission.md
```

Fixture：

```text
docs/contracts/fixtures/knowledge-builder-mission.json
```

典型目标：

```text
把我批准的网页和文档资料做成一个可问答的知识库 Agent。
```

典型流程：

| 阶段 | Skill | 作用 | 是否高风险 |
|---|---|---|---|
| 收集网页资料 | `web_listening` | 抓取批准的网页和变更内容 | 是，涉及网络 |
| 转换资料 | `doc_to_md` | 把文档转成 Markdown | 视输入资料而定 |
| 建知识库 | `md_to_rag` | 写入可检索 corpus | 是，涉及 DB / retrieval 写入 |
| 生成 Agent | `rag_to_agent` | 生成知识库问答 Agent 配置 | 是，影响交付 |
| QA 复核 | mission QA | 检查产物完整性和来源追溯 | 是，影响上线判断 |

前台用户看到的是业务目标、计划和结果。后台用户需要确认每一步都有输入、输出、事件和产物。

## 6. 寿险行业 Agent 配置

Demo 文档：

```text
docs/demos/life-insurance-agents.md
```

寿险案例介绍：

```text
docs/demos/life-insurance-case.md
```

Agent 文件：

```text
agents/custom/pricing_actuary/agent.yaml
agents/custom/life_uw_analyst/agent.yaml
agents/custom/claims_reviewer/agent.yaml
agents/custom/compliance_auditor/agent.yaml
```

这些 Agent 当前都是：

```yaml
source: custom
runtimeStatus: template
teamId: insurance
skills: []
```

含义：

- 它们是行业模板，不是已接入外部系统的可运行 Agent。
- `teamId: insurance` 使它们可通过 `GET /api/agents?teamId=insurance` 过滤。
- `runtimeStatus: template` 表示不能直接当成生产运行 Agent。
- `skills: []` 表示还没有绑定真实执行工具。

点评：你的理解是对的。寿险公司案例不能只配置 Agent。Agent 定义“谁来做、按什么规则做、交付什么”，但真实可运行配置还需要：

- **Agent**：角色、规则、交付物、沟通方式和成功指标。
- **Skill/Tool**：保单查询、资料转换、精算模型、核保规则、理赔证据核验、合规规则库等实际执行能力。
- **Workflow**：先做什么、后做什么、哪些步骤依赖上游产物。
- **Approval**：哪些结论必须人工签核，例如承保、理赔责任、监管报备和重大模型假设。
- **Data contract**：输入字段、输出字段、产物类型、审计事件和错误处理。

因此当前四个寿险 Agent 是“行业模板层”；要进入执行层，需要再补对应 Skill manifest 和 mission/workflow 设计。

### 6.1 精算定价师：`pricing_actuary`

角色：

- 寿险产品费率厘定。
- 利润测试。
- 准备金假设。
- 监管报备技术说明。

关键规则：

- 费率充足性不可妥协。
- 所有假设必须有数据来源和复核记录。
- 每次定价必须有基准、乐观、悲观三情景。
- 报备材料必须可追溯、可复现。
- 新模型或重大假设变更必须经过回测和压力测试。

主要交付：

- 死亡率与发病率假设模型。
- 利润测试报告。
- 费率充足性评估。
- 竞争性费率对比表。
- 监管报备技术说明。
- 敏感性分析矩阵。

### 6.2 核保决策师：`life_uw_analyst`

角色：

- 寿险/健康险核保风险评估。
- 承保建议。
- 附加条件。
- 再保需求评估。

关键规则：

- 核保结论必须基于资料、医学证据、财务证据或规则。
- 边界案例必须标注不确定性。
- 必须识别逆向选择。
- 拒保或加费必须说明风险理由和替代方案。
- 承保、加费、延期、拒保必须保留人工签核。

主要交付：

- 风险评估报告。
- 承保建议书。
- 费率调整建议。
- 再保需求评估。
- 核保规则优化建议。

### 6.3 理赔审核师：`claims_reviewer`

角色：

- 寿险、重疾、伤残、满期等理赔审核。
- 给付计算。
- 受益人资格验证。
- 欺诈风险评估。

关键规则：

- 先核实保单状态、等待期、责任范围、除外责任和申请时效。
- 身故证明、医学证明、事故证明和受益人身份验证是第一道控制点。
- 短期出险、高额赔付、资料矛盾或疑似欺诈案件必须多源交叉验证。
- 给付计算必须逐项列明。
- 拒赔、部分给付或进一步调查必须说明合同依据和后续路径。

主要交付：

- 理赔审核报告。
- 给付计算明细。
- 受益人资格验证。
- 欺诈风险评估。
- 案件处理建议。

### 6.4 合规审计师：`compliance_auditor`

角色：

- 寿险经营合规审计。
- 产品、数据、反洗钱、偿付能力、AI 辅助决策治理。

关键规则：

- 监管要求是底线。
- 新规或重大监管口径变化后 24 小时内完成初步影响评估。
- 每个合规差距必须包含风险等级、责任团队、修复时间线和证据要求。
- 关键业务结论必须保留人工签核。
- 数据处理必须遵守最小必要、授权、留痕和安全评估要求。

主要交付：

- 监管变化影响分析。
- 合规差距评估报告。
- 政策与流程更新建议。
- 审计准备材料。
- 合规培训方案。
- 风险仪表盘。

### 6.5 如何把寿险模板变成可运行 Agent

后台操作步骤：

1. 复制模板或在 `agents/custom/<agent_id>/agent.yaml` 修改。
2. 保留九段式定义，不删除 critical rules。
3. 绑定真实 Skill：

```yaml
skills:
  - skillId: doc_to_md
    required: true
```

4. 明确权限：

```yaml
permissions:
  approvalRequired: true
  canUseNetwork: false
  canWriteDatabase: false
```

5. 将 `runtimeStatus` 从 `template` 改为 `runnable`。
6. 运行 manifest 校验。
7. 在 Backstage 检查 Agent、Skill readiness 和权限。
8. 用 Mission Center 提交一条低风险测试任务。
9. 查看 Runs 和 Artifacts，确认每一步都有事件和产物。

为什么要这样做：

- 先绑定 Skill 再改 `runnable`，避免模板被误当成可执行 Agent。
- 保留 critical rules，避免行业模板失去专业和合规边界。
- 先低风险测试，避免真实业务数据直接进入未验证流程。

## 7. 常用 API 检查

查看所有 Agent：

```bash
curl http://127.0.0.1:3001/api/agents
```

查看寿险团队 Agent：

```bash
curl "http://127.0.0.1:3001/api/agents?teamId=insurance"
```

查看模板 Agent：

```bash
curl "http://127.0.0.1:3001/api/agents?runtimeStatus=template"
```

查看寿险模板 Agent：

```bash
curl "http://127.0.0.1:3001/api/agents?teamId=insurance&runtimeStatus=template"
```

提交 Knowledge Builder mission：

```bash
curl -X POST http://127.0.0.1:3001/api/missions \
  -H "Content-Type: application/json" \
  -d '{
    "message": "把我批准的网页和文档资料做成一个可问答的知识库 Agent。",
    "agentId": "knowledge_builder",
    "enabledSkillIds": ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
    "reviewMode": "draft_for_review"
  }'
```

## 8. 操作验收清单

前台验收：

- Mission Center 能提交任务。
- 计划能显示角色、步骤、审批和风险。
- 确认计划不会自动执行。
- 执行后能看到步骤状态和结果。
- Portal token 模式桌面和移动端都能通过 `/preview/ai-os/AgentPortalInterface?token=...` 进入，且不暴露 Backstage 控件。
- 中英文能切换。

后台验收：

- Agents 能显示 `runtimeStatus`、`teamId` 和九段式定义。
- Skills 能显示 adapter、required env、permissions 和 schema。
- Runs 能显示输入、输出、事件、审批和错误。
- Artifacts 能追溯来源。
- Settings 承载 provider/model 配置、发布控制和受保护 manifest 治理；自定义 manifest 只在受保护本地模式下变更。
- 寿险模板保持 `runtimeStatus: template`，只有绑定真实 skill 并完成测试后才能改成 `runnable`。
