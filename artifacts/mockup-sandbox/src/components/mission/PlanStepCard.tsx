import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowRight, ShieldAlert, Sparkles, Workflow } from "lucide-react";

import type { MissionPlanStep, MissionRiskLevel, MissionStepStatus } from "./mission-types";

const statusTone: Record<MissionStepStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
  blocked: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  skipped: "bg-slate-100 text-slate-500 border-slate-200",
};

const riskTone: Record<MissionRiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

function prettify(value: string): string {
  return value.replace(/_/g, " ");
}

export function PlanStepCard({ step, index }: { step: MissionPlanStep; index: number }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                {index + 1}
              </span>
              <span>{step.stepId}</span>
            </div>
            <CardTitle className="text-base leading-6">{step.title}</CardTitle>
          </div>
          <Badge variant="outline" className={cn("capitalize", statusTone[step.status])}>
            {prettify(step.status)}
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
          <div className="rounded-lg border border-dashed border-border/70 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Depends on
            </div>
            {step.dependsOn.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {step.dependsOn.map((dependency, dependencyIndex) => (
                  <span key={dependency} className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1">
                    {dependencyIndex > 0 ? <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                    {dependency}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No upstream dependencies.</div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-border/70 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Approval
            </div>
            {step.approval?.required ? (
              <div className="space-y-2">
                <Badge variant="outline" className={cn("gap-1", riskTone[step.approval.riskLevel])}>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {step.approval.riskLevel} risk approval
                </Badge>
                <p className="text-sm text-muted-foreground">{step.approval.reason}</p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No mandatory approval gate.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
