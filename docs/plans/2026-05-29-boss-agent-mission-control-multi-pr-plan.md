# Boss Agent Mission Control 多 PR 改造计划（审核修订版）

> **For Hermes:** 北老师确认后，再使用 `subagent-driven-development` 或 Codex worker 按 PR 顺序实施。本文只是一份可确认的实施计划，不直接改产品代码。

**Goal:** 把 `ferryhe/ai_interface` 从偏后台的 Agent/Skill/Run inspector，升级为以 Boss Agent 为主入口的 AI Team Mission Control：用户提交任务，Boss Agent 生成可确认/可修改的计划，确认后派发子 Agent 或角色化执行单元调用 Skills/Tools，并通过轻量看板观察状态、审批风险动作、验收交付。

**Architecture:** 保留现有 `agents`、`skills`、`agent-runtime`、DAG、tool adapters、run inspector、artifacts 等底层能力；新增 Mission / Plan / Approval / Execution Board 作为前台产品层；引入 genesis 风格的文件化 workbench governance 作为 operator/AI 可读后台层。审核后本计划明确：Mission API 必须从第一版起 DB-backed；Approval 不能另造一套执行系统，而应基于现有 module interaction / resume 机制做 projection + decision layer；Execution Board 只投影现有 runtime 状态，不制造临时 fake approve path。

**Tech Stack:** TypeScript, Express, React/Vite, YAML manifests, OpenAPI/Zod, Drizzle DB, existing `artifacts/api-server`, `artifacts/mockup-sandbox`, `agents/*`, `skills/*`, `lib/db`, `docs/*`.

---

## 1. 当前判断

`ai_interface` 当前底层能力并不小，已经有 Agent manifest、Skill manifest、planner、DAG executor、CLI/HTTP/MCP tool adapters、run inspector、artifacts、OpenAPI 和前端 mockup。但前台表达仍偏 “Backstage inspector”：用户容易先看到 Skills / Runs / Artifacts / Raw JSON，而不是“我提交一个任务，Boss Agent 组织一个 AI 团队完成”。

这次改造的核心不是重写 runtime，而是重排产品层级：

```text
用户任务
  ↓
Boss Agent 理解任务
  ↓
生成 Mission Plan / Team Plan
  ↓
用户确认 / 对话修改 / 降低风险模式
  ↓
确认执行
  ↓
现有 Agent Runtime + Skill DAG 执行
  ↓
角色化执行看板展示每个 Agent/Role 状态
  ↓
高风险 Skill / Tool 进入 Approval Inbox
  ↓
Boss Agent 回收结果、验收、交付
```

第一阶段要避免过度承诺“真实多子 Agent runtime”。可以先在 Mission Plan 里展示角色化 assignments，但执行仍映射到现有 single agent runtime + skill DAG。等 Mission 模型稳定后，再扩展真正 multi-agent executor。

---

## 2. 设计原则

1. **Mission-first:** 普通用户先看到任务、计划、执行、审批、交付。
2. **Backstage-second:** Skill manifest、Agent manifest、Raw JSON、adapter readiness 仍保留，但作为 Operator Backstage。
3. **DB-backed missions from day one:** Mission、Plan revision、approval decision、execution link 必须能跨刷新、轮询、审批和执行恢复存在；in-memory 只能用于单元测试。
4. **Approval projection-first:** Approval UI 是对现有 module-run interaction / resumeHandle 的投影和决策层，不是第二套执行系统。
5. **File-backed operator layer:** genesis 风格 Markdown/YAML 文件适合给 AI 和后台操作者看，不强迫普通用户手改。
6. **Light board, strong traceability:** 看板轻，但每个状态都能下钻到 run/event/artifact/source。
7. **No provider/model exposure to normal users:** 普通用户只选择任务目标、风险模式、是否批准，不直接管理 provider/model/embedding。
8. **Avoid giant UI rewrites:** 不在早期大改 `AgentFirstInterface.tsx` 巨组件；先新建 Mission shell，再最小挂载。

---

## 3. 推荐 PR 顺序总览

