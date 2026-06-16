# Agent Configuration + Frontstage Run E2E Record

中文见下半部分。

## English

### Scope

This E2E record verifies that an operator can configure the local AI runtime from Backstage/Publish controls, publish a portal token, and that an end user can submit a frontstage Portal task that reaches the API runtime.

Date: 2026-06-16
Branch: `test/e2e-agent-config-run`
Base PR already merged: #87, merge commit `48473f0`

### Environment

API server:

```powershell
$env:PORT="3001"
$env:NODE_ENV="development"
$env:AI_INTERFACE_REPOSITORY_MODE="memory"
$env:AI_INTERFACE_MANIFEST_WRITE_MODE="custom"
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run start
```

Frontend:

```powershell
$env:PORT="8082"
$env:BASE_PATH="/"
$env:VITE_DEFAULT_PREVIEW="ai-os/AgentFirstInterface"
$env:API_PROXY_TARGET="http://127.0.0.1:3001"
corepack pnpm --dir artifacts/mockup-sandbox run dev -- --host 127.0.0.1
```

Why memory mode was used:

- The default API path requires `DATABASE_URL`.
- This machine did not have a local Postgres server listening on `127.0.0.1:5432`.
- `psql` and `docker` were not available.
- Memory mode is only for local smoke testing; it does not replace production database testing.

API key note:

- `OPENAI_API_KEY` was borrowed from `C:\Project\canada_pension\.env` as requested.
- The provider request returned HTTP 401, so the E2E run used the deterministic provider.
- No API key value was printed or written to this document.

### Fixes Made During E2E

1. Added `AI_INTERFACE_REPOSITORY_MODE=memory` support in API route assembly.
   This lets local E2E exercise the real HTTP routes without a Postgres instance.

2. Added `API_PROXY_TARGET` support to the Vite dev server.
   This makes frontend `/api/*` requests reach the API server during local preview.

3. Updated Publish preview behavior.
   The Publish page now uses the current-session portal token for "Open Portal preview" / "View as user" instead of always using `portal-demo-token`.

4. Updated user guides.
   `docs/userguide.md` and `docs/userguide.zh.md` now document `DATABASE_URL`, memory mode, and `API_PROXY_TARGET`.

### Backend Checks

API health:

```text
GET http://127.0.0.1:3001/api/healthz -> 200, {"status":"ok"}
```

Frontend proxy health:

```text
GET http://127.0.0.1:8082/api/healthz -> 200, {"status":"ok"}
```

Insurance template read:

```text
GET /api/agents?teamId=insurance&runtimeStatus=template -> 4 agents
```

Skill catalog read:

```text
GET /api/skills -> 7 skills
```

Runtime config write:

```text
PUT /api/agent-config
provider=deterministic
publishSettings.status=published
publishSettings.versionLabel=e2e-frontstage-2026-06-16
```

Result:

```text
connection.status=configured
publishSettings.status=published
```

### Backstage Custom Agent Check

Created a runnable custom life-insurance E2E agent:

```text
POST /api/agent-manifests -> 201
agentId=e2e_life_insurance_builder
skills=md_to_rag, rag_to_agent
runtimeStatus=runnable
teamId=insurance
```

Observed gap:

```text
GET /api/agents?teamId=insurance&runtimeStatus=runnable -> 0 agents
```

The write succeeded, but the current API process did not hot-reload the agent registry. After API restart:

```text
GET /api/agents?teamId=insurance&runtimeStatus=runnable -> e2e_life_insurance_builder
POST /api/agent-runs agentId=e2e_life_insurance_builder -> 201
pipelineRunId=b015948b-144c-49fc-a98a-d8987a54588d
status=needs_approval
moduleRuns=2
modules=md_to_rag, rag_to_agent
```

This is a real product requirement, not a test failure; see `docs/requirements/life-insurance-runnable-workflow.md`.

### UI E2E Steps

Admin / Backstage:

