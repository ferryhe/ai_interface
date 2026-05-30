import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightLeft, Bot, RefreshCcw, Workflow } from "lucide-react";

import { ApprovalInbox } from "@/components/approvals/ApprovalInbox";
import { ExecutionBoard } from "./ExecutionBoard";
import { MissionIntake } from "./MissionIntake";
import { PlanReview } from "./PlanReview";
import type {
  MissionBundle,
  MissionExecuteResult,
  MissionExecutionMode,
  MissionExecutionReadiness,
  MissionRecord,
  MissionReviewMode,
  MissionRevisionRecord,
} from "./mission-types";

function apiPath(path: string): string {
  return path;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? `Request failed with ${response.status}`;
  } catch {
    const text = await response.text();
    return text || `Request failed with ${response.status}`;
  }
}

export function MissionCenterShell({
  onOpenBackstage,
  onOpenOperator,
}: {
  onOpenBackstage?: () => void;
  onOpenOperator?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"mission-center" | "backstage">("mission-center");
  const [draft, setDraft] = useState("");
  const [reviewMode, setReviewMode] = useState<MissionReviewMode>("draft_for_review");
  const [bundle, setBundle] = useState<MissionBundle | null>(null);
  const [executeResult, setExecuteResult] = useState<MissionExecuteResult | null>(null);
  const [executionReadiness, setExecutionReadiness] = useState<MissionExecutionReadiness | null>(null);
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [intakeState, setIntakeState] = useState<"idle" | "submitting">("idle");
  const [actionState, setActionState] = useState<"idle" | "submitting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const currentRevisionId = bundle?.revision.revisionId ?? null;
  const missionId = bundle?.mission.missionId ?? null;

  const approvalCount = useMemo(
    () => bundle?.plan.steps.filter((step) => step.approval?.required).length ?? 0,
    [bundle],
  );

  async function refreshMission(targetMissionId: string): Promise<void> {
    const response = await fetch(apiPath(`/api/missions/${encodeURIComponent(targetMissionId)}`), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    const data = await readJson<{
      mission: MissionRecord;
      latestRevision: MissionRevisionRecord;
      plan: MissionBundle["plan"];
    }>(response);
    setBundle({ mission: data.mission, revision: data.latestRevision, plan: data.plan });
  }

  async function handleCreateMission(): Promise<void> {
    setIntakeState("submitting");
    setErrorMessage(null);
    setConflictMessage(null);
    setStatusMessage(null);
    setExecutionReadiness(null);
    setExecuteResult(null);

    try {
      const response = await fetch(apiPath("/api/missions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: draft.trim(),
          agentId: "knowledge_builder",
          reviewMode,
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = await readJson<MissionBundle>(response);
      setBundle(data);
      setStatusMessage("已生成最新 Mission 计划。请先审阅步骤、依赖与审批点。");
      setReviseInstruction("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Mission API unavailable");
    } finally {
      setIntakeState("idle");
    }
  }

  async function handleRevise(): Promise<void> {
    if (!missionId || !currentRevisionId) return;
    setActionState("submitting");
    setConflictMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(apiPath(`/api/missions/${encodeURIComponent(missionId)}/revise`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          instruction: reviseInstruction.trim() || "请基于当前任务补充更清晰的分工、依赖和审批说明。",
          expectedRevisionId: currentRevisionId,
        }),
      });
      if (response.status === 409) {
        const message = await readError(response);
        await refreshMission(missionId);
        setConflictMessage(message);
        return;
      }
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = await readJson<MissionBundle>(response);
      setBundle(data);
      setStatusMessage("计划已更新，请重新确认关键审批步骤。");
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : "Revision update failed");
    } finally {
      setActionState("idle");
    }
  }

  async function handleApprove(): Promise<void> {
    if (!missionId || !currentRevisionId) return;
    setActionState("submitting");
    setConflictMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(apiPath(`/api/missions/${encodeURIComponent(missionId)}/approve`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ revisionId: currentRevisionId, approvedBy: "mission-center-ui" }),
      });
      if (response.status === 409) {
        const message = await readError(response);
        await refreshMission(missionId);
        setConflictMessage(message);
        return;
      }
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = await readJson<{
        mission: MissionRecord;
        approvedRevision: MissionRevisionRecord;
        executionReadiness: MissionExecutionReadiness;
      }>(response);
      setBundle({ mission: data.mission, revision: data.approvedRevision, plan: data.approvedRevision.plan });
      setExecutionReadiness(data.executionReadiness);
      setStatusMessage("计划已确认，可以选择仅保留计划或继续执行。");
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : "Approve failed");
    } finally {
      setActionState("idle");
    }
  }

  async function handleExecute(mode: MissionExecutionMode): Promise<void> {
    if (!missionId || !currentRevisionId) return;
    setActionState("submitting");
    setConflictMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(apiPath(`/api/missions/${encodeURIComponent(missionId)}/execute`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ revisionId: currentRevisionId, executionMode: mode }),
      });
      if (response.status === 409) {
        const message = await readError(response);
        await refreshMission(missionId);
        setConflictMessage(message);
        return;
      }
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = await readJson<MissionExecuteResult>(response);
      setExecuteResult(data);
      setExecutionReadiness(data.executionReadiness);
      setStatusMessage(
        mode === "execute_ready" ? "执行请求已发送，可以切到 Backstage 查看运行明细。" : "已保留为计划模式，未启动执行。",
      );
      if (mode === "execute_ready") {
        setActiveTab("backstage");
      }
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : "Execute failed");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-border/60 bg-background/95 p-5 shadow-sm backdrop-blur md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit gap-1">
            <Workflow className="h-3.5 w-3.5" />
            Mission Center
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mission Center 是普通用户默认入口：输入任务 → 生成 Mission plan → 审阅步骤、依赖、审批 → 决定是否执行。
            </p>
          </div>
        </div>
        <div className="grid min-w-[220px] gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">当前计划</span>
            <span className="font-medium">{bundle?.plan.steps.length ?? 0} steps</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">审批步骤</span>
            <span className="font-medium">{approvalCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">风险级别</span>
            <span className="font-medium capitalize">{bundle?.plan.riskLevel ?? "-"}</span>
          </div>
        </div>
      </div>

      {statusMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <Bot className="h-4 w-4" />
          <AlertTitle>Mission 状态</AlertTitle>
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "mission-center" | "backstage")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="mission-center">Mission Center</TabsTrigger>
          <TabsTrigger value="backstage">Backstage</TabsTrigger>
        </TabsList>

        <TabsContent value="mission-center" className="space-y-6">
          <MissionIntake
            draft={draft}
            onDraftChange={setDraft}
            reviewMode={reviewMode}
            onReviewModeChange={setReviewMode}
            onSubmit={() => void handleCreateMission()}
            isSubmitting={intakeState === "submitting"}
            error={errorMessage}
          />

          {bundle ? (
            <PlanReview
              plan={bundle.plan}
              revision={bundle.revision}
              executionMode={reviewMode === "plan_only" ? "plan_only" : "execute_ready"}
              reviseInstruction={reviseInstruction}
              onReviseInstructionChange={setReviseInstruction}
              onApprove={() => void handleApprove()}
              onRevise={() => void handleRevise()}
              onExecute={() => void handleExecute("execute_ready")}
              onPlanOnly={() => {
                setStatusMessage("已保留为计划模式，未启动执行。可随时回来看计划详情。");
              }}
              actionState={actionState}
              executionReadiness={executionReadiness}
              conflictMessage={conflictMessage}
            />
          ) : (
            <Card className="border-dashed border-border/70 shadow-none">
              <CardHeader>
                <CardTitle>等待 Mission 计划</CardTitle>
                <CardDescription>
                  生成第一版计划后，这里会显示 Mission summary、角色建议、步骤依赖和审批摘要。
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="backstage" className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4" />
                Backstage handoff
              </CardTitle>
              <CardDescription>
                Backstage 保留 Agents / Skills / Runs / Artifacts；Operator 入口承接高级治理、manifest 审阅与受保护修改。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                {executeResult?.executionReadiness.message ??
                  executionReadiness?.message ??
                  "当你确认计划后，可切到 Backstage 查看 Runs、Artifacts、Skill UI 与 Approval Inbox。"}
              </div>
              <Button onClick={onOpenBackstage} className="w-full sm:w-auto">
                打开 Backstage 工作台
              </Button>
              <Button variant="outline" onClick={onOpenOperator} className="w-full sm:w-auto">
                打开 Operator 入口
              </Button>
            </CardContent>
          </Card>

          <ExecutionBoard missionId={missionId} />

          <div id="approval-inbox">
            <ApprovalInbox />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
