# Life Insurance Company Agent Case / 寿险公司 Agent 案例

This document explains how the life-insurance templates should be interpreted and what is still needed to make them runnable.

本文说明当前寿险 Agent 模板的定位，以及要把它们变成可运行寿险业务方案还缺什么。

## English

### Current State

The repository currently includes four life-insurance Agent templates:

| Agent ID | Name | Role | Runtime status |
|---|---|---|---|
| `pricing_actuary` | Actuarial Pricing Analyst | Pricing, reserve assumptions, profit testing | `template` |
| `life_uw_analyst` | Underwriting Decision Analyst | Underwriting risk assessment and recommendations | `template` |
| `claims_reviewer` | Claims Review Specialist | Claims review, payout calculation, fraud risk | `template` |
| `compliance_auditor` | Insurance Compliance Auditor | Compliance audit, regulatory change, AI governance | `template` |

Files:

```text
agents/custom/pricing_actuary/agent.yaml
agents/custom/life_uw_analyst/agent.yaml
agents/custom/claims_reviewer/agent.yaml
agents/custom/compliance_auditor/agent.yaml
```

They all use:

```yaml
source: custom
runtimeStatus: template
teamId: insurance
skills: []
```

This means they are design templates. They define professional role boundaries, critical rules, deliverables, workflow expectations, communication style, and success metrics. They are not yet production execution Agents.

### Correct Configuration Model

A runnable insurance workflow should be configured as:

```text
Agent + Skills/Tools + Workflow + Approvals + Data Contracts
```

| Layer | Purpose | Example |
|---|---|---|
| Agent | Defines who acts, what rules apply, and what outputs are expected | `pricing_actuary`, `claims_reviewer` |
| Skill/Tool | Performs actual work against systems, files, models, or APIs | document conversion, policy lookup, pricing model execution |
| Workflow | Orders steps and defines dependencies/handoffs | collect evidence -> analyze -> review -> approve -> deliver |
| Approval | Keeps critical decisions under human control | underwriting decision, claims liability, regulatory filing |
| Data contract | Defines inputs, outputs, artifacts, events, and errors | policy fields, claim evidence, actuarial assumptions |

The current PR restores the Agent layer. The execution layer still needs insurance-specific skills or adapters before these templates should become `runtimeStatus: runnable`.

### Example: Actuarial Pricing Flow

Recommended runnable flow:

1. Convert product specs and actuarial source files with `doc_to_md`.
2. Collect market or regulatory references with a controlled source-collection skill.
3. Run a pricing or profit-testing skill, for example `actuarial_pricing_model`.
4. Generate sensitivity analysis and adequacy findings.
5. Route assumptions and pricing conclusion to human approval.
6. Produce an auditable filing-ready report.

Possible future skills:

| Skill | Purpose |
|---|---|
| `actuarial_assumption_loader` | Load mortality, morbidity, lapse, expense, and interest assumptions |
| `actuarial_pricing_model` | Run pricing/profit-test scenarios |
| `rate_competitiveness_compare` | Compare rates against benchmark products |
| `filing_pack_builder` | Build regulatory filing evidence packages |

### Example: Underwriting Flow

Recommended runnable flow:

1. Convert application and medical documents with `doc_to_md`.
2. Retrieve policy/product rules with a rules lookup skill.
3. Run medical, occupation, financial, and anti-selection checks.
4. Produce a recommendation: standard, rated, exclusion, postpone, decline, or reinsurer review.
5. Require human underwriter signoff before any final decision.

Possible future skills:

| Skill | Purpose |
|---|---|
| `underwriting_rules_lookup` | Retrieve underwriting guidelines and product rules |
| `medical_evidence_extract` | Extract structured medical evidence from documents |
| `anti_selection_screen` | Detect inconsistencies, short-term high coverage, and adverse selection indicators |
| `reinsurance_referral_pack` | Build reinsurer referral packages |

### Example: Claims Flow

Recommended runnable flow:

1. Convert claim forms, death certificates, medical records, and payment documents.
2. Check policy status, waiting periods, coverage, exclusions, and beneficiary identity.
3. Calculate benefit amounts.
4. Screen fraud indicators and evidence gaps.
5. Require human claims signoff for approve/partial approve/reject/investigate decisions.

Possible future skills:

| Skill | Purpose |
|---|---|
| `policy_coverage_lookup` | Retrieve coverage, exclusions, waiting periods, and policy status |
| `beneficiary_verify` | Verify beneficiary identity and payment shares |
| `claim_payment_calculator` | Calculate payable amount with formulas and deductions |
| `claims_fraud_screen` | Flag short-duration, high-value, inconsistent, or repeated claims |

### Example: Compliance Flow

Recommended runnable flow:

1. Collect regulatory updates and internal policies.
2. Convert policy/procedure documents to Markdown.
3. Map rules to products, processes, data flows, AI usage, and evidence requirements.
4. Produce risk-ranked gaps and remediation owners.
5. Track closure evidence and training requirements.

Possible future skills:

| Skill | Purpose |
|---|---|
| `regulatory_change_monitor` | Monitor regulatory updates and bulletins |
| `compliance_rule_mapper` | Map rules to business processes and systems |
| `audit_evidence_collector` | Build evidence checklists and retrieve artifacts |
| `remediation_tracker` | Track owners, deadlines, risk levels, and closure evidence |

### Recommended Next Step

Do not change these Agents to `runnable` until at least one real insurance skill is defined and tested for each workflow. A safe first implementation is:

1. Keep the four Agents as `template`.
2. Add one narrow insurance skill, such as `policy_coverage_lookup` or `actuarial_assumption_loader`.
3. Bind it to one copied Agent.
4. Define a small workflow with one approval gate.
5. Run a low-risk demo mission.
6. Inspect Backstage runs and artifacts before expanding scope.

