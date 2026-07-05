# API Surface Matrix

This matrix is the PR1 contract baseline for the Mission Portal / Backstage consolidation work. It separates the actual Express route inventory from the product surface that is allowed to call each route.

## Surface definitions

| Surface | Meaning | Product rule |
| --- | --- | --- |
| `frontstage` | Ordinary Mission Portal user flow | May call only mission-scoped task, board, approval, run-summary, and artifact-read APIs exposed by the frontstage facade. |
| `portal-runtime` | Public/token Mission Portal mode | Uses `X-AI-Interface-Surface: agent-portal` plus `X-Portal-Token` or `Authorization: Bearer ...`; access must be scoped to allowed mission/runtime-read resources. |
| `backstage` | Operator/admin inspection UI | Can inspect runs, artifacts, agents, skills, teams, and readiness metadata. |
| `admin` | Configuration and manifest governance | Sensitive writes/reads such as provider/model config and manifest writers; must not be reachable from ordinary frontstage or portal mode. |
| `internal` | Runtime orchestration and local command surfaces | Called by backend workflow/runtime code, or guarded local tooling; not a direct ordinary user surface. |
| `health` | Operational liveness | Must not expose secrets, local paths, provider configuration, or manifest contents. |

## Route inventory

| Method | Path | Surface | Permission / guard notes |
| --- | --- | --- | --- |
| GET | `/api/agent-config` | `admin` | Sensitive config read; PR2 must prevent ordinary frontstage default loads. |
| PUT | `/api/agent-config` | `admin` | Sensitive config write; must carry audit reason and admin/local guard in PR2. |
| POST | `/api/agent-config/test-connection` | `admin` | Diagnostic only; must not leak secrets. |
| POST | `/api/agent-manifests` | `admin` | Guarded writer: `AI_INTERFACE_MANIFEST_WRITE_MODE=custom`, localhost, same-origin. |
| POST | `/api/agent-runs` | `internal`, `portal-runtime` | Runtime planning endpoint; portal-origin requests require verified Portal token. |
| GET | `/api/agent-runs/{pipelineRunId}` | `backstage`, `portal-runtime` | Runtime read; portal mode must remain mission/permission scoped. |
| GET | `/api/agents` | `backstage` | Capability registry read; not ordinary frontstage chrome. |
| GET | `/api/agents/{agentId}/export/vscode-agent` | `backstage` | Export metadata only; redacts provider internals and local paths. |
| GET | `/api/agents/{agentId}/export/mcp-tool` | `backstage` | Export metadata only; redacts provider internals and local paths. |
| GET | `/api/approvals` | `backstage`, target `frontstage`, `portal-runtime` facade | Current route returns the global pending list; frontstage must filter to mission-scoped/allowed approvals. |
| POST | `/api/approvals/{approvalId}/approve` | target `frontstage`, `portal-runtime` facade | Current route approves projected runtime approvals; facade must restrict visible/actionable approvals. |
| POST | `/api/approvals/{approvalId}/reject` | target `frontstage`, `portal-runtime` facade | Same scoping requirement as approve. |
| GET | `/api/climate-monitor/status` | `internal`, `admin` | Local workflow status; redacted. |
| POST | `/api/climate-monitor/runs` | `internal` | Requires command-intent header and local/same-origin guard; not frontstage. |
| GET | `/api/healthz` | `health` | Liveness only. |
| POST | `/api/missions` | `frontstage`, `portal-runtime` | Mission intake; portal-origin requests require verified Portal token. |
| GET | `/api/missions/{missionId}` | `frontstage`, `portal-runtime` | Mission detail; portal-origin requests require verified Portal token. |
| GET | `/api/missions/{missionId}/board` | `frontstage`, `portal-runtime` | Mission board/readiness summary; portal-origin requests require verified Portal token. |
| POST | `/api/missions/{missionId}/revise` | `frontstage`, `portal-runtime` | Revision update; plan revision conflict must be explicit. |
| POST | `/api/missions/{missionId}/approve` | `frontstage`, `portal-runtime` | Locks an approved plan revision. |
| POST | `/api/missions/{missionId}/execute` | `frontstage`, `portal-runtime` | Current implementation returns stubbed `executionReadiness`; real runtime orchestration is PR7. |
| GET | `/api/modules` | `backstage`, `internal` | Runtime catalog/readiness; not ordinary frontstage chrome. |
| POST | `/api/module-runs` | `internal` | Runtime ingest surface. |
| GET | `/api/module-runs/{runId}` | `backstage`, `portal-runtime` | Runtime detail read; portal mode must be mission scoped. |
| PATCH | `/api/module-runs/{runId}` | `internal` | Runtime status/update surface. |
| POST | `/api/module-runs/{runId}/events` | `internal` | Event append surface. |
| POST | `/api/module-runs/{runId}/artifacts` | `internal` | Artifact append surface. |
| POST | `/api/module-runs/{runId}/interactions` | `internal` | Human/approval/data interaction request surface. |
| POST | `/api/module-runs/{runId}/feedback` | `internal`, target `frontstage` facade | Feedback write; frontstage must only use controlled approval/interaction flows. |
| POST | `/api/module-runs/{runId}/resume` | `internal`, target `frontstage` facade | Resume write; frontstage must reference a waiting interaction. |
| GET | `/api/artifacts/{artifactId}` | `backstage`, `portal-runtime` | Artifact read; portal mode must be mission scoped. |
| POST | `/api/pipelines/runs` | `internal` | Requires command intent and local/same-origin guard. |
| GET | `/api/pipelines/runs` | `backstage`, `internal` | Local run list; may contain local artifact metadata. |
| GET | `/api/pipelines/runs/{runId}` | `backstage`, `internal` | Local run detail; may contain local artifact metadata. |
| POST | `/api/portal-auth/verify` | `portal-runtime` | Entry token verification only; not the full Portal runtime. |
| GET | `/api/runs` | `backstage`, `frontstage` summary facade | Run inspector list; frontstage should consume only mission summary fields. |
| GET | `/api/runs/{pipelineRunId}/timeline` | `backstage`, `frontstage` summary facade | Timeline read; portal/frontstage must remain mission scoped. |
| GET | `/api/artifacts` | `backstage`, `frontstage` summary facade | Artifact list; frontstage must use mission/run filters. |
| GET | `/api/skills` | `backstage` | Skill registry/readiness; not ordinary frontstage chrome. |
| POST | `/api/skill-manifests` | `admin` | Guarded writer: `AI_INTERFACE_MANIFEST_WRITE_MODE=custom`, localhost, same-origin. |
| GET | `/api/teams` | `backstage` | Derived team/agent registry read. |
| GET | `/api/tool-adapters` | `backstage` | Adapter metadata and redacted readiness only. |

## PR1 guardrails

- OpenAPI must document all 42 Express routes.
- `@workspace/api-zod` and `@workspace/api-client-react` must be regenerated from the updated spec.
- `Portal` is a cross-route runtime surface. `/api/portal-auth/verify` is only token verification.
- `POST /api/missions/{missionId}/execute` remains stubbed readiness until the production runtime PR connects pipeline/module/agent orchestration.
- `/api/approvals` is currently global. Mission-scoped approval filtering is a facade target, not a current guarantee.
