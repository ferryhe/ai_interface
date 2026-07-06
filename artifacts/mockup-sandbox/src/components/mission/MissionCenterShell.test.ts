import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shellSource = readFileSync(new URL("./MissionCenterShell.tsx", import.meta.url), "utf8");
const portalSource = readFileSync(new URL("./MissionPortal.tsx", import.meta.url), "utf8");
const agentStatusSource = readFileSync(new URL("./AgentStatusCard.tsx", import.meta.url), "utf8");
const approvalSummarySource = readFileSync(new URL("./ApprovalSummary.tsx", import.meta.url), "utf8");

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

test("mission board approval links stay scoped to actionable current mission approvals", () => {
  assert.match(approvalSummarySource, /id="mission-approval-points"/);
  assert.match(agentStatusSource, /href="#mission-approval-inbox"/);
  assert.doesNotMatch(agentStatusSource, /#approval-inbox/);
});
