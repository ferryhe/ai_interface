import { useMemo } from "react";
import type { TFunction } from "i18next";
import { FileJson, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ManifestViewerItem {
  id: string;
  name: string;
  description: string;
  source: string;
  manifest: unknown;
  subtitle?: string;
}

function normalizeSourceLabel(source: string): string {
  if (source === "builtin") return "built-in";
  return source;
}

const SOURCE_LABEL_KEYS: Record<string, string> = {
  "built-in": "operator.source.builtin",
  builtin: "operator.source.builtin",
  community: "operator.source.community",
  custom: "operator.source.custom",
  workbench: "operator.source.workbench",
};

export function formatOperatorSourceLabel(source: string, t: TFunction): string {
  const normalized = normalizeSourceLabel(source);
  return t(SOURCE_LABEL_KEYS[normalized] ?? "operator.source.unknown", {
    source: normalized,
  });
}

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

function redactValue(
  value: unknown,
  parentKey = "",
  redactionPlaceholder = "[redacted]",
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, parentKey, redactionPlaceholder));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (looksSensitiveKey(key)) {
          return [key, redactionPlaceholder];
        }
        return [key, redactValue(entry, key, redactionPlaceholder)];
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

function formatScalar(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value === null) return "null";
  if (typeof value === "undefined") return "null";
  return String(value);
}

function yamlLines(value: unknown, indent = 0): string[] {
  const pad = "  ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`];
    return value.flatMap((entry) => {
      if (Array.isArray(entry) || isRecord(entry)) {
        const nested = yamlLines(entry, indent + 1);
        return [`${pad}- ${nested[0]?.trimStart() ?? ""}`, ...nested.slice(1)];
      }
      return [`${pad}- ${formatScalar(entry)}`];
    });
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return [`${pad}{}`];
    return entries.flatMap(([key, entry]) => {
      if (Array.isArray(entry) || isRecord(entry)) {
        return [`${pad}${key}:`, ...yamlLines(entry, indent + 1)];
      }
      return [`${pad}${key}: ${formatScalar(entry)}`];
    });
  }

  return [`${pad}${formatScalar(value)}`];
}

export function inferSkillSource(defaultSiblingPath: string, rawSource?: string): string {
  if (rawSource && rawSource.trim() !== "") return normalizeSourceLabel(rawSource);
  if (defaultSiblingPath.includes("skills/community")) return "community";
  if (defaultSiblingPath.includes("skills/custom")) return "custom";
  return "built-in";
}

export function ManifestViewer({
  title,
  description,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  description: string;
  items: ManifestViewerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const redactionPlaceholder = t("operator.redaction.placeholder");
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const redactedManifest = selectedItem
    ? redactValue(selectedItem.manifest, "", redactionPlaceholder)
    : null;
  const renderedYaml = redactedManifest ? yamlLines(redactedManifest).join("\n") : "";

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson className="h-4 w-4" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-2">
              {items.map((item) => {
                const isActive = item.id === (selectedItem?.id ?? null);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border/60 bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{item.id}</div>
                      </div>
                      <Badge variant="secondary" className="shrink-0 capitalize">
                        {formatOperatorSourceLabel(item.source, t)}
                      </Badge>
                    </div>
                    {item.subtitle ? (
                      <div className="mt-2 text-xs text-muted-foreground">{item.subtitle}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {selectedItem?.name ?? t("operator.manifestViewer.emptyTitle")}
            </CardTitle>
            {selectedItem ? (
              <Badge variant="outline" className="capitalize">
                {formatOperatorSourceLabel(selectedItem.source, t)}
              </Badge>
            ) : null}
            <Badge variant="outline">{t("operator.manifestViewer.readOnly")}</Badge>
          </div>
          <CardDescription>
            {selectedItem?.description ?? t("operator.manifestViewer.emptyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            {t("operator.manifestViewer.redactionNotice")}
          </div>
          {selectedItem ? (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t("operator.manifestViewer.manifestId")}
                </span>{" "}
                {selectedItem.id}
                {selectedItem.subtitle ? <span> · {selectedItem.subtitle}</span> : null}
              </div>
              <ScrollArea className="h-[460px] rounded-lg border border-border/60 bg-slate-950/95 p-4">
                <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-100">
                  {renderedYaml}
                </pre>
              </ScrollArea>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
              {t("operator.manifestViewer.emptyDescription")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