## 中文

### 当前状态

当前仓库包含 4 个寿险 Agent 模板：

| Agent ID | 名称 | 角色 | 运行状态 |
|---|---|---|---|
| `pricing_actuary` | 精算定价师 | 费率厘定、准备金假设、利润测试 | `template` |
| `life_uw_analyst` | 核保决策师 | 核保风险评估和承保建议 | `template` |
| `claims_reviewer` | 理赔审核师 | 理赔审核、给付计算、欺诈风险 | `template` |
| `compliance_auditor` | 合规审计师 | 合规审计、监管变化、AI 治理 | `template` |

文件：

```text
agents/custom/pricing_actuary/agent.yaml
agents/custom/life_uw_analyst/agent.yaml
agents/custom/claims_reviewer/agent.yaml
agents/custom/compliance_auditor/agent.yaml
```

它们目前都是：

```yaml
source: custom
runtimeStatus: template
teamId: insurance
skills: []
```

这表示它们是设计模板。它们定义专业角色边界、关键规则、交付物、工作流预期、沟通风格和成功指标，但还不是生产可执行 Agent。

### 正确配置模型

寿险可运行方案应按下面的组合配置：

```text
Agent + Skill/Tool + Workflow + Approval + Data Contract
```

| 层级 | 作用 | 示例 |
|---|---|---|
| Agent | 定义谁来做、按什么规则做、交付什么 | `pricing_actuary`, `claims_reviewer` |
| Skill/Tool | 真实执行系统、文件、模型或 API 操作 | 文档转换、保单查询、定价模型执行 |
| Workflow | 定义步骤顺序、依赖和交接 | 收集证据 -> 分析 -> 复核 -> 审批 -> 交付 |
| Approval | 保留关键决策人工签核 | 承保结论、理赔责任、监管报备 |
| Data contract | 定义输入、输出、产物、事件和错误处理 | 保单字段、理赔证据、精算假设 |

当前 PR 恢复的是 Agent 层。要进入执行层，还需要定义寿险专用 Skill 或 adapter，然后才能把模板改成 `runtimeStatus: runnable`。

### 示例：精算定价流程

建议的可运行流程：

1. 用 `doc_to_md` 转换产品条款和精算资料。
2. 用受控资料收集 Skill 收集市场或监管参考。
3. 运行定价或利润测试 Skill，例如 `actuarial_pricing_model`。
4. 生成敏感性分析和费率充足性结论。
5. 将假设和定价结论送人工审批。
6. 输出可审计、可报备的技术说明。

可能新增的 Skill：

| Skill | 作用 |
|---|---|
| `actuarial_assumption_loader` | 加载死亡率、发病率、退保、费用和利率假设 |
| `actuarial_pricing_model` | 运行定价和利润测试场景 |
| `rate_competitiveness_compare` | 对比竞品和基准费率 |
| `filing_pack_builder` | 生成监管报备证据包 |

### 示例：核保流程

建议的可运行流程：

1. 用 `doc_to_md` 转换投保资料和医学资料。
2. 用规则查询 Skill 检索产品和核保规则。
3. 执行医学、职业、财务和逆向选择检查。
4. 生成标准、加费、除外、延期、拒保或再保建议。
5. 最终结论必须由人工核保签核。

可能新增的 Skill：

| Skill | 作用 |
|---|---|
| `underwriting_rules_lookup` | 查询核保规则和产品规则 |
| `medical_evidence_extract` | 从资料中提取结构化医学证据 |
| `anti_selection_screen` | 检查告知不一致、短期高保额和逆向选择信号 |
| `reinsurance_referral_pack` | 生成再保转交材料 |

### 示例：理赔流程

建议的可运行流程：

1. 转换理赔申请、死亡证明、医学资料和付款文件。
2. 检查保单状态、等待期、责任范围、除外责任和受益人身份。
3. 计算给付金额。
4. 筛查欺诈信号和证据缺口。
5. 批准、部分批准、拒绝或调查建议必须由人工理赔签核。

可能新增的 Skill：

| Skill | 作用 |
|---|---|
| `policy_coverage_lookup` | 查询保障责任、除外责任、等待期和保单状态 |
| `beneficiary_verify` | 核验受益人身份和分配比例 |
| `claim_payment_calculator` | 按公式和扣减项计算给付金额 |
| `claims_fraud_screen` | 识别短期出险、高额、资料矛盾和重复理赔 |

### 示例：合规流程

建议的可运行流程：

1. 收集监管更新和内部制度。
2. 将制度和流程文档转换为 Markdown。
3. 将规则映射到产品、流程、数据流、AI 使用和证据要求。
4. 输出按风险排序的差距、责任人和整改期限。
5. 跟踪整改证据和培训要求。

可能新增的 Skill：

| Skill | 作用 |
|---|---|
| `regulatory_change_monitor` | 监控监管更新和通报 |
| `compliance_rule_mapper` | 将监管要求映射到业务流程和系统 |
| `audit_evidence_collector` | 生成审计证据清单并收集产物 |
| `remediation_tracker` | 跟踪责任人、截止日期、风险等级和闭环证据 |

### 建议下一步

在每条流程至少定义并测试一个真实寿险 Skill 前，不建议把这些 Agent 改成 `runnable`。安全的第一步是：

1. 保持四个 Agent 为 `template`。
2. 新增一个窄范围寿险 Skill，例如 `policy_coverage_lookup` 或 `actuarial_assumption_loader`。
3. 把它绑定到一个复制出来的 Agent。
4. 定义一个小工作流和一个审批关卡。
5. 跑一条低风险 demo mission。
6. 在 Backstage 检查 runs 和 artifacts 后再扩大范围。