| PR | 主题 | 核心目的 | 风险等级 |
|---|---|---|---|
| PR 1 | Workbench Governance docs | 统一产品语言和文件治理边界 | 低 |
| PR 2 | Minimal Mission Plan contract | 建最小 Mission 合同，不过早发明完整 child-agent runtime | 中 |
| PR 3 | Mission persistence foundation | DB schema + repository + revision/link model | 中高 |
| PR 4 | Mission intake/revise/approve API | 任务入口、修订、批准；不立即执行高风险动作 | 中高 |
| PR 5 | Mission Center / Plan Review UI | 普通用户入口轻量化 | 中 |
| PR 6 | Approval projection + Inbox | 基于现有 interaction/resume 的审批箱 | 高 |
| PR 7 | Execution Board | 基于真实 plan/run/approval/artifact 投影状态看板 | 中高 |
| PR 8 | Operator Backstage read-only | operator 可读 manifests/workbench 文件 | 中 |
| PR 9 | Operator manifest mutation guards | custom manifest 可写 + 安全边界 | 高 |
| PR 10 | Knowledge Builder demo | 用现有 skill DAG 跑通端到端叙事 | 中 |
| PR 11 | Hardening/regression | 回归、文档、导航收尾 | 中 |

---

## PR 1: 产品词汇与 Workbench Governance 文档层

**Objective:** 先把产品方向、文件治理、Boss Agent 语义写清楚，不改 runtime，降低后续 PR 歧义。

**Scope:** docs-only。不要改 API、DB、UI runtime。

**Files:**

- Create: `docs/workbench/README.md`
- Create: `docs/workbench/projects/ai_interface/STATE.md`
- Create: `docs/workbench/projects/ai_interface/docs/progress.md`
- Create: `docs/workbench/teams/team-registry.yaml`
- Create: `docs/workbench/roles/boss-agent.md`
- Create: `docs/workbench/roles/research-agent.md`
- Create: `docs/workbench/roles/builder-agent.md`
- Create: `docs/workbench/roles/qa-agent.md`
- Create: `docs/workbench/README-is-not-database.md`
- Modify: `README.md` only to add a short link to `docs/workbench/README.md`.

**Implementation notes:**

- `README.md` 只做入口，不记录当前状态。
- `STATE.md` 是当前事实源。
- `progress.md` 是过程记录。
- `team-registry.yaml` 记录 team/role routing boundaries。
- role files 记录角色能力、禁区、验收口径。
- 普通用户通过 UI 操作；operator/AI agents 可以读这些文件。
- 不原样复制 genesis；只吸收它的结构原则。

**Acceptance criteria:**

- 新贡献者 5 分钟内能理解 Mission Control 目标模型。
- README 仍然简洁。
- 无 runtime 行为变化。
- `git diff --check` passes。

**Verification:**

```bash
git diff --check
```

**Delivery / Checks / Handoff template (PR 1):**

- **Delivery:** 说明本 PR 实际落地的文档/接口/页面/测试资产，避免只写目标不写结果。
- **Checks:** 列出本 PR 必跑命令与通过标准；PR 1 至少包含 `git diff --check`。
- **Handoff:** 记录留给下一 PR 或 reviewer 的待决、边界、风险与非目标。

---

## PR 2: Minimal Mission Plan Contract

**Objective:** 建立最小 Mission Plan 合同，让现有 `AgentRuntimePlan` 可以安全映射到 Mission 层；暂不强推完整 child-agent assignments。

**Scope:** API types/tests/spec fixtures。保持兼容现有 `AgentRuntimePlan`。

**Files:**

- Create: `artifacts/api-server/src/mission/mission-plan.ts`
- Create: `artifacts/api-server/src/mission/mission-plan.test.ts`
- Create: `docs/contracts/fixtures/mission-plan-basic.json`
- Create: `docs/contracts/fixtures/mission-plan-approval.json`
- Modify: `artifacts/api-server/src/agent-runtime/agent-runtime-service.ts` only if needed to expose a mapping helper.
- Modify: `lib/api-spec/openapi.yaml` only if exposing new response fields.

**Minimal contract:**