1. Open `http://127.0.0.1:8082/preview/ai-os/AgentFirstInterface?lang=en-US`.
2. Open `Configure`.
3. Confirm config is loaded from API and provider readiness is visible.
4. Set provider to `Deterministic`.
5. Edit the system prompt.
6. Click `Save`.
7. Assert `PUT /api/agent-config -> 200`.
8. Open `Publish`.
9. Fill version label `e2e-ui-preview-token-2026-06-16`.
10. Fill a non-demo portal token for the current session.
11. Click `Publish`.
12. Assert `PUT /api/agent-config -> 200`.
13. Click `View as user`.

Portal / Frontstage:

1. Portal opens with the current-session token.
2. Assert `POST /api/portal-auth/verify -> 200`.
3. Confirm UI shows `API authorized`.
4. Enter:

```text
Frontstage E2E with non-demo token: run the configured onboarding plan and show auditable steps.
```

5. Click `Send`.
6. Assert `POST /api/agent-runs -> 201`.

Result:

```text
pipelineRunId=676fdb2b-3e27-4e39-b7e5-e99c12ab16cf
status=needs_approval
connection=configured
activeProvider=deterministic
pipelineStatus=pending
moduleRunCount=6
Portal UI=API saved
```

### Verification Commands

```powershell
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
corepack pnpm --filter @workspace/api-server run test -- --test-name-pattern "agent config|agent run|missions|modules|approvals|portal auth|run inspector"
corepack pnpm --dir artifacts/mockup-sandbox run test:portal
corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
```

### Remaining Requirements

- Hot-reload the agent registry after successful `POST /api/agent-manifests`.
- Connect Mission execution to real Agent runs instead of returning `executionReadiness.status=stubbed`.
- Add runnable life-insurance skills/tools and workflows; the existing four insurance agents are currently templates.
- Add stable `data-testid` selectors for repeated UI labels such as `Save`, `Publish`, and `Test Run`.

## 中文

### 范围

这次 E2E 验证后台用户可以通过 Configure/Publish 配置本地 AI runtime、发布 Portal token，前台用户可以在 Portal 提交任务，并且任务真实进入 API runtime。

日期：2026-06-16
分支：`test/e2e-agent-config-run`
已合并基线 PR：#87，merge commit `48473f0`

### 环境

API server：

```powershell
$env:PORT="3001"
$env:NODE_ENV="development"
$env:AI_INTERFACE_REPOSITORY_MODE="memory"
$env:AI_INTERFACE_MANIFEST_WRITE_MODE="custom"
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run start
```

前端：

```powershell
$env:PORT="8082"
$env:BASE_PATH="/"
$env:VITE_DEFAULT_PREVIEW="ai-os/AgentFirstInterface"
$env:API_PROXY_TARGET="http://127.0.0.1:3001"
corepack pnpm --dir artifacts/mockup-sandbox run dev -- --host 127.0.0.1
```

为什么使用 memory mode：

- 默认 API 路径要求 `DATABASE_URL`。
- 本机 `127.0.0.1:5432` 没有 Postgres。
- 本机没有可直接使用的 `psql` 或 `docker`。
- memory mode 只用于本地冒烟测试，不替代生产数据库测试。

API key 说明：

- 按要求从 `C:\Project\canada_pension\.env` 借用了 `OPENAI_API_KEY`。
- OpenAI provider 请求返回 HTTP 401，因此 E2E 改用 deterministic provider。
- 没有打印或写入任何 API key 值。

### E2E 过程中修复的问题

1. API route assembly 增加 `AI_INTERFACE_REPOSITORY_MODE=memory`。
   这样本地没有 Postgres 时也能跑真实 HTTP/API/UI 链路。

2. Vite dev server 增加 `API_PROXY_TARGET`。
   这样前端 `/api/*` 请求会代理到 API server。

3. Publish preview 不再固定使用 `portal-demo-token`。
   当前会话输入的 token 会用于 `Open Portal preview` / `View as user`。

