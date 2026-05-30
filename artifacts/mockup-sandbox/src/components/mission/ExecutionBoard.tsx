import { useCallback, useEffect, useState } from "react";

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
      setErrorMessage(error instanceof Error ? error.message : "Execution board unavailable");
    } finally {
      setLoadState("idle");
    }
  }, [missionId]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4" />
              Execution Board
            </CardTitle>
            <CardDescription>
              默认按 Agent / Role 展示执行状态、卡点与最新产物。
              {revisionId ? ` 当前 revision: ${revisionId}` : ""}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadBoard()}
            disabled={!missionId || loadState === "loading"}
          >
            <RefreshCcw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <Alert className="border-rose-200 bg-rose-50 text-rose-900">
            <AlertTitle>Execution Board 不可用</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {missionId && loadState === "loading" ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            正在同步 Mission execution board；稍后会显示最新角色状态、阻塞点与产物摘要。
          </div>
        ) : null}

        {!missionId ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            先创建并选择一个 Mission，再查看 Execution Board。
          </div>
        ) : null}

        {missionId && board.length === 0 && loadState !== "loading" && !errorMessage ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            当前还没有可展示的执行记录；approve 只确认计划，只有 execute 后这里才会出现真实运行状态与产物回链。
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