```ts
export type MissionRiskLevel = "low" | "medium" | "high";
export type MissionPlanStatus =
  | "draft"
  | "needs_confirmation"
  | "approved"
  | "executing"
  | "completed"
  | "failed";
export type MissionStepStatus =
  | "pending"
  | "waiting_approval"
  | "running"
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface MissionPlanStep {
  stepId: string;
  title: string;
  objective: string;
  skillId?: string;
  moduleId?: string;
  assignedAgentId?: string;
  roleId?: string;
  dependsOn: string[];
  status: MissionStepStatus;
  approval?: {
    required: boolean;
    reason: string;
    riskLevel: MissionRiskLevel;
  };
}

export interface MissionPlan {
  missionId: string;
  title: string;
  userGoal: string;
  summary: string;
  status: MissionPlanStatus;
  riskLevel: MissionRiskLevel;
  steps: MissionPlanStep[];
  warnings: string[];
  nonGoals: string[];
}
```

**Deferred fields:**

- `assignments[]`
- true child-agent scheduler
- role memory routing
- multi-agent handoff engine

These can be introduced after Mission + approval + board are stable.

**Testing requirements:**

- Duplicate step IDs fail.
- Unknown dependency fails.
- Dependency cycle fails.
- Approval-required step carries reason and risk level.
- Existing `AgentRuntimePlan` maps to a valid minimal `MissionPlan` without losing `skillId/moduleId` drilldown.

**Acceptance criteria:**

- Existing agent run behavior remains compatible.
- Mission fixtures are UI-readable without raw runtime internals.
- `skillId/moduleId` allow board/artifact drilldown later.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/mission/mission-plan.test.ts
pnpm --filter @workspace/api-server run build
```

---

## PR 3: Mission Persistence Foundation

**Objective:** 从第一版 API 前建立 DB-backed Mission storage，支持跨页面刷新、轮询、审批、修订和执行关联。

**Scope:** DB schema, migration, repository interface, tests。不要做 UI。

**Files:**

- Modify: `lib/db/src/schema/module-os.ts`
- Create: `lib/db/migrations/YYYYMMDD_add_missions.sql`
- Create: `artifacts/api-server/src/mission/mission-repository.ts`
- Create: `artifacts/api-server/src/mission/db-mission-repository.ts`
- Create: `artifacts/api-server/src/mission/in-memory-mission-repository.ts` only for tests.
- Create: `artifacts/api-server/src/mission/mission-repository.test.ts`

**DB entities:**

- `missions`
  - `mission_id`
  - `title`
  - `user_goal`
  - `status`
  - `risk_level`
  - `created_at`
  - `updated_at`
  - `approved_at?`
  - `approved_by?`
- `mission_plan_revisions`
  - `revision_id`
  - `mission_id`
  - `revision_number`
  - `status`: `draft | approved | superseded | executed`
  - `plan_json`
  - `created_at`
- `mission_execution_links`
  - `mission_id`
  - `revision_id`
  - `thread_id?`
  - `pipeline_run_id?`
  - `source_agent_run_id?`
  - `executed_at?`

**Rules:**

- Route backing must use DB repository in app runtime.
- In-memory repositories are allowed only in unit tests.
- Revising creates immutable new revision.
- Only latest draft revision can be approved.
- Approving stale revision returns `409 Conflict`.

**Tests:**

- Create mission and first revision.
- Create second revision; old revision becomes superseded or non-latest.
- Approve latest revision succeeds.
- Approve stale revision returns conflict.
- Link mission to pipeline run.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/mission/mission-repository.test.ts
pnpm --filter @workspace/api-server run build
pnpm run typecheck:libs
```

---

## PR 4: Mission Intake / Revise / Approve API

**Objective:** 支持“用户提交任务 → Boss Agent 生成 draft plan → 用户确认/修改/批准”，并明确 review 与 execution 的语义边界。

**Scope:** API route + service + tests。不要做大 UI。

**Files:**

- Create: `artifacts/api-server/src/routes/missions.ts`
- Create: `artifacts/api-server/src/routes/missions.test.ts`
- Create: `artifacts/api-server/src/mission/mission-service.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate/update `lib/api-zod` and client packages if required by existing workflow.

**Endpoints:**

```text
POST /api/missions
  body: {
    message: string,
    agentId?: string,
    enabledSkillIds?: string[],
    reviewMode?: "draft_for_review" | "plan_only"
  }
  returns: { mission, plan, revision }

GET /api/missions/:missionId
  returns: { mission, latestRevision, plan }

POST /api/missions/:missionId/revise
  body: { instruction: string, expectedRevisionId: string }
  returns: { mission, revision, plan }

