# ai_interface User Guide

This guide is for two audiences:

- **Frontend users** use Mission Center or the End-user Portal to submit goals, review plans, approve actions, and inspect results.
- **Backstage/operators** use Backstage and Operator Backstage to inspect Agents, Skills, runs, artifacts, approvals, publish settings, and manifests. Backstage work must preserve traceable evidence because runtime state, APIs, the database, and logs are the system of record.

Chinese version: [`userguide.zh.md`](userguide.zh.md)

## 1. Local Startup

Start the API server in PowerShell. The API server requires `PORT`; because the current `@workspace/api-server` `dev` script uses Bash-style `export`, use build + start in PowerShell:

```powershell
$env:PORT="3001"
$env:NODE_ENV="development"
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run start
```

If you use Git Bash / WSL / Bash, you can run:

```bash
PORT=3001 corepack pnpm --filter @workspace/api-server run dev
```

Start the frontend preview in another PowerShell:

```powershell
$env:PORT="8080"
$env:BASE_PATH="/"
$env:VITE_DEFAULT_PREVIEW="ai-os/AgentFirstInterface"
corepack pnpm --dir artifacts/mockup-sandbox run dev
```

Open:

```text
http://127.0.0.1:8080/preview/ai-os/AgentFirstInterface
```

The API examples below assume `PORT=3001`. If you start the API with a different `$env:PORT` / `PORT`, use that same port in every API URL.

## 2. Frontend Flow: Mission Center

Mission Center is the default path for normal users. Users describe a business goal, then review the generated plan before execution.

### 2.1 Submit a Mission

1. Open the AgentFirst page.
2. Stay in Mission Center.
3. Enter a business goal, for example:

```text
Build a question-answering knowledge-base Agent from my approved web pages and documents.
```

4. Submit the mission.

Expected result:

- The page generates a Mission Plan.
- The plan shows roles, steps, dependencies, risk, and approval gates.
- For `knowledge_builder`, the plan typically uses `web_listening`, `doc_to_md`, `md_to_rag`, and `rag_to_agent`.

### 2.2 Review the Plan

1. Read the plan summary and confirm the goal is understood.
2. Check step order and dependencies.
3. Review approval-sensitive actions:
   - network access, such as fetching approved web pages
   - database or retrieval-store writes, such as building a RAG corpus
   - high-impact business decisions, such as underwriting, claims, compliance, and filings
4. Revise the plan if it is wrong.
5. Confirm the plan if it is correct.

Plan approval does not start execution. The product intentionally separates `approve` from `execute` so high-risk work is not triggered accidentally.

### 2.3 Execute the Mission

1. After plan approval, choose execute.
2. Open the Execution Board.
3. Handle approval-required steps one by one.
4. Watch step status:
   - `pending`
   - `running`
   - `approval_required`
   - `succeeded`
   - `failed`
   - `blocked`

Expected result:

- Each step has inspectable events and artifacts.
- QA or review steps explain whether delivery requirements were met.
- Final deliverables can be traced back to source inputs and intermediate artifacts.

### 2.4 Inspect Delivery in Portal

Frontend users mainly inspect:

| Area | Purpose |
|---|---|
| Chat / Agent replies | Understand current progress and next actions |
| Steps / Execution Board | See step status and blockers |
| Data / Sources / Result | Inspect sources, records, outputs, and traceability |

If the mission is published to Portal, click **View Portal** in AgentFirst or open:

```text
/preview/ai-os/AgentPortalInterface?token=portal-demo-token
```

Portal is the end-user surface for progress, feedback, approvals, and requested data.

## 3. Backstage and Operator Flow

Backstage is for governance, debugging, and release checks. Every backstage action should answer:

- Is the configuration actually runnable?
- Is the result auditable, reproducible, and explainable?

### 3.1 Open Backstage

1. Open AgentFirst.
2. Click **Backstage**.
3. Inspect Agents, Skills, Runs, and Artifacts.

Why:

- Mission Center is a business view; Backstage is the system-of-record view.
- Agent bindings, skill readiness, events, outputs, and artifacts must be verified in Backstage.

Acceptance checks:

- Agents show `runtimeStatus`, `teamId`, nine-segment definitions, and bound skills.
- Skills show execution kind, required env, permissions, and readiness.
- Runs show runtime I/O, events, approval state, and errors.
- Artifacts show intermediate and final outputs.

### 3.2 Inspect Agent Configuration

