import { useCallback, useEffect, useState } from "react";

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

export function ApprovalInbox({ endpoint = "/api/approvals" }: { endpoint?: string }) {
  const [approvals, setApprovals] = useState<ApprovalInboxItem[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading">("idle");
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = await readJson<{ approvals: ApprovalInboxItem[] }>(response);
      setApprovals(data.approvals ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Approval API unavailable");
    } finally {
      setLoadState("idle");
    }
  }, [endpoint]);

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
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = await readJson<{ approval: ApprovalInboxItem }>(response);
      setStatusMessage(
        decision === "approve"
          ? `已批准：${data.approval.action}`
          : `已拒绝：${data.approval.action}`,
      );
      await loadApprovals();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Approval decision failed");
    } finally {
      setActionId(null);
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Approval Inbox
            </CardTitle>
            <CardDescription>
              聚合等待人工确认的高风险动作，决定后立即刷新列表。
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadApprovals()}
            disabled={loadState === "loading" || actionId !== null}
          >
            <RefreshCcw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusMessage ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <AlertTitle>审批已更新</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert className="border-rose-200 bg-rose-50 text-rose-900">
            <AlertTitle>审批箱不可用</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {loadState === "loading" ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            正在刷新审批列表；如需继续执行，请等待最新待审批动作与 redacted 摘要返回。
          </div>
        ) : null}

        {approvals.length === 0 && loadState !== "loading" ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            当前没有待审批动作；Mission 已批准不代表已经执行，新的高风险步骤会在这里单独出现。
          </div>
        ) : null}

        <div className="space-y-4">
          {approvals.map((approval) => (
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
