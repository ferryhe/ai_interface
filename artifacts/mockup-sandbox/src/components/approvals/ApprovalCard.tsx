import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_LOCALE, formatDateTimeForLocale, i18nRiskLevelKey, i18nStatusKey, normalizeLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { CheckCircle2, OctagonX, ShieldAlert, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ApprovalInboxItem {
  approvalId: string;
  missionId: string;
  revisionId: string;
  moduleRunId: string;
  interactionId?: string;
  resumeHandle?: string;
  stepId?: string;
  agentId?: string;
  skillId?: string;
  toolKind?: string;
  riskLevel: "low" | "medium" | "high";
  action: string;
  reason: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "expired";
}

const riskTone: Record<ApprovalInboxItem["riskLevel"], string> = {
  low: "bg-emerald-500/10 text-emerald-200 border-emerald-500/35",
  medium: "bg-amber-500/10 text-amber-200 border-amber-500/35",
  high: "bg-rose-500/10 text-rose-200 border-rose-500/35",
};

export function ApprovalCard({
  approval,
  actionState,
  onApprove,
  onReject,
}: {
  approval: ApprovalInboxItem;
  actionState: "idle" | "submitting";
  onApprove: () => void;
  onReject: () => void;
}) {
  const { i18n, t } = useTranslation();
  const locale = normalizeLocale(i18n.resolvedLanguage) ?? DEFAULT_LOCALE;

  return (
    <Card className="border-border bg-muted/20 shadow-none">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{approval.action}</CardTitle>
            <div className="text-xs text-muted-foreground">
              {approval.skillId ?? approval.toolKind ?? t("approvalCard.runtimeStep")}
              {approval.stepId ? ` · ${approval.stepId}` : ""}
              {approval.agentId ? ` · ${approval.agentId}` : ""}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("capitalize gap-1", riskTone[approval.riskLevel])}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {t(i18nRiskLevelKey(approval.riskLevel))}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{approval.reason}</p>

        <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <span className="font-medium text-foreground">{t("approvalCard.mission")}</span> {approval.missionId}
          </div>
          <div>
            <span className="font-medium text-foreground">{t("approvalCard.revision")}</span> {approval.revisionId}
          </div>
          <div>
            <span className="font-medium text-foreground">{t("approvalCard.moduleRun")}</span> {approval.moduleRunId}
          </div>
          <div>
            <span className="font-medium text-foreground">{t("approvalCard.requested")}</span>{" "}
            {formatDateTimeForLocale(approval.requestedAt, locale)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onApprove} disabled={actionState === "submitting"}>
            <CheckCircle2 className="h-4 w-4" />
            {t("approvalCard.approve")}
          </Button>
          <Button
            variant="outline"
            onClick={onReject}
            disabled={actionState === "submitting"}
          >
            <OctagonX className="h-4 w-4" />
            {t("approvalCard.reject")}
          </Button>
          <Badge variant="secondary" className="gap-1">
            <Workflow className="h-3.5 w-3.5" />
            {t(i18nStatusKey(approval.status))}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
