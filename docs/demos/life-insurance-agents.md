# 寿险行业 Agent 模板

本目录包含 4 个寿险行业专用 Agent 模板，展示 Agent Manifest 的九段式定义能力。

## Agent 清单

| Agent ID | 名称 | 角色 | 运行时状态 |
|---|---|---|---|
| `pricing_actuary` | 精算定价师 | 费率厘定、准备金评估、利润测试 | template |
| `life_uw_analyst` | 核保决策师 | 健康风险评估、核保结论 | template |
| `claims_reviewer` | 理赔审核师 | 理赔合规审核、理算金额 | template |
| `compliance_auditor` | 合规审计师 | 业务流程合规审计 | template |

## 设计说明

- **runtimeStatus: template** — 这些 Agent 是行业模板，定义专业边界和交付标准，不绑定实际可执行 skill
- **teamId: insurance** — 统一归属寿险业务团队
- **九段定义** — 每个 Agent 包含完整的 identity、criticalRules、deliverables、workflow、communicationStyle、successMetrics
- **目录结构** — 单层 `agents/custom/<name>/agent.yaml`，兼容现有 loader 扫描逻辑

## 使用方式

1. 在 API 中查看 Agent 列表：`GET /api/agents`
2. 按团队过滤：`GET /api/agents?teamId=insurance`
3. 如需只显示模板 Agent，客户端可按 `runtimeStatus: template` 过滤返回结果
4. 基于模板创建可执行 Agent：修改 `runtimeStatus` 为 `runnable` 并绑定实际 skill

## 内容边界

这些模板参考了寿险定价、核保、理赔和合规治理中的通用控制点：

- NAIC Principle-Based Reserving / Valuation Manual 对准备金假设、经验数据和压力情景的要求
- ASOP No. 52 对寿险原则基础准备金相关精算工作的文档化和假设治理要求
- NAIC Accelerated Underwriting 与 AI Model Bulletin 对核保数据、模型治理、公平性和可解释性的关注点
- NAIC Unfair Life, Accident and Health Claims Settlement Practices Model Regulation 对理赔调查和处置标准的要求
- IFRS 17 对保险合同确认、计量、列报和披露原则的要求
- FinCEN 与中国反洗钱监管规则对保险机构反洗钱内控、可疑交易报告和保密义务的要求
- 国家金融监督管理总局关于偿付能力监管规则、银行保险机构数据安全和个人信息保护的要求

模板中的人物设定均为虚构画像，只用于定义角色边界和交付标准。
