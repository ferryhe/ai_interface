import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { i18nRiskLevelKey } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  GitBranchPlus,
  Play,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";

import { ApprovalSummary } from "./ApprovalSummary";
import { PlanStepCard } from "./PlanStepCard";
import type { MissionExecutionReadiness, MissionPlan, MissionRevisionRecord } from "./mission-types";

const riskTone = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
} as const;

function roleLabel(skillId: string, t: (key: string, options?: { defaultValue?: string }) => string): string {
  const normalized = skillId.replace(/_/g, " ");
  return t(`planReview.roleLabels.${skillId}`, { defaultValue: normalized });
}

export function PlanReview({
  plan,
  revision,
  executionMode,
  reviseInstruction,
  onReviseInstructionChange,
  onApprove,
  onRevise,
  onExecute,
  onPlanOnly,
  actionState,
  executionReadiness,
  conflictMessage,
}: {
  plan: MissionPlan;
  revision: MissionRevisionRecord;
  executionMode: "plan_only" | "execute_ready";
  reviseInstruction: string;
  onReviseInstructionChange: (value: string) => void;
  onApprove: () => void;
  onRevise: () => void;
  onExecute: () => void;
  onPlanOnly: () => void;
  actionState: "idle" | "submitting";
  executionReadiness: MissionExecutionReadiness | null;
  conflictMessage: string | null;
}) {
  const { t } = useTranslation();
  const roleSuggestions = useMemo(() => {
    return Array.from(
      new Set(plan.steps.map((step) => step.skillId ?? step.moduleId).filter(Boolean) as string[]),
    );
  }, [plan.steps]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">{plan.title}</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6">
                  {plan.summary}
                </CardDescription>
              </div>
              <Badge variant="outline" className={cn("capitalize", riskTone[plan.riskLevel])}>
                <TriangleAlert className="mr-1 h-3.5 w-3.5" />
                {t("common.risk", { level: t(i18nRiskLevelKey(plan.riskLevel)) })}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("planReview.missionSummary")}</div>
                <div className="mt-2 text-sm leading-6 text-foreground">{plan.userGoal}</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("planReview.revision")}</div>
                <div className="mt-2 text-sm font-medium">v{revision.revisionNumber}</div>
                <div className="text-xs text-muted-foreground">{revision.revisionId}</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("planReview.executionIntent")}</div>
                <div className="mt-2 text-sm font-medium">
                  {executionMode === "execute_ready" ? t("planReview.executeAfterApproval") : t("planReview.planOnly")}
                </div>
              </div>
            </div>

            {conflictMessage ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>{t("planReview.conflictTitle")}</AlertTitle>
                <AlertDescription>{conflictMessage}</AlertDescription>
              </Alert>
            ) : null}
          </CardHeader>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranchPlus className="h-4 w-4" />
              {t("planReview.stepReview")}
            </CardTitle>
            <CardDescription>{t("planReview.stepReviewDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.steps.map((step, index) => (
              <PlanStepCard key={step.stepId} step={step} index={index} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              {t("planReview.roleSuggestions")}
            </CardTitle>
            <CardDescription>{t("planReview.roleSuggestionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {roleSuggestions.length > 0 ? (
              roleSuggestions.map((skillId) => (
                <div key={skillId} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
                  <span className="font-medium">{roleLabel(skillId, t)}</span>
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {skillId}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{t("planReview.noExplicitSkills")}</div>
            )}
          </CardContent>
        </Card>

        <ApprovalSummary plan={plan} />

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("planReview.planActions")}</CardTitle>
            <CardDescription>{t("planReview.planActionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={reviseInstruction}
              onChange={(event) => onReviseInstructionChange(event.target.value)}
              placeholder={t("planReview.revisionPlaceholder")}
              className="min-h-[104px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={onApprove} disabled={actionState === "submitting"}>
                <ShieldCheck className="h-4 w-4" />
                {t("planReview.approve")}
              </Button>
              <Button variant="outline" onClick={onRevise} disabled={actionState === "submitting"}>
                <GitBranchPlus className="h-4 w-4" />
                {t("planReview.revise")}
              </Button>
              <Button variant="secondary" onClick={onPlanOnly} disabled={actionState === "submitting"}>
                {t("planReview.planOnly")}
              </Button>
              <Button variant="outline" onClick={onExecute} disabled={actionState === "submitting"}>
                <Play className="h-4 w-4" />
                {t("planReview.execute")}
              </Button>
            </div>

            {executionReadiness ? (
              <Alert className={executionReadiness.ready ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}>
                <ArrowRight className="h-4 w-4" />
                <AlertTitle>
                  {executionReadiness.ready ? t("planReview.executionReady") : t("planReview.stillPlanning")}
                </AlertTitle>
                <AlertDescription>{executionReadiness.message}</AlertDescription>
              </Alert>
            ) : null}

            <details className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm">
              <summary className="cursor-pointer font-medium">{t("planReview.advancedDetails")}</summary>
              <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs leading-5 text-muted-foreground">
                {JSON.stringify({ revision, plan }, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