4. 更新中英文 user guide。
   现在说明了 `DATABASE_URL`、memory mode 和 `API_PROXY_TARGET`。

### 后台检查

API 健康检查：

```text
GET http://127.0.0.1:3001/api/healthz -> 200, {"status":"ok"}
```

前端代理健康检查：

```text
GET http://127.0.0.1:8082/api/healthz -> 200, {"status":"ok"}
```

读取寿险模板：

```text
GET /api/agents?teamId=insurance&runtimeStatus=template -> 4 agents
```

读取 skill catalog：

```text
GET /api/skills -> 7 skills
```

写入 runtime config：

```text
PUT /api/agent-config
provider=deterministic
publishSettings.status=published
publishSettings.versionLabel=e2e-frontstage-2026-06-16
```

结果：

```text
connection.status=configured
publishSettings.status=published
```

### 后台 Custom Agent 检查

创建了一个可运行的寿险 E2E custom agent：

```text
POST /api/agent-manifests -> 201
agentId=e2e_life_insurance_builder
skills=md_to_rag, rag_to_agent
runtimeStatus=runnable
teamId=insurance
```

观察到的缺口：

```text
GET /api/agents?teamId=insurance&runtimeStatus=runnable -> 0 agents
```

写入成功，但当前 API 进程没有热更新 agent registry。重启 API 后：

```text
GET /api/agents?teamId=insurance&runtimeStatus=runnable -> e2e_life_insurance_builder
POST /api/agent-runs agentId=e2e_life_insurance_builder -> 201
pipelineRunId=b015948b-144c-49fc-a98a-d8987a54588d
status=needs_approval
moduleRuns=2
modules=md_to_rag, rag_to_agent
```

这不是测试失败，而是产品需求；见 `docs/requirements/life-insurance-runnable-workflow.md`。

### UI E2E 步骤

后台 / Backstage：

1. 打开 `http://127.0.0.1:8082/preview/ai-os/AgentFirstInterface?lang=en-US`。
2. 进入 `Configure`。
3. 确认配置来自 API，provider readiness 可见。
4. 设置 provider 为 `Deterministic`。
5. 修改 system prompt。
6. 点击 `Save`。
7. 确认 `PUT /api/agent-config -> 200`。
8. 进入 `Publish`。
9. 填写 version label：`e2e-ui-preview-token-2026-06-16`。
10. 填写当前会话使用的非 demo portal token。
11. 点击 `Publish`。
12. 确认 `PUT /api/agent-config -> 200`。
13. 点击 `View as user`。

前台 / Portal：

1. Portal 使用当前会话 token 打开。
2. 确认 `POST /api/portal-auth/verify -> 200`。
3. 页面显示 `API authorized`。
4. 输入：

```text
Frontstage E2E with non-demo token: run the configured onboarding plan and show auditable steps.
```

5. 点击 `Send`。
6. 确认 `POST /api/agent-runs -> 201`。

结果：

```text
pipelineRunId=676fdb2b-3e27-4e39-b7e5-e99c12ab16cf
status=needs_approval
connection=configured
activeProvider=deterministic
pipelineStatus=pending
moduleRunCount=6
Portal UI=API saved
```

### 验证命令

```powershell
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --dir artifacts/mockup-sandbox run typecheck
corepack pnpm --filter @workspace/api-server run test -- --test-name-pattern "agent config|agent run|missions|modules|approvals|portal auth|run inspector"
corepack pnpm --dir artifacts/mockup-sandbox run test:portal
corepack pnpm --dir artifacts/mockup-sandbox run test:i18n
```

### 剩余需求

- `POST /api/agent-manifests` 成功后，agent registry 需要热更新。
- Mission execution 需要接入真实 Agent run，目前 `/execute` 仍返回 `executionReadiness.status=stubbed`。
- 寿险案例需要新增可运行的 skills/tools 和 workflows；当前四个寿险 agent 仍是模板。
- 给重复按钮和控件增加稳定 `data-testid`，例如 `Save`、`Publish`、`Test Run`。
