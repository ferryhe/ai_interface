import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileStack } from "lucide-react";

import type { MissionBoardArtifact } from "./mission-types";

export function ArtifactStrip({
  artifacts,
  className,
}: {
  artifacts: MissionBoardArtifact[];
  className?: string;
}) {
  if (artifacts.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground", className)}>
        暂无最新产物。
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {artifacts.map((artifact) => (
        <Badge
          key={artifact.artifactId}
          variant="outline"
          className="max-w-full gap-1 overflow-hidden border-border/70 bg-background/80 px-2 py-1 text-xs"
          title={`${artifact.kind} · ${artifact.title}`}
        >
          <FileStack className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{artifact.title}</span>
          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
            {artifact.kind}
          </span>
        </Badge>
      ))}
    </div>
  );
}
