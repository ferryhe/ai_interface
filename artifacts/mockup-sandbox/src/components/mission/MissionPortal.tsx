import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApprovalInbox } from "@/components/approvals/ApprovalInbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { i18nRiskLevelKey } from "@/i18n/locale";
import { ArrowRightLeft, Bot, LockKeyhole, Workflow } from "lucide-react";

import { ExecutionBoard } from "./ExecutionBoard";
import {
  isPortalRuntimeAccessDenied,
  missionPortalRuntimeHeaders,
  type MissionPortalAccessMode,
} from "./MissionPortalAccess";
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

type MissionPortalTokenAccessState =
  | "idle"
  | "checking"
  | "authorized"
  | "missing_token"
  | "invalid_token"
  | "not_published"
  | "failed";

type PortalAccessVerificationResponse = {
  status: "authorized" | "missing_token" | "invalid_token" | "not_published";
  authorized: boolean;
  publishStatus: "draft" | "published" | "paused";
  versionLabel: string;
};

export type MissionPortalProps = {
  accessMode?: MissionPortalAccessMode;
  initialPortalToken?: string;
  initialMissionId?: string | null;
};

function isPortalAccessVerificationResponse(
  value: unknown,
): value is PortalAccessVerificationResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record["status"] === "authorized" ||
      record["status"] === "missing_token" ||
      record["status"] === "invalid_token" ||
      record["status"] === "not_published") &&
    typeof record["authorized"] === "boolean" &&
    (record["publishStatus"] === "draft" ||
      record["publishStatus"] === "published" ||
      record["publishStatus"] === "paused") &&
    typeof record["versionLabel"] === "string"
  );
}

type PortalStepState = "active" | "complete" | "pending";

const portalStepTone: Record<PortalStepState, string> = {
  active: "border-sky-400/50 bg-sky-500/10 text-sky-100",
  complete: "border-emerald-500/35 bg-emerald-500/10 text-emerald-100",
  pending: "border-border bg-muted/30 text-muted-foreground",
};

