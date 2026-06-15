import { useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { Bot, Boxes, Eye, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AgentManifestPreview } from "@/components/mockups/ai-os/_shared/types";

import { ManifestEditor } from "./ManifestEditor";
import { ManifestViewer, inferSkillSource, type ManifestViewerItem } from "./ManifestViewer";
import { WorkbenchFileViewer } from "./WorkbenchFileViewer";

type OperatorTab = "agents" | "skills" | "workbench";

interface OperatorSkillManifest {
  id: string;
  name: string;
  description: string;
  project: {
    defaultSiblingPath: string;
    envPath?: string;
    readiness: "ready" | "not_configured";
    source?: string;
  };
  execution: {
    adapterId: string;
    kind: "cli" | "http" | "internal" | "mcp";
    requiredEnv: string[];
    supportsResume: boolean;
  };
  ui: {
    mode: "html" | "renderer" | "auto";
    htmlEntrypoint?: string;
    openOnTrigger: boolean;
    preferredRenderer: string;
  };
  artifactKinds: string[];
  interactionKinds: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

function toAgentManifestItems(
  agents: AgentManifestPreview[],
  t: TFunction,
): ManifestViewerItem[] {
  return agents.map((agent) => ({
    id: agent.agentId,
    name: agent.title ?? agent.name,
    description: agent.description,
    source: agent.source,
    subtitle: t("operator.backstage.skillCount", { count: agent.skills.length }),
    manifest: agent,
  }));
}

function toSkillManifestItems(
  skills: OperatorSkillManifest[],
  t: TFunction,
): ManifestViewerItem[] {
  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    source: inferSkillSource(skill.project.defaultSiblingPath, skill.project.source),
    subtitle: t("operator.backstage.skillSubtitle", {
      kind: skill.execution.kind,
      readiness: t(`operator.backstage.readiness.${skill.project.readiness}`),
    }),
    // defaultSiblingPath is intentionally omitted — local paths are redacted in operator view
    manifest: skill,
  }));
}

export function OperatorBackstage({
  agents,
  skills,
}: {
  agents: AgentManifestPreview[];
  skills: OperatorSkillManifest[];
}) {
  const { t } = useTranslation();
  const agentItems = useMemo(() => toAgentManifestItems(agents, t), [agents, t]);
  const skillItems = useMemo(() => toSkillManifestItems(skills, t), [skills, t]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agentItems[0]?.id ?? null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(skillItems[0]?.id ?? null);
  const [selectedWorkbenchPath, setSelectedWorkbenchPath] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t("operator.backstage.badges.operator")}</Badge>
            <Badge variant="outline">{t("operator.backstage.badges.guardedWrites")}</Badge>
            <Badge variant="outline">{t("operator.backstage.badges.governance")}</Badge>
          </div>
          <CardTitle className="mt-2 flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" />
            {t("operator.backstage.title")}
          </CardTitle>
          <CardDescription>
            {t("operator.backstage.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">
                {t("operator.backstage.cards.agents.title")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("operator.backstage.cards.agents.description")}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">
                {t("operator.backstage.cards.skills.title")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("operator.backstage.cards.skills.description")}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">
                {t("operator.backstage.cards.workbench.title")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("operator.backstage.cards.workbench.description")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="h-4 w-4" />
            {t("operator.backstage.tabs.agents")}
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <Boxes className="h-4 w-4" />
            {t("operator.backstage.tabs.skills")}
          </TabsTrigger>
          <TabsTrigger value="workbench" className="gap-2">
            <Eye className="h-4 w-4" />
            {t("operator.backstage.tabs.workbench")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <ManifestViewer
            title={t("operator.backstage.agentManifests.title")}
            description={t("operator.backstage.agentManifests.description")}
            items={agentItems}
            selectedId={selectedAgentId}
            onSelect={setSelectedAgentId}
          />
          <ManifestEditor agents={agents} selectedAgentId={selectedAgentId} />
        </TabsContent>

        <TabsContent value="skills">
          <ManifestViewer
            title={t("operator.backstage.skillManifests.title")}
            description={t("operator.backstage.skillManifests.description")}
            items={skillItems}
            selectedId={selectedSkillId}
            onSelect={setSelectedSkillId}
          />
        </TabsContent>

        <TabsContent value="workbench">
          <WorkbenchFileViewer
            selectedPath={selectedWorkbenchPath}
            onSelect={setSelectedWorkbenchPath}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
