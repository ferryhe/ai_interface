# Knowledge Builder mission demo

This demo shows the end-to-end `knowledge_builder` mission flow for the user request:

> 把我批准的网页和文档资料做成一个可问答的知识库 Agent。

It uses the existing built-in agent and skill manifests:

- `knowledge_builder`
- `web_listening`
- `doc_to_md`
- `md_to_rag`
- `rag_to_agent`

The demo fixture lives at [`docs/contracts/fixtures/knowledge-builder-mission.json`](../contracts/fixtures/knowledge-builder-mission.json).

## What this demo proves

- Mission intake can be framed around a concrete business request.
- The draft plan can show optional source-collection work and required knowledge-building work.
- Approval gates are visible before risky actions:
  - network access for approved web fetches
  - retrieval/database writes for RAG ingestion
- Delivery includes both the generated agent config and traceable intermediate artifacts.
- A QA reviewer role can verify completeness before handoff.

## Expected draft plan structure

1. **Source Collector** role
   - Optional `web_listening`
   - Optional `doc_to_md`
2. **Knowledge Builder** role
   - Required `md_to_rag`
   - Required `rag_to_agent`
3. **QA Reviewer** role
   - Confirms artifact completeness and source traceability
4. **Approvals**
   - Network access requires approval
   - Write DB / retrieval-store access requires approval
5. **Delivery**
   - Generated agent config
   - Source snapshots / converted Markdown / RAG-ready artifacts

## Walkthrough

### 1. Intake

Submit a mission request to the API:

```bash
curl -X POST http://127.0.0.1:3001/api/missions \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "把我批准的网页和文档资料做成一个可问答的知识库 Agent。",
    "agentId": "knowledge_builder",
    "enabledSkillIds": ["web_listening", "doc_to_md", "md_to_rag", "rag_to_agent"],
    "reviewMode": "draft_for_review"
  }'
```

This demo fixture represents the kind of reviewed draft plan the Mission Center should present after intake.

### 2. Plan review

Open the mission in Mission Center / Plan Review and confirm the draft plan contains:

- a `source_collector` role for gathering approved web and document sources
- a `knowledge_builder` role for RAG ingestion and agent generation
- a `qa_reviewer` role for final verification
- approval gates before `web_listening` and `md_to_rag`

### 3. Approval gates

The fixture intentionally pauses before these risky actions:

- `collect-approved-web-sources` waits for **network approval**
- `build-rag-corpus` waits for **database/retrieval write approval**

This keeps the workflow aligned with the built-in `knowledge_builder` agent permissions, which already declare approval, network, and DB-write capability.

### 4. Execution board

After approvals, Execution Board should tell a coherent story:

- Source Collector gathers approved web pages and converts local docs
- Knowledge Builder writes the RAG corpus and emits the agent config
- QA Reviewer checks that every delivery artifact points back to approved sources

### 5. Delivery artifacts

A successful demo should leave behind inspectable artifacts such as:

- approved web snapshots or fetch outputs
- converted Markdown documents
- RAG ingest outputs with source metadata
- generated agent configuration for the Q&A knowledge agent
- QA notes confirming completeness and traceability

## Smoke-test coverage

`artifacts/api-server/src/mission/knowledge-builder-demo.test.ts` validates that:

- the fixture conforms to the `MissionPlan` contract
- the role/skill layout matches the expected scenario
- approval gates cover network access and DB writes
- the built-in `knowledge_builder` agent manifest still advertises the required optional/required skills and approval-sensitive permissions

## Suggested commands

```bash
corepack pnpm --filter @workspace/api-server run test -- src/mission/knowledge-builder-demo.test.ts
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --dir artifacts/mockup-sandbox run build
```
