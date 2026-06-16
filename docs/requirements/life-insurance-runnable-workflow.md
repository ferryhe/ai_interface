# Life Insurance Runnable Workflow Requirements

中文见下半部分。

## English

## Current State

The repository currently has four life-insurance custom agent templates:

- `pricing_actuary`
- `life_uw_analyst`
- `claims_reviewer`
- `compliance_auditor`

They are useful as role and domain templates, but they are not yet complete runnable workflow configurations. The correct production model is:

```text
Agent + Skill/Tool + Workflow + Approval + Data Contract
```

The agent defines responsibility boundaries and decision style. The skill/tool performs concrete work. The workflow orders steps and handoffs. Approval and data contracts make the process auditable.

## Requirement 1: Runnable Insurance Skills

Create explicit insurance skills/tools instead of relying on agent text alone.

Candidate skills:

- `insurance_pricing_assumption_review`
  - Inputs: product type, insured cohort, mortality/morbidity assumption references, expense assumptions, target margin.
  - Outputs: assumption matrix, scenario comparison, pricing adequacy note.
  - Approval: required for production-rate conclusions.

- `insurance_underwriting_case_review`
  - Inputs: applicant profile, disclosed conditions, medical evidence checklist, policy amount.
  - Outputs: risk assessment, decision recommendation, extra premium/exclusion suggestion.
  - Approval: required before final underwriting decision.

- `insurance_claims_review`
  - Inputs: policy status, claim type, proof documents, beneficiary records.
  - Outputs: coverage check, payable amount calculation, fraud-risk flags.
  - Approval: required before claim denial or payment instruction.

- `insurance_compliance_audit`
  - Inputs: product/process artifact, regulation references, audit scope.
  - Outputs: compliance gap matrix, severity, remediation owner, deadline.
  - Approval: required for regulatory or customer-impacting findings.

Each skill must have:

- `skill.yaml`
- input schema
- output schema
- adapter definition
- readiness check
- fixture payload
- unit/integration tests

## Requirement 2: Workflow Definitions

Create workflow definitions that bind the agent and skills together.

Example underwriting workflow:

```text
intake -> evidence_check -> risk_classification -> recommendation -> human_approval -> final_summary
```

Example pricing workflow:

```text
source_assumptions -> scenario_model -> adequacy_check -> sensitivity_matrix -> compliance_review -> approval_packet
```

Each workflow must document:

- step IDs
- dependencies
- required skill
- approval gate
- expected artifact
- failure behavior
- audit fields

## Requirement 3: Data Contracts

The workflow cannot rely on free-form text only.

Minimum contracts:

- Pricing assumption contract
- Underwriting case contract
- Claim evidence contract
- Compliance finding contract
- Approval decision contract

Each contract should be versioned and referenced from the corresponding skill output.

## Requirement 4: Hot Reload Custom Manifests

During E2E, `POST /api/agent-manifests` successfully wrote:

```text
agents/custom/e2e_life_insurance_builder/agent.yaml
```

But the running API process did not immediately expose it from:

```text
GET /api/agents
POST /api/agent-runs
```

It only became available after restarting the API server.

Acceptance criteria:

- After `POST /api/agent-manifests -> 201`, `GET /api/agents?agentId=<id>` or equivalent listing exposes the new custom agent without restart.
- `POST /api/agent-runs` accepts the new `agentId` without restart.
- Tests cover create, overwrite, invalid manifest rollback, and protected built-in/community IDs.

## Requirement 5: Mission Execution Integration

`POST /api/missions/:missionId/execute` currently marks a mission as executing but reports:

```text
executionReadiness.status=stubbed
```

Acceptance criteria:

- Executing an approved mission creates an Agent runtime thread and pipeline run.
- Mission execution links persist `missionId`, `revisionId`, `threadId`, and `pipelineRunId`.
- Mission board shows live runtime status from the linked pipeline.

## Requirement 6: Frontstage Agent Selection

Portal submission currently exercises the global runtime configuration. It does not let an end user choose a newly configured custom life-insurance agent.

Acceptance criteria:

- Published Portal can be scoped to a specific agent or published agent version.
- Portal run request includes the selected/published `agentId`.
- Unauthorized portal tokens cannot access unpublished agents.

## E2E Acceptance

A final life-insurance E2E should pass this sequence:

1. Operator creates or updates an insurance agent.
2. Operator binds at least one insurance skill/tool.
3. Operator assigns a workflow with approvals and data contracts.
4. Operator publishes the agent to Portal.
5. Frontstage user submits a task.
6. API creates an Agent run for the published insurance agent.
7. Runtime creates module/skill runs with auditable artifacts.
8. Approval-required steps remain pending until approval.
9. The final result is visible in Portal and Backstage.

