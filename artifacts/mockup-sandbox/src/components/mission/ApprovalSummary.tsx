import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, ShieldAlert, TriangleAlert } from "lucide-react";

import type { MissionPlan, MissionRiskLevel } from "./mission-types";

const riskTone: Record<MissionRiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

export function ApprovalSummary({ plan }: { plan: MissionPlan }) {
  const approvalSteps = plan.steps.filter((step) => step.approval?.required);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">审批摘要</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            聚焦必须人工确认的步骤和整体风险暴露。
          </p>
        </div>
        <Badge variant="outline" className={cn("capitalize", riskTone[plan.riskLevel])}>
          <TriangleAlert className="mr-1 h-3.5 w-3.5" />
          {plan.riskLevel} risk
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {approvalSteps.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            当前计划没有额外的强制审批步骤。
          </div>
        ) : (
          <div className="space-y-3">
            {approvalSteps.map((step) => (
              <div
                key={step.stepId}
                className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3"
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
                    {step.approval?.riskLevel ?? plan.riskLevel}
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