function MissionPortalProgress({
  hasMission,
  hasApproval,
  hasResult,
}: {
  hasMission: boolean;
  hasApproval: boolean;
  hasResult: boolean;
}) {
  const { t } = useTranslation();
  const steps: Array<{
    id: "intake" | "review" | "approval" | "result";
    titleKey: string;
    descriptionKey: string;
    state: PortalStepState;
  }> = [
    {
      id: "intake",
      titleKey: "missionCenter.stepIntakeTitle",
      descriptionKey: "missionCenter.stepIntakeDescription",
      state: hasMission ? "complete" : "active",
    },
    {
      id: "review",
      titleKey: "missionCenter.stepReviewTitle",
      descriptionKey: "missionCenter.stepReviewDescription",
      state: hasMission ? (hasApproval ? "complete" : "active") : "pending",
    },
    {
      id: "approval",
      titleKey: "missionCenter.stepApprovalTitle",
      descriptionKey: "missionCenter.stepApprovalDescription",
      state: hasApproval ? "complete" : hasMission ? "active" : "pending",
    },
    {
      id: "result",
      titleKey: "missionCenter.stepResultTitle",
      descriptionKey: "missionCenter.stepResultDescription",
      state: hasResult ? "active" : "pending",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4" aria-label={t("missionCenter.portalStepsLabel")}>
      {steps.map((step, index) => (
        <div key={step.id} className={`rounded-lg border p-3 ${portalStepTone[step.state]}`}>
          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide">
            <span>{t("missionCenter.stepOrdinal", { number: index + 1 })}</span>
            <span>
              {step.state === "complete"
                ? t("missionCenter.stepComplete")
                : step.state === "active"
                  ? t("missionCenter.stepActive")
                  : t("missionCenter.stepPending")}
            </span>
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">{t(step.titleKey)}</div>
          <p className="mt-1 text-xs leading-5 opacity-80">{t(step.descriptionKey)}</p>
        </div>
      ))}
    </div>
  );
}

export function MissionPortal({
  accessMode = "frontstage",
  initialPortalToken = "",
  initialMissionId = null,
}: MissionPortalProps = {}) {
  const { t } = useTranslation();
  const isPortalTokenMode = accessMode === "portal-token";
  const [portalTokenDraft, setPortalTokenDraft] = useState(initialPortalToken);
  const [authorizedPortalToken, setAuthorizedPortalToken] = useState("");
  const [portalAccessState, setPortalAccessState] =
    useState<MissionPortalTokenAccessState>(initialPortalToken ? "checking" : "idle");
  const [portalAccessMessage, setPortalAccessMessage] = useState<string | null>(null);
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
  const portalRequestHeaders = useMemo(
    () =>
      isPortalTokenMode
        ? missionPortalRuntimeHeaders(authorizedPortalToken)
        : undefined,
    [authorizedPortalToken, isPortalTokenMode],
  );
  const buildRequestHeaders = useCallback(
    (input: Record<string, string> = {}) =>
      isPortalTokenMode
        ? missionPortalRuntimeHeaders(authorizedPortalToken, input)
        : input,
    [authorizedPortalToken, isPortalTokenMode],
  );

  const approvalCount = useMemo(
    () => bundle?.plan.steps.filter((step) => step.approval?.required).length ?? 0,
    [bundle],
  );
  const hasApproval = Boolean(bundle?.mission.approvedAt || executionReadiness);
  const hasResult = Boolean(executeResult || executionReadiness);
  const isPortalUnlocked = !isPortalTokenMode || portalAccessState === "authorized";

  function resetPortalSessionState(): void {
    setDraft("");
    setReviewMode("draft_for_review");
    setBundle(null);
    setExecuteResult(null);
    setExecutionReadiness(null);
    setReviseInstruction("");
    setStatusMessageKey(null);
    setConflictMessage(null);
    setErrorMessage(null);
  }

  async function verifyPortalToken(tokenInput: string): Promise<void> {
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      resetPortalSessionState();
      setPortalAccessState("missing_token");
      setAuthorizedPortalToken("");
      setPortalAccessMessage(t("missionCenter.portalTokenRequired"));
      return;
    }

    setPortalAccessState("checking");
    setPortalAccessMessage(t("missionCenter.portalTokenChecking"));

    try {
      const response = await fetch(apiPath("/api/portal-auth/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token: cleanToken }),
      });
      if (!response.ok) {
        resetPortalSessionState();
        setPortalAccessState("failed");
        setAuthorizedPortalToken("");
        setPortalAccessMessage(
          t("missionCenter.portalTokenVerifyFailed", { status: response.status }),
        );
        return;
      }
      const data = await readJson<unknown>(response);
      if (!isPortalAccessVerificationResponse(data)) {
        resetPortalSessionState();
        setPortalAccessState("failed");
        setAuthorizedPortalToken("");
        setPortalAccessMessage(t("missionCenter.portalTokenUnexpectedPayload"));
        return;
      }
      setPortalAccessState(data.status);
      if (data.authorized) {
        setAuthorizedPortalToken(cleanToken);
        setPortalAccessMessage(
          t("missionCenter.portalTokenAuthorized", { versionLabel: data.versionLabel }),
        );
        return;
      }
      resetPortalSessionState();
      setAuthorizedPortalToken("");
      setPortalAccessMessage(
        data.status === "not_published"
          ? t("missionCenter.portalTokenNotPublished", {
              publishStatus: data.publishStatus,
            })
          : t("missionCenter.portalTokenRejected"),
      );
    } catch {
      resetPortalSessionState();
      setPortalAccessState("failed");
      setAuthorizedPortalToken("");
      setPortalAccessMessage(t("missionCenter.portalTokenApiUnavailable"));
    }
  }

  async function handlePortalTokenSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await verifyPortalToken(portalTokenDraft);
  }

  useEffect(() => {
    if (isPortalTokenMode && initialPortalToken.trim()) {
      void verifyPortalToken(initialPortalToken);
    }
    // Query-token verification is a one-time public Portal mount shortcut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isPortalTokenMode || !isPortalUnlocked || !initialMissionId) return;
    if (missionId === initialMissionId) return;
    refreshMission(initialMissionId).catch((error: unknown) => {
      setErrorMessage(
        error instanceof Error ? error.message : t("missionCenter.missionApiUnavailable"),
      );
    });
    // Mission restore intentionally follows token unlock state and initial URL mission only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMissionId, isPortalTokenMode, isPortalUnlocked]);

  function handlePortalRuntimeDenied(response: Response): boolean {
    if (!isPortalTokenMode || !isPortalRuntimeAccessDenied(response)) return false;
    resetPortalSessionState();
    setPortalAccessState("invalid_token");
    setAuthorizedPortalToken("");
    setPortalAccessMessage(t("missionCenter.portalRuntimeAccessRejected"));
    return true;
  }

  async function refreshMission(targetMissionId: string): Promise<void> {
    const response = await fetch(apiPath(`/api/missions/${encodeURIComponent(targetMissionId)}`), {
      headers: buildRequestHeaders({ Accept: "application/json" }),
    });
    if (!response.ok) {
      if (handlePortalRuntimeDenied(response)) {
        throw new Error(t("missionCenter.portalRuntimeAccessRejected"));
      }
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
        headers: buildRequestHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({
          message: draft.trim(),
          agentId: "knowledge_builder",
          reviewMode,
        }),
      });
      if (!response.ok) {
        if (handlePortalRuntimeDenied(response)) {
          throw new Error(t("missionCenter.portalRuntimeAccessRejected"));
        }
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
        headers: buildRequestHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
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
        if (handlePortalRuntimeDenied(response)) {
          throw new Error(t("missionCenter.portalRuntimeAccessRejected"));
        }
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
        headers: buildRequestHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({ revisionId: currentRevisionId, approvedBy: "mission-center-ui" }),
      });
      if (response.status === 409) {
        const message = await readError(response);
        await refreshMission(missionId);
        setConflictMessage(message);
        return;
      }
      if (!response.ok) {
        if (handlePortalRuntimeDenied(response)) {
          throw new Error(t("missionCenter.portalRuntimeAccessRejected"));
        }
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
        headers: buildRequestHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({ revisionId: currentRevisionId, executionMode: mode }),
      });
      if (response.status === 409) {
        const message = await readError(response);
        await refreshMission(missionId);
        setConflictMessage(message);
        return;
      }
      if (!response.ok) {
        if (handlePortalRuntimeDenied(response)) {
          throw new Error(t("missionCenter.portalRuntimeAccessRejected"));
        }
        throw new Error(await readError(response));
      }
      const data = await readJson<MissionExecuteResult>(response);
      setExecuteResult(data);
      setExecutionReadiness(data.executionReadiness);
      setStatusMessageKey(
        mode === "execute_ready" ? "missionCenter.executeReadyStatus" : "missionCenter.planOnlyStatus",
      );
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : t("missionCenter.executeFailed"));
    } finally {
      setActionState("idle");
    }
  }

  if (!isPortalUnlocked) {
    return (
      <section className="space-y-6 rounded-lg border border-border bg-card p-4 shadow-none md:p-5">
        <Card className="border-border bg-muted/20 shadow-none">
          <CardHeader>
            <Badge variant="outline" className="w-fit gap-1">
              <LockKeyhole className="h-3.5 w-3.5" />
              {t("missionCenter.portalTokenBadge")}
            </Badge>
            <CardTitle>{t("missionCenter.portalTokenTitle")}</CardTitle>
            <CardDescription>{t("missionCenter.portalTokenDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void handlePortalTokenSubmit(event)}>
              <Input
                value={portalTokenDraft}
                onChange={(event) => setPortalTokenDraft(event.target.value)}
                placeholder={t("missionCenter.portalTokenPlaceholder")}
                aria-label={t("missionCenter.portalTokenLabel")}
                type="password"
                autoComplete="off"
              />
              <Button type="submit" disabled={portalAccessState === "checking"}>
                {portalAccessState === "checking"
                  ? t("missionCenter.portalTokenCheckingShort")
                  : t("missionCenter.portalTokenSubmit")}
              </Button>
            </form>
            {portalAccessMessage ? (
              <Alert className="border-sky-500/35 bg-sky-500/10 text-sky-100 [&>svg]:text-sky-300">
                <LockKeyhole className="h-4 w-4" />
                <AlertTitle>
                  {t("missionCenter.portalTokenState", { state: portalAccessState })}
                </AlertTitle>
                <AlertDescription>{portalAccessMessage}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </section>
    );
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

      <MissionPortalProgress hasMission={Boolean(bundle)} hasApproval={hasApproval} hasResult={hasResult} />

      {statusMessageKey ? (
        <Alert className="border-emerald-500/35 bg-emerald-500/10 text-emerald-100 [&>svg]:text-emerald-300">
          <Bot className="h-4 w-4" />
          <AlertTitle>{t("missionCenter.statusTitle")}</AlertTitle>
          <AlertDescription>{t(statusMessageKey)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
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
          <>
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

            <ExecutionBoard
              missionId={missionId}
              requestHeaders={portalRequestHeaders}
              onRuntimeAccessDenied={handlePortalRuntimeDenied}
            />

            <ApprovalInbox
              id="mission-approval-inbox"
              missionId={missionId ?? undefined}
              titleKey="approvalInbox.currentMissionTitle"
              descriptionKey="approvalInbox.currentMissionDescription"
              emptyKey="approvalInbox.currentMissionEmpty"
              requestHeaders={portalRequestHeaders}
              onRuntimeAccessDenied={handlePortalRuntimeDenied}
            />

            <Card className="border-border bg-muted/20 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRightLeft className="h-4 w-4" />
                  {t("missionCenter.resultTitle")}
                </CardTitle>
                <CardDescription>
                  {t("missionCenter.resultDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  {executeResult?.executionReadiness.message ??
                    executionReadiness?.message ??
                    t("missionCenter.resultFallback")}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-dashed border-border bg-muted/20 shadow-none">
            <CardHeader>
              <CardTitle>{t("missionCenter.waitingTitle")}</CardTitle>
              <CardDescription>{t("missionCenter.waitingDescription")}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </section>
  );
}