## 中文

## 当前状态

仓库里现在有四个寿险 custom agent 模板：

- `pricing_actuary`
- `life_uw_analyst`
- `claims_reviewer`
- `compliance_auditor`

它们适合作为角色和领域模板，但还不是完整可运行的 workflow 配置。正确的生产模型应当是：

```text
Agent + Skill/Tool + Workflow + Approval + Data Contract
```

Agent 定义职责边界和决策风格；Skill/Tool 执行具体动作；Workflow 编排步骤和交接；Approval 和 Data Contract 负责可审计与治理。

## 需求 1：可运行的保险 Skill/Tool

不能只依靠 agent 文案，需要显式创建保险业务 skill/tool。

候选 skill：

- `insurance_pricing_assumption_review`
  - 输入：产品类型、被保险人群、死亡率/发病率假设来源、费用假设、目标利润。
  - 输出：假设矩阵、情景对比、费率充足性说明。
  - 审批：生产费率结论必须审批。

- `insurance_underwriting_case_review`
  - 输入：投保人信息、健康告知、医学材料清单、保额。
  - 输出：风险评估、承保建议、加费/除外建议。
  - 审批：最终核保结论必须审批。

- `insurance_claims_review`
  - 输入：保单状态、理赔类型、证明材料、受益人资料。
  - 输出：责任范围检查、给付计算、欺诈风险提示。
  - 审批：拒赔或给付指令必须审批。

- `insurance_compliance_audit`
  - 输入：产品/流程材料、监管规则、审计范围。
  - 输出：合规差距矩阵、严重性、修复责任人、截止时间。
  - 审批：监管或客户影响事项必须审批。

每个 skill 至少需要：

- `skill.yaml`
- 输入 schema
- 输出 schema
- adapter 定义
- readiness check
- fixture payload
- 单元/集成测试

## 需求 2：Workflow 定义

需要创建 workflow，把 agent 和 skill 绑定起来。

核保 workflow 示例：

```text
intake -> evidence_check -> risk_classification -> recommendation -> human_approval -> final_summary
```

定价 workflow 示例：

```text
source_assumptions -> scenario_model -> adequacy_check -> sensitivity_matrix -> compliance_review -> approval_packet
```

每个 workflow 需要明确：

- step ID
- 依赖关系
- 使用的 skill
- 审批节点
- 预期产物
- 失败策略
- 审计字段

## 需求 3：Data Contract

workflow 不能只依赖自由文本。

最小 contract：

- 定价假设 contract
- 核保案件 contract
- 理赔证据 contract
- 合规发现 contract
- 审批决策 contract

每个 contract 应该有版本，并被对应 skill output 引用。

## 需求 4：Custom Manifest 热更新

E2E 中 `POST /api/agent-manifests` 已成功写入：

```text
agents/custom/e2e_life_insurance_builder/agent.yaml
```

但当前 API 进程不会立刻在下面接口暴露它：

```text
GET /api/agents
POST /api/agent-runs
```

重启 API 后才可见。

验收标准：

- `POST /api/agent-manifests -> 201` 后，无需重启即可通过 listing 看到新 custom agent。
- `POST /api/agent-runs` 无需重启即可接受新 `agentId`。
- 测试覆盖 create、overwrite、invalid manifest rollback，以及 protected built-in/community ID。

## 需求 5：Mission Execution 接入真实 Runtime

`POST /api/missions/:missionId/execute` 当前只是把 mission 标记为 executing，并返回：

```text
executionReadiness.status=stubbed
```

验收标准：

- 执行已批准 mission 时创建 Agent runtime thread 和 pipeline run。
- Mission execution link 持久化 `missionId`、`revisionId`、`threadId`、`pipelineRunId`。
- Mission board 从关联 pipeline 展示真实运行状态。

## 需求 6：前台 Agent 选择/发布绑定

当前 Portal 提交任务使用的是全局 runtime config，不能让终端用户选择刚配置的寿险 custom agent。

验收标准：

- Published Portal 可以绑定到某个 agent 或发布版本。
- Portal run request 包含被发布的 `agentId`。
- 未授权 token 不能访问未发布 agent。

## E2E 验收流程

最终寿险 E2E 应通过以下流程：

1. 后台创建或更新保险 agent。
2. 后台绑定至少一个保险 skill/tool。
3. 后台分配带审批和 data contract 的 workflow。
4. 后台发布 agent 到 Portal。
5. 前台用户提交任务。
6. API 为被发布的保险 agent 创建 Agent run。
7. Runtime 创建 module/skill runs，并产生可审计产物。
8. 需要审批的步骤保持 pending，直到人工审批。
9. 最终结果在 Portal 和 Backstage 都可见。