POST /api/missions/:missionId/approve
  body: { revisionId: string, approvedBy?: string }
  returns: { mission, approvedRevision, executionReadiness }

POST /api/missions/:missionId/execute
  body: { revisionId: string, executionMode?: "plan_only" | "execute_ready" }
  returns: { mission, pipelineRun?, thread?, moduleRuns? }
```

**Why separate approve and execute:**

- Approval means user accepts the plan.
- Execute means system starts runtime work.
- This prevents “approve” from accidentally triggering high-risk execution.

**Access/security requirements:**

- Define whether portal surface can create/read missions.
- Approve/execute should require the same or stricter guard than existing agent-run mutation routes.
- Responses must redact env values, local paths, tokens, provider URLs, and raw headers.

**Tests:**

- Create draft mission.
- Revise latest draft.
- Revise with stale revision → 409.
- Approve latest revision.
- Approve stale revision → 409.
- Execute unapproved mission → 409/400.
- Portal/admin token behavior explicitly tested.
- Existing `/api/agent-runs` tests still pass.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/routes/missions.test.ts src/routes/agent-runs.test.ts
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
```

---

## PR 5: Mission Center / Plan Review 轻界面

**Objective:** 把普通用户入口从后台对象切换到 Mission-first：提交任务、查看 Boss Agent 理解、确认/修改计划。

**Scope:** React UI + API client usage。不要重排整个旧 Backstage。

**Files:**

- Create: `artifacts/mockup-sandbox/src/components/mission/MissionCenterShell.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mission/MissionIntake.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mission/PlanReview.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mission/PlanStepCard.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mission/ApprovalSummary.tsx`
- Modify: existing top-level mockup component only to mount Mission Center as a tab/default page.

**Important constraint:**

Avoid large in-place edits to `AgentFirstInterface.tsx`; mount Mission Center behind a new shell component and keep legacy Backstage tabs intact in this PR.

**UI principles:**

- First screen asks: “你要让 AI 团队完成什么？”
- Plan Review shows Mission summary, suggested roles, steps, dependencies, skill/tool badges, required approvals.
- Buttons: `确认计划`, `修改计划`, `只生成计划`, `执行`.
- Raw JSON hidden behind “高级详情”。
- No provider/model/embedding on normal page.

**Acceptance criteria:**

- User can submit a mission and see draft plan.
- User can revise plan with instruction.
- User can approve latest plan revision.
- Stale revision conflict has visible UI message.
- Backstage remains accessible.

**Verification:**

```bash
pnpm --dir artifacts/mockup-sandbox run typecheck
pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Browser smoke:

- Open Mission Center.
- Submit sample mission.
- Plan Review renders.
- Revise plan.
- Approve latest revision.
- Backstage link still works.

---

## PR 6: Approval Projection + Approval Inbox

**Objective:** 把 high-risk skill/tool approval 从隐藏的 module interaction/resume 状态，提升为前台一等公民；但不另造第二套执行系统。

**Scope:** Approval projection API + UI。必须基于现有 module-run interaction / resumeHandle。

**Files:**

- Create: `artifacts/api-server/src/approvals/approval-projection.ts`
- Create: `artifacts/api-server/src/approvals/approval-decision-service.ts`
- Create: `artifacts/api-server/src/approvals/approval-service.test.ts`
- Create: `artifacts/api-server/src/routes/approvals.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify existing module feedback/resume path only if needed to share logic.
- Create: `artifacts/mockup-sandbox/src/components/approvals/ApprovalInbox.tsx`
- Create: `artifacts/mockup-sandbox/src/components/approvals/ApprovalCard.tsx`
- Modify Mission Center side panel to include pending approvals.

**ApprovalRequest projection:**

```ts
interface ApprovalRequest {
  approvalId: string;
  missionId: string;
  revisionId: string;
  moduleRunId: string;
  interactionId?: string;
  resumeHandle?: string;
  stepId?: string;
  agentId?: string;
  skillId?: string;
  toolKind?: string;
  riskLevel: "low" | "medium" | "high";
  action: string;
  reason: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "expired";
}
```

**Rules:**

