import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { i18nRiskLevelKey } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { CheckCircle2, ShieldAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MissionPlan, MissionRiskLevel } from "./mission-types";

const riskTone: Record<MissionRiskLevel, string> = {
  low: "bg-emerald-500/10 text-emerald-200 border-emerald-500/35",
  medium: "bg-amber-500/10 text-amber-200 border-amber-500/35",
  high: "bg-rose-500/10 text-rose-200 border-rose-500/35",
};

export function ApprovalSummary({ plan }: { plan: MissionPlan }) {
  const { t } = useTranslation();
  const approvalSteps = plan.steps.filter((step) => step.approval?.required);

  return (
    <Card className="border-border bg-muted/20 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{t("approvalSummary.title")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("approvalSummary.description")}
          </p>
        </div>
        <Badge variant="outline" className={cn("capitalize", riskTone[plan.riskLevel])}>
          <TriangleAlert className="mr-1 h-3.5 w-3.5" />
          {t("common.risk", { level: t(i18nRiskLevelKey(plan.riskLevel)) })}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {approvalSteps.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            {t("approvalSummary.noRequiredSteps")}
          </div>
        ) : (
          <div className="space-y-3">
            {approvalSteps.map((step) => (
              <div
                key={step.stepId}
                className="rounded-lg border border-border bg-muted/30 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{step.title}</div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize",
                      riskTone[step.approval?.riskLevel ?? plan.riskLevel],
                    )}
                  >
                    <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                    {t(i18nRiskLevelKey(step.approval?.riskLevel ?? plan.riskLevel))}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{step.approval?.reason}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
