# AI Interface 模块化 CLI 编排控制台计划 Implementation Plan

> **For Hermes/Codex:** Use the project-isolated Codex worker pattern. Read `AGENTS.md` and `.hermes/project-status.md` before each run. Do not commit, push, or open PRs without explicit approval.

**Goal:** 把上游 CLI 模块作为工具接入，形成可视化/agent 可调度的全流程。

**Architecture:** OpenAPI/TypeScript monorepo 保持；新增 workflow/task model、CLI adapter、artifact viewer；前台只消费 status/result JSON。

**Tech Stack:** Project-native stack plus CLI-first JSON/JSONL manifests. Python projects should use Typer/Pydantic where already present; TypeScript projects should preserve pnpm/OpenAPI workflow.

---

## Context

This repository is one module in the broader agent-operated knowledge pipeline:

```text
web_listening -> doc_to_md -> md_to_rag -> rag_to_agent/domain adapters -> ai_interface
```

Current project role: 最上层 agent console / 前台，编排 web_listening、doc_to_md、md_to_rag、rag_to_agent。

Current planning scope: 定义模块式 workflow UI/API，不把各模块内部逻辑塞进前台。

## Non-Negotiable Contracts

1. CLI outputs must be machine-readable and stable (`--json` where applicable).
2. Artifacts must be path-portable and manifest-driven.
3. Reruns must be idempotent.
4. Every derived artifact must preserve provenance back to its input.
5. Secrets/API keys must never be written into manifests or committed files.
6. Cross-repo integration happens through files/manifests/tool specs, not hidden imports.

## Proposed Tasks

### Task 1: 盘点 monorepo API 结构

**Objective:** 阅读 packages/apps 布局、OpenAPI spec、server/db 层，确定新增 workflow package 位置。

**Files:**
- Modify/Create project-specific files identified during the task.
- Update tests or fixtures for the changed contract.

**Steps:**
1. Inspect the current implementation and write down exact files touched.
2. Add or update the smallest contract/test fixture first.
3. Implement the minimal change.
4. Run the focused verification command.
5. Update `.hermes/project-status.md` with result and next action.

**Verification:** 运行 pnpm install/typecheck 可行性检查。

### Task 2: 定义 module registry

**Objective:** 设计 web_listening/doc_to_md/md_to_rag/rag_to_agent 四类工具声明：command、inputs、outputs、status schema。

**Files:**
- Modify/Create project-specific files identified during the task.
- Update tests or fixtures for the changed contract.

**Steps:**
1. Inspect the current implementation and write down exact files touched.
2. Add or update the smallest contract/test fixture first.
3. Implement the minimal change.
4. Run the focused verification command.
5. Update `.hermes/project-status.md` with result and next action.

**Verification:** 新增 docs/contracts/module-registry-v1.md。

### Task 3: 设计 workflow state machine

**Objective:** 状态含 pending/running/succeeded/failed/cancelled，artifact refs 串联。

**Files:**
- Modify/Create project-specific files identified during the task.
- Update tests or fixtures for the changed contract.

**Steps:**
1. Inspect the current implementation and write down exact files touched.
2. Add or update the smallest contract/test fixture first.
3. Implement the minimal change.
4. Run the focused verification command.
5. Update `.hermes/project-status.md` with result and next action.

**Verification:** 写 DB schema plan，不急实现。

### Task 4: 实现 CLI adapter spike

**Objective:** Node 后端安全执行白名单 CLI，捕获 stdout JSON、stderr、exit code。

**Files:**
- Modify/Create project-specific files identified during the task.
- Update tests or fixtures for the changed contract.

**Steps:**
1. Inspect the current implementation and write down exact files touched.
2. Add or update the smallest contract/test fixture first.
3. Implement the minimal change.
4. Run the focused verification command.
5. Update `.hermes/project-status.md` with result and next action.

**Verification:** 测试 fake CLI。

### Task 5: 实现 artifact viewer plan

**Objective:** 前端展示 manifest、counts、errors、next action。

**Files:**
- Modify/Create project-specific files identified during the task.
- Update tests or fixtures for the changed contract.

**Steps:**
1. Inspect the current implementation and write down exact files touched.
2. Add or update the smallest contract/test fixture first.
3. Implement the minimal change.
4. Run the focused verification command.
5. Update `.hermes/project-status.md` with result and next action.

**Verification:** 设计页面，不直接解析模块内部日志。

### Task 6: 端到端 PoC

**Objective:** 用 sample artifacts 串 web_listening -> doc_to_md -> md_to_rag -> rag_to_agent。

**Files:**
- Modify/Create project-specific files identified during the task.
- Update tests or fixtures for the changed contract.

**Steps:**
1. Inspect the current implementation and write down exact files touched.
2. Add or update the smallest contract/test fixture first.
3. Implement the minimal change.
4. Run the focused verification command.
5. Update `.hermes/project-status.md` with result and next action.

**Verification:** 浏览器 smoke 关键交互。


---

## Acceptance Criteria

- A Codex worker can understand this repo's boundary from `AGENTS.md`.
- A future implementation branch can start from this plan without needing cross-chat context.
- The module's input/output contract is explicit enough for the next module in the chain.
- All new behavior is testable through CLI commands and fixture manifests.

## Recommended First PR

Start with documentation/contracts and fixture-only changes. Do not implement all runtime behavior in the first PR. The first PR should make the intended contract reviewable before code follows.