- `ApprovalRequest` must reference the underlying module run interaction (`moduleRunId`, `interactionId`, `resumeHandle`) so approval UI remains a projection/decision layer rather than a parallel execution system.
- Approval decisions resume execution through the existing module-run resume/feedback path.
- Approval decision records may be stored for audit, but runtime truth remains tied to module run interaction/resume state.
- Approving one request does not approve all future high-risk actions globally.

**Tests:**

- Project pending approval from module-run metadata.
- Approve request calls existing resume/feedback path.
- Reject request blocks intended step.
- Approve rejected request returns conflict.
- Approval decision is idempotent.
- Portal/admin access behavior tested.
- Redaction tested.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/approvals/approval-service.test.ts src/routes/approvals.test.ts src/agent-runtime/dag-executor.test.ts
pnpm --filter @workspace/api-server run build
pnpm --dir artifacts/mockup-sandbox run typecheck
```

---

## PR 7: Execution Board

**Objective:** 执行中默认展示“每个 Agent/Role 在干什么、卡在哪里、产出了什么”，而不是先展示 raw run/module/event。

**Scope:** API projection + UI board。底层 run/event/artifact 继续复用。

**Files:**

- Create: `artifacts/api-server/src/mission/execution-board.ts`
- Create: `artifacts/api-server/src/mission/execution-board.test.ts`
- Modify: `artifacts/api-server/src/routes/missions.ts` add `GET /api/missions/:missionId/board`.
- Create: `artifacts/mockup-sandbox/src/components/mission/ExecutionBoard.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mission/AgentStatusCard.tsx`
- Create: `artifacts/mockup-sandbox/src/components/mission/ArtifactStrip.tsx`
- Modify Mission detail page to include board.

**Board model:**

```ts
interface MissionBoardAgent {
  agentId?: string;
  roleId?: string;
  displayName: string;
  status: "pending" | "running" | "waiting_approval" | "blocked" | "succeeded" | "failed";
  currentAction: string;
  lastEventAt?: string;
  blockingReason?: string;
  moduleRunIds: string[];
  latestArtifacts: Array<{ artifactId: string; kind: string; title: string }>;
}
```

**Rules:**

- Board is a projection from Mission Plan + moduleRuns + runEvents + artifacts + approval projection.
- No fake/demo approve path.
- If approval is pending, board shows `waiting_approval` and links to Approval Inbox.
- If artifacts/events are missing, board degrades gracefully.

**Tests:**

- Projection from plan + module runs.
- Waiting approval state maps correctly.
- Blocked reason priority test.
- Missing artifact/event does not crash.
- Multiple revisions: board shows approved/executed revision only.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/mission/execution-board.test.ts src/routes/missions.test.ts src/routes/approvals.test.ts
pnpm --filter @workspace/api-server run build
pnpm --dir artifacts/mockup-sandbox run typecheck
pnpm --dir artifacts/mockup-sandbox run build
```

Browser smoke:

- Create mission.
- Approve and execute.
- Reach waiting approval or blocked state using existing runtime metadata.
- Board renders waiting state.
- Drilldown opens run/artifact detail.

---

## PR 8: Operator Backstage Read-only

**Objective:** 把 genesis 风格“适合 AI 看、适合 operator 读文件”的定义方式，纳入 Backstage，但第一版只读。

**Scope:** Operator UI read-only + redaction。不要做 manifest 写入。

**Files:**

- Create: `artifacts/mockup-sandbox/src/components/operator/OperatorBackstage.tsx`
- Create: `artifacts/mockup-sandbox/src/components/operator/ManifestViewer.tsx`
- Create: `artifacts/mockup-sandbox/src/components/operator/WorkbenchFileViewer.tsx`
- Modify Backstage navigation to add Operator tab.
- Add/modify API only if existing routes cannot provide safe read data.

**Rules:**

- Normal user path does not show raw YAML by default.
- Operator can view built-in/community/custom manifests.
- Operator can view `docs/workbench/*`.
- Secret-looking values, local paths, provider URLs, tokens must be redacted.
- No write operations in this PR.

**Acceptance criteria:**

