import { LoaderCircle, Send, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3">
        <Badge variant="outline" className="w-fit gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          {t("missionIntake.badge")}
        </Badge>
        <CardTitle className="text-2xl">{t("missionIntake.title")}</CardTitle>
        <CardDescription className="max-w-3xl text-sm leading-6">
          {t("missionIntake.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={t("missionIntake.placeholder")}
          className="min-h-[160px]"
        />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <div className="text-sm font-medium">{t("missionIntake.reviewMode")}</div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={reviewMode === "draft_for_review" ? "default" : "outline"}
                onClick={() => onReviewModeChange("draft_for_review")}
              >
                {t("missionIntake.draftForReview")}
              </Button>
              <Button
                type="button"
                variant={reviewMode === "plan_only" ? "default" : "outline"}
                onClick={() => onReviewModeChange("plan_only")}
              >
                {t("missionIntake.planOnly")}
              </Button>
            </div>
          </div>
          <div className="flex gap-3">
            <Input value="knowledge_builder" readOnly className="w-[180px] bg-muted/40" />
            <Button onClick={onSubmit} disabled={isSubmitting || !draft.trim()}>
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("missionIntake.submit")}
            </Button>
          </div>
        </div>

        {error ? (
          <Alert className="border-rose-200 bg-rose-50 text-rose-900">
            <AlertTitle>{t("missionIntake.apiFailed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
