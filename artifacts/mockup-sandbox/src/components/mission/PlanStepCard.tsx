import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { i18nRiskLevelKey, i18nStatusKey } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { ArrowRight, ShieldAlert, Sparkles, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MissionPlanStep, MissionRiskLevel, MissionStepStatus } from "./mission-types";

const statusTone: Record<MissionStepStatus, string> = {
  pending: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  waiting_approval: "bg-amber-500/10 text-amber-200 border-amber-500/35",
  running: "bg-sky-500/10 text-sky-200 border-sky-500/35",
  blocked: "bg-rose-500/10 text-rose-200 border-rose-500/35",
  succeeded: "bg-emerald-500/10 text-emerald-200 border-emerald-500/35",
  failed: "bg-rose-500/10 text-rose-200 border-rose-500/35",
  cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const riskTone: Record<MissionRiskLevel, string> = {
  low: "bg-emerald-500/10 text-emerald-200 border-emerald-500/35",
  medium: "bg-amber-500/10 text-amber-200 border-amber-500/35",
  high: "bg-rose-500/10 text-rose-200 border-rose-500/35",
};

export function PlanStepCard({ step, index }: { step: MissionPlanStep; index: number }) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-muted/20 shadow-none">
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-semibold text-primary">
                {index + 1}
              </span>
              <span>{step.stepId}</span>
            </div>
            <CardTitle className="text-base leading-6">{step.title}</CardTitle>
          </div>
          <Badge variant="outline" className={cn("capitalize", statusTone[step.status])}>
            {t(i18nStatusKey(step.status))}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="leading-6 text-muted-foreground">{step.objective}</p>

        <div className="flex flex-wrap gap-2">
          {(step.skillId ?? step.moduleId) && (
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              {step.skillId ?? step.moduleId}
            </Badge>
          )}
          {step.roleId && (
            <Badge variant="outline" className="gap-1">
              <Workflow className="h-3.5 w-3.5" />
              {step.roleId}
            </Badge>
          )}
          {step.assignedAgentId && <Badge variant="secondary">{step.assignedAgentId}</Badge>}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-dashed border-border bg-background/35 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("planStep.dependsOn")}
            </div>
            {step.dependsOn.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {step.dependsOn.map((dependency, dependencyIndex) => (
                  <span key={dependency} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1">
                    {dependencyIndex > 0 ? <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                    {dependency}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t("common.noUpstreamDependencies")}</div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-border bg-background/35 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("planStep.approval")}
            </div>
            {step.approval?.required ? (
              <div className="space-y-2">
                <Badge variant="outline" className={cn("gap-1", riskTone[step.approval.riskLevel])}>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {t("common.riskApproval", { level: t(i18nRiskLevelKey(step.approval.riskLevel)) })}
                </Badge>
                <p className="text-sm text-muted-foreground">{step.approval.reason}</p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t("common.noMandatoryApproval")}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
