import { useMemo } from "react";
import { BookOpenText, FileCode2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import { formatOperatorSourceLabel } from "./ManifestViewer";

const workbenchDocs = import.meta.glob("../../../../../docs/workbench/**/*.{md,yaml}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

interface WorkbenchDocRecord {
  id: string;
  path: string;
  title: string;
  extension: string;
  content: string;
  source: "workbench";
}

function buildWorkbenchDocs(): WorkbenchDocRecord[] {
  return Object.entries(workbenchDocs)
    .map(([path, content]) => {
      const relativePath = path.split("/docs/workbench/")[1] ?? path;
      const fileName = relativePath.split("/").at(-1) ?? relativePath;
      const extension = fileName.split(".").at(-1) ?? "txt";
      return {
        id: relativePath,
        path: `docs/workbench/${relativePath}`,
        title: fileName,
        extension,
        content,
        source: "workbench" as const,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function looksSensitiveLine(line: string): boolean {
  return (
    /(token|secret|password|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)/i.test(
      line,
    ) ||
    /(https?|wss?):\/\//i.test(line) ||
    /(^|\s)(~\/|\/home\/|\/[A-Za-z0-9_.-]+\/)/.test(line) ||
    /mcp/i.test(line)
  );
}

function redactWorkbenchContent(content: string, redactionPlaceholder: string): string {
  return content
    .split("\n")
    .map((line) => (looksSensitiveLine(line) ? redactionPlaceholder : line))
    .join("\n");
}

export function WorkbenchFileViewer({
  selectedPath,
  onSelect,
}: {
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const { t } = useTranslation();
  const redactionPlaceholder = t("operator.redaction.placeholder");
  const docs = useMemo(() => buildWorkbenchDocs(), []);
  const selectedDoc = docs.find((doc) => doc.path === selectedPath) ?? docs[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenText className="h-4 w-4" />
            {t("operator.workbench.title")}
          </CardTitle>
          <CardDescription>
            {t("operator.workbench.descriptionPrefix")} <code>docs/workbench/*</code>{" "}
            {t("operator.workbench.descriptionSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-2">
              {docs.map((doc) => {
                const isActive = doc.path === (selectedDoc?.path ?? null);
                return (
                  <button
                    key={doc.path}
                    type="button"
                    onClick={() => onSelect(doc.path)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border/60 bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{doc.title}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{doc.path}</div>
                      </div>
                      <Badge variant="secondary">{t("operator.source.workbench")}</Badge>
                    </div>
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
              {selectedDoc?.title ?? t("operator.workbench.emptyTitle")}
            </CardTitle>
            {selectedDoc ? <Badge variant="outline">{selectedDoc.extension}</Badge> : null}
            <Badge variant="outline">{t("operator.source.workbench")}</Badge>
            <Badge variant="outline">{t("operator.manifestViewer.readOnly")}</Badge>
          </div>
          <CardDescription>
            {selectedDoc?.path ?? t("operator.workbench.emptyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {t("operator.workbench.redactionNotice")}
          </div>
          {selectedDoc ? (
            <ScrollArea className="h-[500px] rounded-lg border border-border/60 bg-slate-950/95 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                <FileCode2 className="h-4 w-4" />
                {t("operator.workbench.sourceLabel")}{" "}
                {formatOperatorSourceLabel(selectedDoc.source, t)}
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-100">
                {redactWorkbenchContent(selectedDoc.content, redactionPlaceholder)}
              </pre>
            </ScrollArea>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
              {t("operator.workbench.emptyDescription")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