- Operator can inspect Boss Agent / child role / Skill manifests.
- Sources are labeled built-in/community/custom/workbench.
- Mission Center remains clean.
- No secrets or absolute local paths leak.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/routes/agent-manifests.test.ts src/routes/skills.test.ts
pnpm --filter @workspace/api-server run build
pnpm --dir artifacts/mockup-sandbox run typecheck
pnpm --dir artifacts/mockup-sandbox run build
```

---

## PR 9: Operator Manifest Mutation Guards

**Objective:** 在 read-only Operator Backstage 稳定后，再允许安全编辑 custom manifest；严格保护 built-in/community 和路径边界。

**Scope:** Write API guards + UI mutation + tests。

**Files:**

- Modify: `artifacts/api-server/src/routes/agent-manifests.ts`
- Modify: `artifacts/api-server/src/routes/skills.ts` if skill manifest write route exists or is added.
- Create/modify: manifest writer tests.
- Modify: `artifacts/mockup-sandbox/src/components/operator/ManifestEditor.tsx`

**Rules:**

- Writable only:
  - `agents/custom/<agentId>/agent.yaml`
  - `skills/custom/<skillId>/skill.yaml`
- No `../` path traversal.
- Built-in override requires existing explicit env gate.
- Workbench docs default remain read-only unless a later PR explicitly enables docs editing.
- Portal surface should not have manifest write permission by default.
- Every write response redacts secrets/paths.

**Tests:**

- Write custom agent succeeds when write mode allows.
- Write built-in blocked.
- Write community blocked unless explicitly allowed by policy.
- Path traversal blocked.
- Secret/path redaction.
- Portal write blocked.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/routes/agent-manifests.test.ts src/routes/skills.test.ts
pnpm --filter @workspace/api-server run build
pnpm --dir artifacts/mockup-sandbox run typecheck
```

---

## PR 10: Knowledge Builder Mission Demo

**Objective:** 用已有 `knowledge_builder`、`web_listening`、`doc_to_md`、`md_to_rag`、`rag_to_agent` 跑通一个端到端 demo，把产品闭环讲清楚。

**Scope:** Demo fixture + docs + smoke tests。除非发现 blocker，不新增核心架构。

**Files:**

- Create: `docs/demos/knowledge-builder-mission.md`
- Create: `docs/contracts/fixtures/knowledge-builder-mission.json`
- Create: `artifacts/api-server/src/mission/knowledge-builder-demo.test.ts`
- Modify: `agents/builtin/knowledge_builder/agent.yaml` only if needed to expose clearer Mission metadata.
- Modify frontend demo seed/sample data if current UI uses static sample data.

**Scenario:**

User says:

```text
把我批准的网页和文档资料做成一个可问答的知识库 Agent。
```

Expected draft:

1. Source Collector role: optional `web_listening` + `doc_to_md`.
2. Knowledge Builder role: required `md_to_rag` + `rag_to_agent`.
3. QA Reviewer role: verify artifact completeness and source traceability.
4. Approval: network access and write DB require approval.
5. Delivery: generated agent config + artifacts.

**Important wording:**

In the first demo, role labels may be present in the Mission Plan while execution still maps to a single existing agent runtime plus skill DAG. Do not imply a true multi-agent executor unless that runtime is implemented first.

**Acceptance criteria:**

- Demo doc has walkthrough.
- Fixture proves mission plan shape.
- Test proves draft plan includes correct roles/skills/approvals.
- UI can show the demo in Mission Center.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test -- src/mission/knowledge-builder-demo.test.ts
pnpm --filter @workspace/api-server run build
pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

---

## PR 11: Polish and Regression Hardening

**Objective:** 收尾：确保新 Mission-first 体验不会破坏原 Backstage 能力，并补齐回归测试和文档索引。

**Scope:** Testing, docs, navigation polish, no new major features.

**Files:**

- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/workbench/README.md`
- Modify: frontend navigation components.
- Add/update test files touched by earlier PRs.

**Regression checklist:**

- Existing `/api/agents` still returns manifests.
- Existing `/api/skills` still returns redacted readiness.
- Existing `/api/agent-runs` still works.
- Existing Runs/Artifacts inspector still reachable from drilldown.
- Mission Center is default normal-user path.
- Operator Backstage is advanced path.
- Approval Inbox and Board agree on the same underlying interaction/resume state.
- No secret values, local absolute paths, provider URLs, MCP URLs, tokens, raw headers leak in API/UI.

**Verification:**

```bash
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
pnpm --dir artifacts/mockup-sandbox run typecheck
pnpm --dir artifacts/mockup-sandbox run build
git diff --check
```

Browser smoke:

- Mission Center renders.
- Plan Review works.
- Approval Inbox works.
- Execution Board works.
- Backstage Agents/Skills/Runs/Artifacts still work.
- Operator Backstage read-only and custom mutation guards work as designed.

---

## 4. Explicit Non-goals

- 不重写现有 agent runtime。
- 不删除 Skills/Runs/Artifacts Backstage。
- 不在普通用户界面暴露 provider/model/embedding 设置。
- 不把 genesis 的文件原样复制进仓库；只吸收结构原则。
- 不在第一阶段做复杂多租户权限。
- 不在第一阶段做自动服务重启、发布、删除等高风险控制动作。
- 不绕过现有 approval/security guard。
- 不在 Mission 第一阶段承诺真正 multi-agent executor；先用角色化 plan + existing runtime。

---

## 5. 必补测试清单

### Mission contract / API

- duplicate step IDs
- unknown dependency
- dependency cycle
- stale revision approve → 409
- approve latest revision only
- revise after approve 行为定义
- mission ↔ pipelineRun link persistence
- portal/admin access behavior
- response redaction

### Approval

- approval projection references `moduleRunId` / `resumeHandle`
- approve/reject 幂等性
- rejected request 再 approve → 409
- approval 只恢复对应 step
- approval 与现有 resume/feedback path 绑定
- board 与 inbox 对同一 underlying interaction 一致

### Board

- projection from plan + moduleRuns + runEvents + artifacts
- missing artifacts / missing latest event 不崩
- blocked reason 映射优先级
- 多 revision / 多 pipelineRun 时显示 approved/executed revision

### Operator

- built-in/community/custom 写入边界
- path traversal 拦截
- secret/path redaction
- workbench docs 默认只读
- portal surface 不默认有 manifest write 权限

### UI

- loading / empty / error states
- stale revision conflict 提示
- waiting approval / blocked states
- raw JSON hidden by default but drilldown available

---

## 6. Open Questions for 北老师

1. `docs/workbench/` 是否作为公开仓库模板保存？我建议公开模板放 `docs/workbench/`，个人状态仍放 `.hermes/project-status.md`。
2. Mission Center 是否成为默认首页？我建议是，Backstage 作为高级入口。
3. 第一版是否只用 `knowledge_builder` 一个 demo 闭环证明 Mission-first？我建议是。
4. Approval 是否默认对 network / write-db / external-platform 三类动作强制显示？我建议是。
5. Operator Backstage 是否允许写 `docs/workbench/*`？我建议第一版不允许，只读；custom manifest 可写放到 PR 9。
6. 是否接受第一阶段 “角色化 plan，但执行仍映射现有 single agent runtime + skill DAG”？我建议接受，避免过早实现 multi-agent executor。

---

## 7. 审核意见已吸收

已派独立 reviewer 审核初稿，并吸收以下关键修改：

- 删除 “production route 可用 in-memory mission repository” 的假设，改为 DB-backed from day one。
- 将 Approval 明确为 existing module interaction / resume 的 projection + decision layer，避免第二套审批执行系统。
- 将 Execution Board 后置到 Approval projection 之后，避免 fake approve path。
- 将 PR 2 的 assignments / role / child-agent 字段降级为 optional 或 deferred，避免过早发明完整 multi-agent runtime。
- 增加 revision concurrency：approve stale revision → 409。
- 增加 route access/security/redaction 测试要求。
- 将 Operator Backstage 拆成 read-only 与 mutation guards 两个 PR。
- 明确第一阶段 demo 中角色可以是 plan labels，但执行仍走现有 runtime + skill DAG。

---

## 8. 建议确认方式

建议北老师先确认三件事，再进入实施：

1. **产品方向确认：** Mission Center 做默认首页，Backstage 下沉。
2. **工程边界确认：** 第一阶段不做真正 multi-agent executor，只做 Mission plan + existing runtime projection。
3. **数据边界确认：** Mission / revision / execution link 必须 DB-backed；operator 文件层第一版只读。

确认后，实施应从 PR 1 开始，每个 PR 单独 branch、单独测试、单独 review，不要合并成大 PR。
