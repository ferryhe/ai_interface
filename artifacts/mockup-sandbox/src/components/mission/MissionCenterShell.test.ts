import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shellSource = readFileSync(new URL("./MissionCenterShell.tsx", import.meta.url), "utf8");
const portalSource = readFileSync(new URL("./MissionPortal.tsx", import.meta.url), "utf8");
const agentStatusSource = readFileSync(new URL("./AgentStatusCard.tsx", import.meta.url), "utf8");
const approvalSummarySource = readFileSync(new URL("./ApprovalSummary.tsx", import.meta.url), "utf8");
const executionBoardSource = readFileSync(new URL("./ExecutionBoard.tsx", import.meta.url), "utf8");
const approvalInboxSource = readFileSync(new URL("../approvals/ApprovalInbox.tsx", import.meta.url), "utf8");

function compact(source: string): string {
  return source.replace(/\s+/g, " ");
}

test("mission center shell delegates to the pure mission portal", () => {
  assert.match(shellSource, /import \{ MissionPortal \} from "\.\/MissionPortal"/);
  assert.match(shellSource, /<MissionPortal \/>/);
  assert.doesNotMatch(shellSource, /onOpenBackstage|onOpenOperator|TabsTrigger|ApprovalInbox/);
});

test("mission portal remains a pure frontstage task loop", () => {
  assert.doesNotMatch(portalSource, /from "@\/components\/ui\/tabs"/);
  assert.doesNotMatch(portalSource, /<Tabs\b|<TabsList\b|<TabsTrigger\b|<TabsContent\b/);
  assert.doesNotMatch(portalSource, /setActiveTab\("backstage"\)/);
  assert.doesNotMatch(portalSource, /onOpenBackstage|onOpenOperator/);
  assert.doesNotMatch(portalSource, /#approval-inbox/);
  assert.match(portalSource, /<MissionIntake\b/);
  assert.match(portalSource, /<PlanReview\b/);
  assert.match(portalSource, /<ExecutionBoard[\s\S]*missionId=\{missionId\}[\s\S]*requestHeaders=\{portalRequestHeaders\}/);
  assert.match(portalSource, /<MissionPortalProgress\b/);
});

test("mission portal mounts only current-mission approval actions", () => {
  assert.match(portalSource, /@\/components\/approvals\/ApprovalInbox/);
  assert.match(portalSource, /<ApprovalInbox[\s\S]*missionId=\{missionId \?\? undefined\}/);
  assert.match(portalSource, /<ApprovalInbox[\s\S]*requestHeaders=\{portalRequestHeaders\}/);
  assert.match(portalSource, /id="mission-approval-inbox"/);
  assert.doesNotMatch(portalSource, /endpoint=\{"\/api\/approvals"\}/);
});

test("mission portal token revocation clears cached mission state", () => {
  assert.match(portalSource, /function resetPortalSessionState\(\): void \{[\s\S]*setDraft\(""\);[\s\S]*setBundle\(null\);[\s\S]*setExecuteResult\(null\);[\s\S]*setExecutionReadiness\(null\);/);
  assert.match(portalSource, /function handlePortalRuntimeDenied\(response: Response\): boolean \{[\s\S]*resetPortalSessionState\(\);[\s\S]*setPortalAccessState\("invalid_token"\);/);
  assert.match(portalSource, /if \(!cleanToken\) \{[\s\S]*resetPortalSessionState\(\);[\s\S]*setPortalAccessState\("missing_token"\);/);
});

test("mission board and approval refreshes propagate portal token revocation", () => {
  assert.match(portalSource, /<ExecutionBoard[\s\S]*onRuntimeAccessDenied=\{handlePortalRuntimeDenied\}/);
  assert.match(portalSource, /<ApprovalInbox[\s\S]*onRuntimeAccessDenied=\{handlePortalRuntimeDenied\}/);
});

test("mission runtime execution and approval decisions refresh runtime panels", () => {
  assert.match(portalSource, /const \[boardRefreshNonce, setBoardRefreshNonce\] = useState\(0\);/);
  assert.match(portalSource, /async function handleExecute\(mode: MissionExecutionMode\): Promise<void> \{[\s\S]*setExecuteResult\(data\);[\s\S]*setExecutionReadiness\(data\.executionReadiness\);[\s\S]*setBoardRefreshNonce\(\(value\) => value \+ 1\);/);
  assert.match(portalSource, /async function handleApprovalDecisionSettled\(decision: "approve" \| "reject"\): Promise<void> \{/);
  assert.match(portalSource, /setBoardRefreshNonce\(\(value\) => value \+ 1\);/);
  assert.match(portalSource, /const refreshed = missionId \? await refreshMission\(missionId\) : null;/);
  assert.match(portalSource, /hasPendingMissionApprovals\(missionId\)/);
  assert.match(portalSource, /const missionStatus = refreshed\?\.mission\.status \?\? bundle\?\.mission\.status;/);
  assert.match(portalSource, /readinessStatusAfterApprovalDecision\([\s\S]*decision,[\s\S]*missionStatus,[\s\S]*hasPendingApprovals/);
  assert.match(portalSource, /readinessMessageAfterApprovalDecision\(decision, missionStatus, hasPendingApprovals\)/);
  assert.match(portalSource, /if \(missionStatus === "completed"\) return t\("missionCenter\.runtimeCompletedStatus"\);/);
  assert.match(portalSource, /setExecutionReadiness\(\{[\s\S]*ready: decision === "approve" && readinessStatus !== "failed",[\s\S]*status: readinessStatus/);
  assert.match(portalSource, /if \(hasPendingApprovals\) return "needs_approval";/);
  assert.doesNotMatch(portalSource, /status: decision === "approve" \? "completed" : "failed"/);
  assert.match(portalSource, /<ExecutionBoard[\s\S]*refreshSignal=\{boardRefreshNonce\}/);
  assert.match(portalSource, /<ApprovalInbox[\s\S]*refreshSignal=\{boardRefreshNonce\}/);
  assert.match(portalSource, /<ApprovalInbox[\s\S]*onDecisionSettled=\{handleApprovalDecisionSettled\}/);
});

test("approval inbox notifies parent surfaces after decisions complete", () => {
  const source = compact(approvalInboxSource);
  assert.match(source, /refreshSignal\?: number;/);
  assert.match(source, /onDecisionSettled\?: \(decision: "approve" \| "reject"\) => void \| Promise<void>;/);
  assert.match(source, /useEffect\(\(\) => \{ void loadApprovals\(\); }, \[loadApprovals, refreshSignal\]\);/);
  assert.match(source, /await loadApprovals\(\); await onDecisionSettled\?\.\(decision\);/);
});

test("execution board refetches when parent refresh signal changes", () => {
  const source = compact(executionBoardSource);
  assert.match(source, /refreshSignal, }: \{ missionId: string \| null; requestHeaders\?: Record<string, string>; onRuntimeAccessDenied\?: \(response: Response\) => void; refreshSignal\?: number; \}/);
  assert.match(source, /useEffect\(\(\) => \{ void loadBoard\(\); }, \[loadBoard, refreshSignal\]\);/);
});

test("portal token revocation handlers return before local error state updates", () => {
  assert.match(executionBoardSource, /onRuntimeAccessDenied\(response\);\s*return;/);
  assert.match(approvalInboxSource, /onRuntimeAccessDenied\(response\);\s*return;/);
});

test("mission board approval links stay scoped to actionable current mission approvals", () => {
  assert.match(approvalSummarySource, /id="mission-approval-points"/);
  assert.match(agentStatusSource, /href="#mission-approval-inbox"/);
  assert.doesNotMatch(agentStatusSource, /#approval-inbox/);
});
