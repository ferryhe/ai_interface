import { useEffect, useMemo, useState } from "react";
import { PencilLine, Save, ShieldCheck } from "lucide-react";

import type { AgentManifestPreview } from "@/components/mockups/ai-os/_shared/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksSensitiveValue(value: string): boolean {
  return (
    /^(https?|wss?):\/\//i.test(value) ||
    /(^|\s)(sk-[a-z0-9]|gh[pousr]_[a-z0-9]|xox[baprs]-|Bearer\s+[A-Za-z0-9._-]+)/i.test(value) ||
    /(^~\/|^\/|^[A-Za-z]:\\)/.test(value) ||
    /localhost[:/]/i.test(value) ||
    /mcp/i.test(value) ||
    /provider/i.test(value)
  );
}

function redactEditableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactEditableValue(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactEditableValue(entry)]),
    );
  }

  if (typeof value === "string") {
    return looksSensitiveValue(value) ? "[redacted]" : value;
  }

  return value;
}

function toEditableManifest(agent: AgentManifestPreview): string {
  return JSON.stringify(redactEditableValue(agent), null, 2);
}

type SaveState = "idle" | "saving" | "saved" | "failed";

export function ManifestEditor({
  agents,
  selectedAgentId,
}: {
  agents: AgentManifestPreview[];
  selectedAgentId: string | null;
}) {
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agentId === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );
  const editableAgent = selectedAgent?.source === "custom" ? selectedAgent : null;
  const [editorValue, setEditorValue] = useState<string>(
    editableAgent ? toEditableManifest(editableAgent) : "",
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    setEditorValue(editableAgent ? toEditableManifest(editableAgent) : "");
    setSaveState("idle");
    setMessage("");
  }, [editableAgent]);

  async function saveManifest(): Promise<void> {
    if (!editableAgent) return;

    let parsed: Record<string, unknown>;
    try {
      const candidate = JSON.parse(editorValue) as unknown;
      if (!isRecord(candidate)) {
        throw new Error("Manifest JSON must be an object.");
      }
      parsed = { ...candidate };
    } catch (error) {
      setSaveState("failed");
      setMessage(error instanceof Error ? error.message : "Invalid manifest JSON.");
      return;
    }

    delete parsed.agentId;
    delete parsed.source;

    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/agent-manifests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: editableAgent.agentId,
          manifest: parsed,
          overwrite: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? `Manifest API returned ${response.status}`);
      }

      setSaveState("saved");
      setMessage("Custom manifest written through guarded localhost-only API.");
    } catch (error) {
      setSaveState("failed");
      setMessage(error instanceof Error ? error.message : "Manifest write failed.");
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PencilLine className="h-4 w-4" />
            Custom manifest editor
          </CardTitle>
          <Badge variant="outline">custom only</Badge>
          <Badge variant="outline">localhost guarded</Badge>
        </div>
        <CardDescription>
          Built-in and community manifests stay read-only. Editor content is redacted before display so operator view does not expose raw secrets or local paths.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Guardrails stay in effect</AlertTitle>
          <AlertDescription>
            Writes are limited to <code>agents/custom/&lt;agentId&gt;/agent.yaml</code>, require same-origin localhost access, and return redacted responses.
          </AlertDescription>
        </Alert>

        {!selectedAgent ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            Select an agent manifest to inspect or edit.
          </div>
        ) : !editableAgent ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedAgent.agentId}</span> is a {selectedAgent.source} manifest. Operator editing is only enabled for custom manifests.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Editing <span className="font-medium text-foreground">{editableAgent.agentId}</span>. Redacted placeholders may need to be replaced manually before saving.
            </div>
            <Textarea
              value={editorValue}
              onChange={(event) => {
                setEditorValue(event.target.value);
                setSaveState("idle");
                setMessage("");
              }}
              className="min-h-[360px] font-mono text-xs leading-6"
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void saveManifest()} disabled={saveState === "saving"}>
                <Save className="h-4 w-4" />
                {saveState === "saving" ? "Saving" : "Save custom manifest"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditorValue(toEditableManifest(editableAgent));
                  setSaveState("idle");
                  setMessage("");
                }}
              >
                Reset redacted draft
              </Button>
              {message ? (
                <span
                  className={`text-sm ${
                    saveState === "failed" ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {message}
                </span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
