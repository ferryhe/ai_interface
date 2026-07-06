import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcw, ShieldCheck } from "lucide-react";

import { ApprovalCard, type ApprovalInboxItem } from "./ApprovalCard";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error ?? data.message ?? `Request failed with ${response.status}`;
  } catch {
    const text = await response.text();
    return text || `Request failed with ${response.status}`;
  }
}

type ApprovalStatusMessage = {
  key: "approvalInbox.approved" | "approvalInbox.rejected";
  action: string;
};

function scopedEndpoint(endpoint: string, missionId: string | undefined): string {
  if (!missionId) return endpoint;
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}missionId=${encodeURIComponent(missionId)}`;
}

type ApprovalInboxProps = {
  endpoint?: string;
  missionId?: string;
  id?: string;
  titleKey?: string;
  descriptionKey?: string;
  emptyKey?: string;
  requestHeaders?: Record<string, string>;
  onRuntimeAccessDenied?: (response: Response) => void;
};

export function ApprovalInbox({
  endpoint = "/api/approvals",
  missionId,
  id,
  titleKey = "approvalInbox.title",
  descriptionKey = "approvalInbox.description",
  emptyKey = "approvalInbox.empty",
  requestHeaders,
  onRuntimeAccessDenied,
}: ApprovalInboxProps) {
  const { t } = useTranslation();
  const [approvals, setApprovals] = useState<ApprovalInboxItem[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading">("idle");
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<ApprovalStatusMessage | null>(null);

  const visibleApprovals = useMemo(
    () => (missionId ? approvals.filter((approval) => approval.missionId === missionId) : approvals),
    [approvals, missionId],
  );

  const loadApprovals = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const response = await fetch(scopedEndpoint(endpoint, missionId), {
        headers: { ...requestHeaders, Accept: "application/json" },
      });
      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && onRuntimeAccessDenied) {
          onRuntimeAccessDenied(response);
          return;
        }
        throw new Error(await readError(response));
      }
      const data = await readJson<{ approvals: ApprovalInboxItem[] }>(response);
      setApprovals(data.approvals ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("approvalInbox.apiUnavailable"));
    } finally {
      setLoadState("idle");
    }
  }, [endpoint, missionId, onRuntimeAccessDenied, requestHeaders, t]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  async function handleDecision(
    approvalId: string,
    decision: "approve" | "reject",
  ): Promise<void> {
    setActionId(approvalId);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `${endpoint}/${encodeURIComponent(approvalId)}/${decision}`,
        {
          method: "POST",
          headers: { ...requestHeaders, Accept: "application/json" },
        },
      );
      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && onRuntimeAccessDenied) {
          onRuntimeAccessDenied(response);
          return;
        }
        throw new Error(await readError(response));
      }
      const data = await readJson<{ approval: ApprovalInboxItem }>(response);
      setStatusMessage({
        key: decision === "approve" ? "approvalInbox.approved" : "approvalInbox.rejected",
        action: data.approval.action,
      });
      await loadApprovals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("approvalInbox.decisionFailed"));
    } finally {
      setActionId(null);
    }
  }

  return (
    <Card id={id} className="border-border bg-muted/20 shadow-none">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              {t(titleKey)}
            </CardTitle>
            <CardDescription>
              {t(descriptionKey)}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadApprovals()}
            disabled={loadState === "loading" || actionId !== null}
          >
            <RefreshCcw className="h-4 w-4" />
            {t("common.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusMessage ? (
          <Alert className="border-emerald-500/35 bg-emerald-500/10 text-emerald-100">
            <AlertTitle>{t("approvalInbox.updatedTitle")}</AlertTitle>
            <AlertDescription>{t(statusMessage.key, { action: statusMessage.action })}</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert className="border-rose-500/35 bg-rose-500/10 text-rose-100">
            <AlertTitle>{t("approvalInbox.unavailableTitle")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {loadState === "loading" ? (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {t("approvalInbox.loading")}
          </div>
        ) : null}

        {visibleApprovals.length === 0 && loadState !== "loading" ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {t(emptyKey)}
          </div>
        ) : null}

        <div className="space-y-4">
          {visibleApprovals.map((approval) => (
            <ApprovalCard
              key={approval.approvalId}
              approval={approval}
              actionState={actionId === approval.approvalId ? "submitting" : "idle"}
              onApprove={() => void handleDecision(approval.approvalId, "approve")}
              onReject={() => void handleDecision(approval.approvalId, "reject")}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
