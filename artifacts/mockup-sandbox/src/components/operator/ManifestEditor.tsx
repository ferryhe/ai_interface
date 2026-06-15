import { useEffect, useMemo, useState } from "react";
import { PencilLine, Save, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AgentManifestPreview } from "@/components/mockups/ai-os/_shared/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { formatOperatorSourceLabel } from "./ManifestViewer";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksSensitiveKey(key: string): boolean {
  return /(secret|token|api[_-]?key|apikey|password|bearer|authorization|client[_-]?secret|refresh[_-]?token|access[_-]?token|mcp|provider|url|uri|endpoint|path|directory|workdir|cwd|root)/i.test(
    key,
  );
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

function redactEditableValue(
  value: unknown,
  parentKey = "",
  redactionPlaceholder = "[redacted]",
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      redactEditableValue(entry, parentKey, redactionPlaceholder),
    );
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (looksSensitiveKey(key)) {
          return [key, redactionPlaceholder];
        }
        return [key, redactEditableValue(entry, key, redactionPlaceholder)];
      }),
    );
  }

  if (typeof value === "string") {
    return looksSensitiveKey(parentKey) || looksSensitiveValue(value)
      ? redactionPlaceholder
      : value;
  }

  return value;
}

function toEditableManifest(
  agent: AgentManifestPreview,
  redactionPlaceholder: string,
): string {
  return JSON.stringify(redactEditableValue(agent, "", redactionPlaceholder), null, 2);
}

type SaveState = "idle" | "saving" | "saved" | "failed";

export function ManifestEditor({
  agents,
  selectedAgentId,
}: {
  agents: AgentManifestPreview[];
  selectedAgentId: string | null;
}) {
  const { t } = useTranslation();
  const redactionPlaceholder = t("operator.redaction.placeholder");
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agentId === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );
  const editableAgent = selectedAgent?.source === "custom" ? selectedAgent : null;
  const [editorValue, setEditorValue] = useState<string>(
    editableAgent ? toEditableManifest(editableAgent, redactionPlaceholder) : "",
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    setEditorValue(
      editableAgent ? toEditableManifest(editableAgent, redactionPlaceholder) : "",
    );
    setSaveState("idle");
    setMessage("");
  }, [editableAgent, redactionPlaceholder]);

  async function saveManifest(): Promise<void> {
    if (!editableAgent) return;

    let parsed: Record<string, unknown>;
    try {
      const candidate = JSON.parse(editorValue) as unknown;
      if (!isRecord(candidate)) {
        throw new Error(t("operator.manifestEditor.errors.mustBeObject"));
      }
      parsed = { ...candidate };
    } catch (error) {
      setSaveState("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : t("operator.manifestEditor.errors.invalidJson"),
      );
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
        throw new Error(
          payload.error ??
            t("operator.manifestEditor.errors.apiReturned", {
              status: response.status,
            }),
        );
      }

      setSaveState("saved");
      setMessage(t("operator.manifestEditor.messages.saved"));
    } catch (error) {
      setSaveState("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : t("operator.manifestEditor.errors.writeFailed"),
      );
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PencilLine className="h-4 w-4" />
            {t("operator.manifestEditor.title")}
          </CardTitle>
          <Badge variant="outline">{t("operator.manifestEditor.badges.customOnly")}</Badge>
          <Badge variant="outline">{t("operator.manifestEditor.badges.localhostGuarded")}</Badge>
        </div>
        <CardDescription>
          {t("operator.manifestEditor.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>{t("operator.manifestEditor.guardrails.title")}</AlertTitle>
          <AlertDescription>
            {t("operator.manifestEditor.guardrails.prefix")}{" "}
            <code>agents/custom/&lt;agentId&gt;/agent.yaml</code>
            {t("operator.manifestEditor.guardrails.suffix")}
          </AlertDescription>
        </Alert>

        {!selectedAgent ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            {t("operator.manifestEditor.emptySelect")}
          </div>
        ) : !editableAgent ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            {t("operator.manifestEditor.nonCustom", {
              agentId: selectedAgent.agentId,
              source: formatOperatorSourceLabel(selectedAgent.source, t),
            })}
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {t("operator.manifestEditor.editing", {
                agentId: editableAgent.agentId,
              })}
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
                {saveState === "saving"
                  ? t("operator.manifestEditor.saving")
                  : t("operator.manifestEditor.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditorValue(toEditableManifest(editableAgent, redactionPlaceholder));
                  setSaveState("idle");
                  setMessage("");
                }}
              >
                {t("operator.manifestEditor.reset")}
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
