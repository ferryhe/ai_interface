import { LoaderCircle, Send, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { MissionReviewMode } from "./mission-types";

export function MissionIntake({
  draft,
  onDraftChange,
  reviewMode,
  onReviewModeChange,
  onSubmit,
  isSubmitting,
  error,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  reviewMode: MissionReviewMode;
  onReviewModeChange: (mode: MissionReviewMode) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3">
        <Badge variant="outline" className="w-fit gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          Mission intake
        </Badge>
        <CardTitle className="text-2xl">你要让 AI 团队完成什么？</CardTitle>
        <CardDescription className="max-w-3xl text-sm leading-6">
          直接描述目标、约束、期望产出。系统会调用 Mission API 生成摘要、步骤、依赖和审批建议。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="例如：请把官网、产品文档和 FAQ 同步成一个面向销售团队的知识 Agent，先给我计划和审批点。"
          className="min-h-[160px]"
        />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <div className="text-sm font-medium">审阅模式</div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={reviewMode === "draft_for_review" ? "default" : "outline"}
                onClick={() => onReviewModeChange("draft_for_review")}
              >
                先审阅再执行
              </Button>
              <Button
                type="button"
                variant={reviewMode === "plan_only" ? "default" : "outline"}
                onClick={() => onReviewModeChange("plan_only")}
              >
                只生成计划
              </Button>
            </div>
          </div>
          <div className="flex gap-3">
            <Input value="knowledge_builder" readOnly className="w-[180px] bg-muted/40" />
            <Button onClick={onSubmit} disabled={isSubmitting || !draft.trim()}>
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              生成计划
            </Button>
          </div>
        </div>

        {error ? (
          <Alert className="border-rose-200 bg-rose-50 text-rose-900">
            <AlertTitle>Mission API 调用失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
