import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_LOCALE, formatDateTimeForLocale, i18nStatusKey, normalizeLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bot, CircleCheckBig, Clock3, ExternalLink, PauseCircle, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ArtifactStrip } from "./ArtifactStrip";
import type { MissionBoardAgent } from "./mission-types";

const statusTone: Record<MissionBoardAgent["status"], string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  running: "border-sky-200 bg-sky-50 text-sky-700",
  waiting_approval: "border-amber-200 bg-amber-50 text-amber-800",
  blocked: "border-orange-200 bg-orange-50 text-orange-800",
  succeeded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

function StatusIcon({ status }: { status: MissionBoardAgent["status"] }) {
  if (status === "running") return <PlayCircle className="h-3.5 w-3.5" />;
  if (status === "waiting_approval") return <PauseCircle className="h-3.5 w-3.5" />;
  if (status === "blocked" || status === "failed") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (status === "succeeded") return <CircleCheckBig className="h-3.5 w-3.5" />;
  return <Clock3 className="h-3.5 w-3.5" />;
}

function formatTime(value: string | undefined, locale: ReturnType<typeof normalizeLocale>): string | null {
  if (!value) return null;
  return formatDateTimeForLocale(value, locale ?? DEFAULT_LOCALE);
}

export function AgentStatusCard({ agent }: { agent: MissionBoardAgent }) {
  const { i18n, t } = useTranslation();
  const locale = normalizeLocale(i18n.resolvedLanguage) ?? DEFAULT_LOCALE;
  const lastEventAt = formatTime(agent.lastEventAt, locale);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              {agent.displayName}
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              {agent.roleId ?? agent.agentId ?? t("common.missionRole")}
              {" · "}
              {agent.moduleRunIds.length > 0
                ? t("common.runs", { count: agent.moduleRunIds.length })
                : t("common.noRunsYet")}
            </div>
          </div>
          <Badge variant="outline" className={cn("gap-1 capitalize", statusTone[agent.status])}>
            <StatusIcon status={agent.status} />
            {t(i18nStatusKey(agent.status))}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.currentAction")}</div>
          <p className="mt-1 text-sm leading-6 text-foreground">{agent.currentAction}</p>
        </div>

        {agent.blockingReason ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-medium">{t("common.blockingReason")}</div>
            <p className="mt-1 leading-6">{agent.blockingReason}</p>
          </div>
        ) : null}

        {agent.status === "waiting_approval" ? (
          <a
            href="#approval-inbox"
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-800 underline-offset-4 hover:underline"
          >
            {t("agentStatus.approvalLink")}
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.latestArtifacts")}</div>
          <ArtifactStrip artifacts={agent.latestArtifacts} />
        </div>

        {lastEventAt ? (
          <div className="text-xs text-muted-foreground">{t("common.lastActivity", { time: lastEventAt })}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