1. Open Agents in Backstage.
2. Select an Agent, such as `knowledge_builder`.
3. Check:
   - `runtimeStatus` is `runnable`.
   - `teamId` is correct.
   - Bound skills match the mission goal.
   - `identity`, `criticalRules`, `deliverables`, `workflow`, `communicationStyle`, and `successMetrics` are complete.
   - Permissions declare approval, network, database-write, and other high-risk capabilities.

Why:

- `runtimeStatus: runnable` means the Agent can run; `template` means it is a design template.
- `teamId` supports team ownership and filtering.
- Nine-segment definitions define business boundaries, not just prompts.
- Permissions determine which steps need human approval.

### 3.3 Inspect Skill Readiness

1. Open Skills in Backstage.
2. Select a skill, such as `web_listening` or `doc_to_md`.
3. Check:
   - `execution.kind`
   - `adapterId`
   - `requiredEnv`
   - `optionalEnv`
   - `readinessHint`
   - `permissions`
   - `inputSchema` and `outputSchema`

Why:

- Skills are the executable units. Agents define role and orchestration, but actual work runs through skill adapters.
- Missing required env makes a skill not ready; it must not be treated as successfully executed.
- Input/output schemas define contracts between steps.
- Permissions clarify which actions need approval.

### 3.4 Inspect Runs and Artifacts

1. Open Runs in Backstage.
2. Select the mission or pipeline run.
3. Inspect each module run:
   - input JSON
   - output JSON
   - runtime events
   - tool interaction / feedback / resume state
   - skipped or failed reasons
4. Open related Artifacts.

Why:

- Run records are the audit trail.
- If the frontend says a step is complete, Backstage must show the evidence.
- If a step fails or is skipped, operators need to identify whether the cause is permissions, env, external service state, or bad input.

### 3.5 Use Operator Backstage

1. Click **Operator**.
2. Review manifest lists and details.
3. Inspect custom manifests in read-only mode.
4. Mutate custom manifests only when local protected write mode allows it.
5. After a manifest change, rerun validation and focused tests.

Why:

- Operator is a governance surface, not a normal user path.
- Built-in and community manifests should remain read-only by default.
- Custom manifest changes can alter permissions, tools, data flow, and approval gates.

### 3.6 Publish Portal

1. Check Portal settings in AgentFirst publish controls.
2. Confirm publish status.
3. Set or rotate the Portal token.
4. Open the Portal URL.
5. Test desktop and mobile language switching, steps, data, sources, and results.

Why:

- Portal is the end-user surface and must stay isolated from backstage governance.
- Portal tokens should not grant backstage permissions.
- Mobile entry and language switching are real user paths and must be verified before release.

## 4. Simple Skill Definitions

The easiest built-in skill examples are source collection and document conversion.

### 4.1 Source Collection: `web_listening`

File:

```text
skills/builtin/web_listening/skill.yaml
```

Purpose:

- Monitor web pages.
- Create snapshots.
- Extract text.
- Detect changes.

Key fields:

| Field | Current value | Meaning |
|---|---|---|
| `skillId` | `web_listening` | Skill ID |
| `moduleId` | `web_listening` | Runtime module ID |
| `category` | `source` | Source collection skill |
| `execution.kind` | `cli` | Runs through a CLI adapter |
| `adapterId` | `web_listening.cli.v1` | Tool adapter |
| `requiredEnv` | `WEB_LISTENING_CLI_PATH` | Required CLI path |
| `optionalEnv` | `WEB_LISTENING_WORKDIR`, `WEB_LISTENING_API_BASE_URL` | Optional workdir/API URL |
| `permissions.canUseNetwork` | `true` | Uses network access |
| `permissions.approvalRequired` | `true` | Requires approval |

Inputs:

- `siteUrl`
- `monitoringGoal`
- `stage`

Outputs:

- `manifest`
- `snapshots`
- `events`

Artifact kinds:

- `web_snapshot`
- `extracted_text`
- `change_event`

Use when a mission needs to collect approved web pages, public notices, documentation sites, or regulatory pages. Network access must be approved first.

### 4.2 Document Conversion: `doc_to_md`

File:

```text
skills/builtin/doc_to_md/skill.yaml
```

Purpose:

- Convert source documents into Markdown.
- Preserve conversion warnings.
- Extract document assets.
- Produce traceable conversion metadata.

Key fields:

| Field | Current value | Meaning |
|---|---|---|
| `skillId` | `doc_to_md` | Skill ID |
| `moduleId` | `doc_to_md` | Runtime module ID |
| `category` | `transform` | Transformation skill |
| `execution.kind` | `http` | Runs through an HTTP adapter |
| `adapterId` | `doc_to_md.http.v1` | Tool adapter |
| `requiredEnv` | `DOC_TO_MD_API_BASE_URL` | Required conversion service URL |
| `optionalEnv` | `DOC_TO_MD_API_TOKEN` | Optional API token |
| `ui.mode` | `renderer` | Frontend can render Markdown output |

