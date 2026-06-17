import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid, RefreshCcw } from "lucide-react";

import { AgentStatusCard } from "./AgentStatusCard";
import type { MissionBoardAgent, MissionBoardResponse } from "./mission-types";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error ?? data.message ?? `Request failed with ${response.status}`;
  } catch {
    const text = await response.text();
    return text || `Request failed with ${response.status}`;
  }
}

export function ExecutionBoard({ missionId }: { missionId: string | null }) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<MissionBoardAgent[]>([]);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    if (!missionId) {
      setBoard([]);
      setRevisionId(null);
      setErrorMessage(null);
      return;
    }

    setLoadState("loading");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(missionId)}/board`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const data = await readJson<MissionBoardResponse>(response);
      setBoard(data.board ?? []);
      setRevisionId(data.revisionId ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("executionBoard.unavailableFallback"));
    } finally {
      setLoadState("idle");
    }
  }, [missionId, t]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <Card className="border-border bg-muted/20 shadow-none">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4" />
              {t("executionBoard.title")}
            </CardTitle>
            <CardDescription>
              {t("executionBoard.description")}
              {revisionId ? t("executionBoard.revisionSuffix", { revisionId }) : ""}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadBoard()}
            disabled={!missionId || loadState === "loading"}
          >
            <RefreshCcw className="h-4 w-4" />
            {t("common.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <Alert className="border-rose-500/35 bg-rose-500/10 text-rose-100">
            <AlertTitle>{t("executionBoard.unavailableTitle")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {missionId && loadState === "loading" ? (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {t("executionBoard.loading")}
          </div>
        ) : null}

        {!missionId ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {t("executionBoard.noMission")}
          </div>
        ) : null}

        {missionId && board.length === 0 && loadState !== "loading" && !errorMessage ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {t("executionBoard.empty")}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {board.map((agent) => (
            <AgentStatusCard
              key={`${agent.roleId ?? "role:none"}:${agent.agentId ?? "agent:none"}:${agent.displayName}`}
              agent={agent}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
