import { useMemo } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function roleLabel(skillId: string): string {
  const normalized = skillId.replace(/_/g, " ");
  const presets: Record<string, string> = {
    web_listening: "情报监听",
    doc_to_md: "资料整理",
    md_to_rag: "知识建库",
    rag_to_agent: "Agent 装配",
    climate_monitor: "监控巡检",
    ai_actuary: "风控评估",
  };

  return presets[skillId] ?? normalized;
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
                {plan.riskLevel} risk
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Mission summary</div>
                <div className="mt-2 text-sm leading-6 text-foreground">{plan.userGoal}</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Revision</div>
                <div className="mt-2 text-sm font-medium">v{revision.revisionNumber}</div>
                <div className="text-xs text-muted-foreground">{revision.revisionId}</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Execution intent</div>
                <div className="mt-2 text-sm font-medium">
                  {executionMode === "execute_ready" ? "审批后执行" : "只生成计划"}
                </div>
              </div>
            </div>

            {conflictMessage ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>检测到版本冲突</AlertTitle>
                <AlertDescription>{conflictMessage}</AlertDescription>
              </Alert>
            ) : null}
          </CardHeader>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranchPlus className="h-4 w-4" />
              Step review
            </CardTitle>
            <CardDescription>展示步骤、依赖、技能和审批要求。</CardDescription>
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
              角色建议
            </CardTitle>
            <CardDescription>根据计划步骤推导建议角色与技能分工。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {roleSuggestions.length > 0 ? (
              roleSuggestions.map((skillId) => (
                <div key={skillId} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
                  <span className="font-medium">{roleLabel(skillId)}</span>
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {skillId}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">当前计划未声明显式技能。</div>
            )}
          </CardContent>
        </Card>

        <ApprovalSummary plan={plan} />

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">计划动作</CardTitle>
            <CardDescription>你可以直接确认、修改或执行当前计划。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={reviseInstruction}
              onChange={(event) => onReviseInstructionChange(event.target.value)}
              placeholder="例如：把高风险步骤拆小，并把审批前置到数据写入前。"
              className="min-h-[104px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={onApprove} disabled={actionState === "submitting"}>
                <ShieldCheck className="h-4 w-4" />
                确认计划
              </Button>
              <Button variant="outline" onClick={onRevise} disabled={actionState === "submitting"}>
                <GitBranchPlus className="h-4 w-4" />
                修改计划
              </Button>
              <Button variant="secondary" onClick={onPlanOnly} disabled={actionState === "submitting"}>
                只生成计划
              </Button>
              <Button variant="outline" onClick={onExecute} disabled={actionState === "submitting"}>
                <Play className="h-4 w-4" />
                执行
              </Button>
            </div>

            {executionReadiness ? (
              <Alert className={executionReadiness.ready ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}>
                <ArrowRight className="h-4 w-4" />
                <AlertTitle>
                  {executionReadiness.ready ? "执行准备就绪" : "执行仍在计划阶段"}
                </AlertTitle>
                <AlertDescription>{executionReadiness.message}</AlertDescription>
              </Alert>
            ) : null}

            <details className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm">
              <summary className="cursor-pointer font-medium">高级详情</summary>
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