Inputs:

- `sourceArtifactIds`
- `engine`
- `includeAssets`

Outputs:

- `markdown`
- `quality`
- `trace`
- `assets`

Artifact kinds:

- `markdown_document`
- `conversion_warning`
- `document_asset`

Use when source material needs to become Markdown before review, indexing, or RAG ingestion.

## 5. Demo: Knowledge Builder

Demo doc:

```text
docs/demos/knowledge-builder-mission.md
```

Fixture:

```text
docs/contracts/fixtures/knowledge-builder-mission.json
```

Typical goal:

```text
Build a question-answering knowledge-base Agent from my approved web pages and documents.
```

Typical flow:

| Stage | Skill | Purpose | High risk |
|---|---|---|---|
| Collect web sources | `web_listening` | Fetch approved pages and changes | Yes, network |
| Convert documents | `doc_to_md` | Convert documents to Markdown | Depends on input |
| Build knowledge base | `md_to_rag` | Write retrievable corpus | Yes, DB/retrieval write |
| Generate Agent | `rag_to_agent` | Generate QA Agent config | Yes, affects delivery |
| QA review | mission QA | Verify completeness and source traceability | Yes, affects release |

Frontend users see the business goal, plan, and result. Backstage users verify input, output, events, and artifacts for every step.

## 6. Life Insurance Agent Case

Dedicated bilingual case doc:

```text
docs/demos/life-insurance-case.md
```

Existing template overview:

```text
docs/demos/life-insurance-agents.md
```

Agent files:

```text
agents/custom/pricing_actuary/agent.yaml
agents/custom/life_uw_analyst/agent.yaml
agents/custom/claims_reviewer/agent.yaml
agents/custom/compliance_auditor/agent.yaml
```

Current state:

```yaml
source: custom
runtimeStatus: template
teamId: insurance
skills: []
```

Meaning:

- These are industry templates, not production runnable Agents.
- `teamId: insurance` enables `GET /api/agents?teamId=insurance`.
- `runtimeStatus: template` means they should not be treated as production execution agents.
- `skills: []` means no real tools are bound yet.

Evaluation: an insurance company case should not be configured as only Agents. A runnable configuration needs:

- **Agent**: role, rules, deliverables, communication style, and success metrics.
- **Skill/Tool**: policy lookup, document conversion, pricing model execution, underwriting rules, claims evidence checks, compliance rule lookup, and similar execution capabilities.
- **Workflow**: ordered steps, dependencies, handoffs, and QA.
- **Approval**: human signoff for underwriting, claims liability, filings, and major assumptions.
- **Data contract**: inputs, outputs, artifact kinds, events, and error handling.

So the four current life-insurance Agents are the template layer. The execution layer still needs skill manifests and mission/workflow design.

## 7. Common API Checks

List all Agents:

```bash
curl http://127.0.0.1:3001/api/agents
```

List insurance-team Agents:

```bash
curl "http://127.0.0.1:3001/api/agents?teamId=insurance"
```

List template Agents:

```bash
curl "http://127.0.0.1:3001/api/agents?runtimeStatus=template"
```

List insurance template Agents:

```bash
curl "http://127.0.0.1:3001/api/agents?teamId=insurance&runtimeStatus=template"
```

Submit a Knowledge Builder mission:

```bash
curl -X POST http://127.0.0.1:3001/api/missions \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Build a question-answering knowledge-base Agent from my approved web pages and documents.",
    "agentId": "knowledge_builder",
    "enabledSkillIds": ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
    "reviewMode": "draft_for_review"
  }'
```

## 8. Acceptance Checklist

Frontend:

- Mission Center can submit a mission.
- The plan shows roles, steps, approvals, and risk.
- Plan approval does not automatically execute.
- Execution shows step status and results.
- Portal works on desktop and mobile.
- English/Chinese language switching works.

Backstage:

- Agents show `runtimeStatus`, `teamId`, and nine-segment definitions.
- Skills show adapter, required env, permissions, and schemas.
- Runs show inputs, outputs, events, approvals, and errors.
- Artifacts are traceable to sources.
- Operator can inspect manifests and only mutates custom manifests in protected local mode.
- Life-insurance templates stay `runtimeStatus: template` until real skills and focused tests are added.
