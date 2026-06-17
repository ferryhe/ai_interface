import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { i18nRiskLevelKey } from "@/i18n/locale";
import { ArrowRightLeft, Bot, Workflow } from "lucide-react";

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

type MissionStatusMessageKey =
  | "missionCenter.generatedStatus"
  | "missionCenter.revisedStatus"
  | "missionCenter.approvedStatus"
  | "missionCenter.executeReadyStatus"
  | "missionCenter.planOnlyStatus"
  | "missionCenter.planOnlySavedStatus";

export function MissionCenterShell({
  onOpenBackstage,
  onOpenOperator,
}: {
  onOpenBackstage?: () => void;
  onOpenOperator?: () => void;
}) {
  const { t } = useTranslation();
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
  const [statusMessageKey, setStatusMessageKey] = useState<MissionStatusMessageKey | null>(null);
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
    setStatusMessageKey(null);
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
      setStatusMessageKey("missionCenter.generatedStatus");
      setReviseInstruction("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("missionCenter.missionApiUnavailable"));
    } finally {
      setIntakeState("idle");
    }
  }

  async function handleRevise(): Promise<void> {
    if (!missionId || !currentRevisionId) return;
    setActionState("submitting");
    setConflictMessage(null);
    setStatusMessageKey(null);

    try {
      const response = await fetch(apiPath(`/api/missions/${encodeURIComponent(missionId)}/revise`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          instruction: reviseInstruction.trim() || t("missionCenter.defaultRevisionInstruction"),
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
      setStatusMessageKey("missionCenter.revisedStatus");
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : t("missionCenter.revisionUpdateFailed"));
    } finally {
      setActionState("idle");
    }
  }

  async function handleApprove(): Promise<void> {
    if (!missionId || !currentRevisionId) return;
    setActionState("submitting");
    setConflictMessage(null);
    setStatusMessageKey(null);

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
      setStatusMessageKey("missionCenter.approvedStatus");
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : t("missionCenter.approveFailed"));
    } finally {
      setActionState("idle");
    }
  }

  async function handleExecute(mode: MissionExecutionMode): Promise<void> {
    if (!missionId || !currentRevisionId) return;
    setActionState("submitting");
    setConflictMessage(null);
    setStatusMessageKey(null);

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
      setStatusMessageKey(
        mode === "execute_ready" ? "missionCenter.executeReadyStatus" : "missionCenter.planOnlyStatus",
      );
      if (mode === "execute_ready") {
        setActiveTab("backstage");
      }
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : t("missionCenter.executeFailed"));
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-4 shadow-none md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit gap-1">
            <Workflow className="h-3.5 w-3.5" />
            {t("missionCenter.badge")}
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("missionCenter.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("missionCenter.description")}
            </p>
          </div>
        </div>
        <div className="grid min-w-[220px] gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("missionCenter.currentPlan")}</span>
            <span className="font-medium text-foreground">
              {t("missionCenter.steps", { count: bundle?.plan.steps.length ?? 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("missionCenter.approvalSteps")}</span>
            <span className="font-medium text-foreground">{approvalCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("missionCenter.riskLevel")}</span>
            <span className="font-medium text-foreground">
              {bundle ? t(i18nRiskLevelKey(bundle.plan.riskLevel)) : "-"}
            </span>
          </div>
        </div>
      </div>

      {statusMessageKey ? (
          <Alert className="border-emerald-500/35 bg-emerald-500/10 text-emerald-100 [&>svg]:text-emerald-300">
          <Bot className="h-4 w-4" />
          <AlertTitle>{t("missionCenter.statusTitle")}</AlertTitle>
          <AlertDescription>{t(statusMessageKey)}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "mission-center" | "backstage")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="mission-center">{t("missionCenter.tabMissionCenter")}</TabsTrigger>
          <TabsTrigger value="backstage">{t("missionCenter.tabBackstage")}</TabsTrigger>
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
                setStatusMessageKey("missionCenter.planOnlySavedStatus");
              }}
              actionState={actionState}
              executionReadiness={executionReadiness}
              conflictMessage={conflictMessage}
            />
          ) : (
            <Card className="border-dashed border-border bg-muted/20 shadow-none">
              <CardHeader>
                <CardTitle>{t("missionCenter.waitingTitle")}</CardTitle>
                <CardDescription>
                  {t("missionCenter.waitingDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="backstage" className="space-y-6">
          <Card className="border-border bg-muted/20 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4" />
                {t("missionCenter.handoffTitle")}
              </CardTitle>
              <CardDescription>
                {t("missionCenter.handoffDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                {executeResult?.executionReadiness.message ??
                  executionReadiness?.message ??
                  t("missionCenter.handoffFallback")}
              </div>
              <Button onClick={onOpenBackstage} className="w-full sm:w-auto">
                {t("missionCenter.openBackstage")}
              </Button>
              <Button variant="outline" onClick={onOpenOperator} className="w-full sm:w-auto">
                {t("missionCenter.openOperator")}
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
