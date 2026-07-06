import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AgentFirstInterface.tsx", import.meta.url), "utf8");
test("agent-first default mission load does not request admin config surfaces", () => {
  assert.match(
    source,
    /const \[workspaceMode, setWorkspaceMode\] = useState<WorkspaceMode>\("mission"\);/,
  );
  assert.match(
    source,
    /const \[activeView, setActiveView\] = useState<AppView>\("agent"\);/,
  );
  assert.match(
    source,
    /const shouldLoadWorkbenchIndexes =\s*workspaceMode === "backstage";/,
  );
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*fetch\("\/api\/agents"\)/);
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*fetch\("\/api\/skills"\)/);
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*fetch\("\/api\/runs\?limit=20"\)/);
  assert.match(source, /if \(!shouldLoadWorkbenchIndexes\) return;[\s\S]*`\/api\/artifacts\?pipelineRunId=/);
  assert.match(
    source,
    /const shouldLoadAdminConfig =\s*workspaceMode === "backstage" && workbenchTab === "settings";/,
  );
  assert.match(source, /if \(!shouldLoadAdminConfig\) return;/);
  assert.doesNotMatch(source, /adminConfigLoadStateRef|adminConfigLoadedRef/);
  assert.match(source, /const configDraftDirtyRef = useRef\(false\);/);
  assert.match(source, /const publishDraftDirtyRef = useRef\(false\);/);
  assert.match(source, /const hasLoadedAdminConfigRef = useRef\(false\);/);
  assert.match(source, /const lastLoadedAgentConfigRef = useRef<AgentConfigDraft>/);
  assert.match(source, /const lastLoadedPublishSettingsRef = useRef<PublishSettingsApi>/);
  assert.doesNotMatch(source, /if \(configDraftDirtyRef\.current \|\| publishDraftDirtyRef\.current\) return;/);
  assert.match(source, /const hasDirtyConfig = configDraftDirtyRef\.current;/);
  assert.match(source, /mergeConfigDraftFromServer\(baselineConfig, current, serverConfig\)/);
  assert.match(source, /function mergeDraftObjectByField/);
  assert.match(source, /mergeDraftObjectByField\(baselineItem, currentItem, serverItem\)/);
  assert.match(source, /const serverKeys = new Set\(server\.map\(keyOf\)\);/);
  assert.match(source, /if \(!baselineItem \|\| draftChanged\(baselineItem, currentItem\)\)/);
  assert.match(source, /memorySettings: mergeDraftObjectByField\([\s\S]*baseline\.memorySettings,[\s\S]*current\.memorySettings,[\s\S]*server\.memorySettings/);
  assert.match(source, /safetySettings: mergeDraftObjectByField\([\s\S]*baseline\.safetySettings,[\s\S]*current\.safetySettings,[\s\S]*server\.safetySettings/);
  assert.match(source, /mergePublishSettingsFromServer\([\s\S]*baselinePublishSettings,[\s\S]*current,[\s\S]*serverPublishSettings/);
  assert.match(source, /async function saveAgentConfig[\s\S]*const baselinePublishSettings = \{ \.\.\.lastLoadedPublishSettingsRef\.current \};/);
  assert.match(source, /async function saveAgentConfig[\s\S]*const hasDirtyPublish = publishDraftDirtyRef\.current;[\s\S]*mergePublishSettingsFromServer\([\s\S]*baselinePublishSettings,[\s\S]*current,[\s\S]*serverPublishSettings/);
  assert.doesNotMatch(source, /if \(workspaceMode === "backstage"\) return;[\s\S]*configDraftDirtyRef\.current = false;[\s\S]*publishDraftDirtyRef\.current = false;/);
  assert.match(source, /function discardSettingsDrafts\(\): void[\s\S]*setAgentConfig\(toConfigDraft\(lastLoadedAgentConfigRef\.current\)\)/);
  assert.match(source, /function discardSettingsDrafts\(\): void[\s\S]*setPublishSettings\(\{ \.\.\.lastLoadedPublishSettingsRef\.current \}\)/);
  assert.match(source, /setAdminConfigReloadNonce\(\(current\) => current \+ 1\)/);
  assert.match(source, /onDiscardSettingsDrafts=\{discardSettingsDrafts\}/);
  assert.match(source, /function updatePublishTokenDraft\(token: string\): void[\s\S]*setPublishSaveState\("local"\);[\s\S]*unsavedLocalPublishSettings/);
  assert.match(source, /onUpdateTokenDraft=\{updatePublishTokenDraft\}/);
  assert.match(source, /async function savePublishSettings[\s\S]*publishDraftDirtyRef\.current = true;[\s\S]*setPublishSaveState\("saving"\)/);
  assert.match(source, /async function savePublishSettings[\s\S]*const baselineConfig = toConfigDraft\(lastLoadedAgentConfigRef\.current\);/);
  assert.match(source, /async function savePublishSettings[\s\S]*const hasDirtyConfig = configDraftDirtyRef\.current;[\s\S]*mergeConfigDraftFromServer\(baselineConfig, current, serverConfig\)/);
  assert.match(source, /if \(cancelled\) return;/);
  assert.match(source, /fetch\("\/api\/agent-config"\)/);
});

test("backstage converges governance into one settings entry", () => {
  assert.match(
    source,
    /type WorkbenchTab = "runs" \| "artifacts" \| "agents" \| "skills" \| "teams" \| "approvals" \| "settings";/,
  );
  assert.match(source, /useState<WorkbenchTab>\("runs"\)/);
  assert.match(
    source,
    /\{ id: "runs", labelKey: "agentFirst\.backstage\.tabs\.runs" \},\s*\{ id: "artifacts", labelKey: "agentFirst\.backstage\.tabs\.artifacts" \},\s*\{ id: "agents", labelKey: "agentFirst\.backstage\.tabs\.agents" \},\s*\{ id: "skills", labelKey: "agentFirst\.backstage\.tabs\.skills" \},\s*\{ id: "teams", labelKey: "agentFirst\.backstage\.tabs\.teams" \},\s*\{ id: "approvals", labelKey: "agentFirst\.backstage\.tabs\.approvals" \},\s*\{ id: "settings", labelKey: "agentFirst\.backstage\.tabs\.settings" \}/s,
  );
  assert.doesNotMatch(source, /agentFirst\.workspace\.operator/);
  assert.doesNotMatch(source, /\{ id: "configure", labelKey: "agentFirst\.nav\.configure"/);
  assert.doesNotMatch(source, /\{ id: "publish", labelKey: "agentFirst\.nav\.publish"/);
  assert.doesNotMatch(source, /activeView === "configure"/);
  assert.doesNotMatch(source, /activeView === "publish"/);
  assert.match(source, /workbenchTab === "teams" && \(/);
  assert.match(source, /workbenchTab === "approvals" && \(/);
  assert.match(source, /const workbenchApprovalBlockers = workbenchRuns\.flatMap/);
  assert.match(source, /const stepBlockers = run\.moduleSteps/);
  assert.match(source, /if \(stepBlockers\.length > 0 \|\| !isBlockingWorkbenchStatus\(run\.status\)\)/);
  assert.match(source, /id: `\$\{run\.pipelineRunId\}:pipeline`,/);
  assert.match(source, /moduleId: run\.activeSkillId \?\? "pipeline",/);
  assert.match(source, /function runtimeStatusFromAdapterExecutionStatus\(value: unknown\): RuntimeRunStatus \| null/);
  assert.match(source, /value === "approval_required" \|\| value === "waiting_for_approval"[\s\S]*return "approval_required"/);
  assert.match(source, /if \(value === "waiting_for_user"\) return "waiting_for_user";/);
  assert.match(source, /if \(value === "waiting_for_data"\) return "waiting_for_data";/);
  assert.match(source, /if \(value === "blocked"\) return "blocked";/);
  assert.match(source, /const adapterStatus = runtimeStatusFromAdapterExecutionStatus\([\s\S]*run\.metadata\?\.\["adapterExecutionStatus"\][\s\S]*if \(adapterStatus\) return adapterStatus;[\s\S]*if \(run\.status === "running"\) return "running";/);
  assert.match(source, /const latestRuntimeApprovalBlockers = latestAgentRun/);
  assert.match(source, /const latestRuntimePipelineRunId = latestAgentRun\?\.response\.pipelineRun\.id;/);
  assert.match(source, /const indexedApprovalBlockers = latestRuntimePipelineRunId[\s\S]*workbenchApprovalBlockers\.filter\([\s\S]*blocker\.pipelineRunId !== latestRuntimePipelineRunId/);
  assert.match(source, /const approvalBlockers = uniqueBackstageApprovalBlockers\(\[[\s\S]*\.\.\.latestRuntimeApprovalBlockers,[\s\S]*\.\.\.indexedApprovalBlockers/);
  assert.match(source, /const workbenchRun = toWorkbenchRunFromAgentRun\(data\);[\s\S]*rememberWorkbenchRun\(workbenchRun\);/);
  assert.match(source, /const latestAgentRunAgentId =[\s\S]*latestAgentRun\.response\.pipelineRun\.metadata[\s\S]*nullableString\(latestAgentRun\.response\.pipelineRun\.metadata\["agentId"\]\)/);
  assert.match(source, /agentId: latestAgentRunAgentId \?\? undefined/);
  assert.match(source, /function workbenchStatusFromRuntimeInteraction\([\s\S]*interaction\.status === "resumed"\) return null/);
  assert.match(source, /if \(interaction\.kind === "approval"\) return "approval_required";/);
  assert.match(source, /function workbenchStatusFromToolInteraction\([\s\S]*interaction\.status === "resumed"\) return null/);
  assert.match(source, /interaction\.kind === "approval" \|\| interaction\.status === "waiting_for_approval"/);
  assert.match(source, /const interactionStatus = workbenchStatusFromRuntimeInteraction\(run\.interaction\);[\s\S]*if \(interactionStatus\) return interactionStatus;[\s\S]*if \(run\.status === "resumable"\) return "waiting_for_user";/);
  assert.match(source, /const interactionStatus = workbenchStatusFromToolInteraction\(parseToolInteraction\(run\.metadata\)\);[\s\S]*if \(interactionStatus\) return interactionStatus;/);
  assert.match(source, /activeSkillId: isActiveWorkbenchStatus\(status\) \? run\.moduleId : undefined/);
  assert.match(source, /function workbenchStatusFromAdapterExecutionStatus\(value: unknown\): WorkbenchRunStatus \| null/);
  assert.match(source, /const adapterStatus = workbenchStatusFromAdapterExecutionStatus\([\s\S]*run\.metadata\?\.\["adapterExecutionStatus"\][\s\S]*if \(adapterStatus\) return adapterStatus;[\s\S]*if \(apiStatus === "succeeded"\) return apiStatus;/);
  assert.match(source, /function workbenchStatusFromIndexedRun\(run: Record<string, unknown>\): WorkbenchRunStatus/);
  assert.match(source, /const interaction = parseToolInteraction\(metadata\);[\s\S]*const interactionStatus = workbenchStatusFromToolInteraction\(interaction\);/);
  assert.doesNotMatch(source, /workbenchStatusFromToolInteraction\(parseToolInteraction\(metadata\)\)/);
  assert.match(source, /const adapterStatus = workbenchStatusFromAdapterExecutionStatus\([\s\S]*metadata\?\.\["adapterExecutionStatus"\][\s\S]*if \(adapterStatus\) return adapterStatus;[\s\S]*if \(status === "succeeded"\) return "succeeded";/);
  assert.match(source, /function isActiveWorkbenchStatus\(status: WorkbenchRunStatus\): boolean/);
  assert.match(source, /function activeWorkbenchStep/);
  assert.match(source, /function workbenchRunStatusFromSteps/);
  assert.match(source, /const runningStep = steps\.find\(\(step\) => step\.status === "running"\);/);
  assert.match(source, /return "running";/);
  assert.match(source, /activeSkillId: isActiveWorkbenchStatus\(status\) \? moduleId : undefined/);
  assert.match(source, /const activeStep = activeWorkbenchStep\(steps\);/);
  assert.match(source, /const runStatus = workbenchRunStatusFromSteps\([\s\S]*normalizeWorkbenchRunStatus\(pipelineRun\["status"\]\),[\s\S]*steps/);
  assert.match(source, /status: runStatus,/);
  assert.match(source, /interaction\?\.status === "waiting_for_approval"\) return "approval_required"/);
  assert.match(source, /const approvalBlockers = uniqueBackstageApprovalBlockers\(\[/);
  assert.match(source, /function approvalBlockerUpdatedAtRank\(value: string, nowMs = Date\.now\(\)\): number \| null/);
  assert.match(source, /\^\(now\|现在\|local\|本地\)\$/);
  assert.match(source, /if \(!Number\.isNaN\(timestamp\)\) return timestamp;/);
  assert.match(source, /const timeOnly = trimmed\.match/);
  assert.match(source, /const candidate = new Date\(nowMs\);/);
  assert.match(source, /candidate\.setHours\(Number\(hours\), Number\(minutes\), Number\(seconds\), 0\);/);
  assert.match(source, /return candidateMs > nowMs \? candidateMs - dayMs : candidateMs;/);
  assert.match(source, /if \(blockerRank === null\) return latest;/);
  assert.match(source, /if \(latestRank === null\) return blocker;/);
  assert.match(source, /function latestApprovalBlocker\([\s\S]*approvalBlockerUpdatedAtRank\(blocker\.updatedAt, nowMs\)[\s\S]*approvalBlockerUpdatedAtRank\(latest\.updatedAt, nowMs\)/);
  assert.match(source, /const latestBlocker = latestApprovalBlocker\(approvalBlockers\);/);
  assert.doesNotMatch(source, /JSON\.stringify\(approvalBlockers, null, 2\)/);
  assert.match(source, /<ApprovalsBackstagePanel[\s\S]*approvalBlockers=\{approvalBlockers\}[\s\S]*onOpenRun=\{\(pipelineRunId\) =>/);
  assert.match(source, /onOpenSkill=\{\(blocker\) =>[\s\S]*onSelectRun\(blocker\.pipelineRunId\)[\s\S]*onSetSkillTab\(hasBackstageSkillUi\(skill\) \? "ui" : "io"\)/);
  assert.match(source, /disabled=\{!isModuleId\(blocker\.moduleId\)\}/);
  assert.match(source, /agentFirst\.backstage\.approvals\.openRun/);
  assert.match(source, /agentFirst\.backstage\.approvals\.blockerActionHint/);
  assert.match(source, /workbenchTab === "settings" && \(/);
  assert.match(source, /function SettingsBackstagePanel/);
  assert.match(source, /<ConfigureView[\s\S]*<PublishView[\s\S]*<OperatorBackstage/);
});
