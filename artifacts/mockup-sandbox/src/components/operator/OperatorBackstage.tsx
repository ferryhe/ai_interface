import { useMemo, useState } from "react";
import { Bot, Boxes, Eye, ShieldCheck } from "lucide-react";

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

function toAgentManifestItems(agents: AgentManifestPreview[]): ManifestViewerItem[] {
  return agents.map((agent) => ({
    id: agent.agentId,
    name: agent.title ?? agent.name,
    description: agent.description,
    source: agent.source,
    subtitle: `${agent.skills.length} skills`,
    manifest: agent,
  }));
}

function toSkillManifestItems(skills: OperatorSkillManifest[]): ManifestViewerItem[] {
  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    source: inferSkillSource(skill.project.defaultSiblingPath, skill.project.source),
    subtitle: `${skill.execution.kind} · ${skill.project.readiness}`,
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
  const agentItems = useMemo(() => toAgentManifestItems(agents), [agents]);
  const skillItems = useMemo(() => toSkillManifestItems(skills), [skills]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agentItems[0]?.id ?? null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(skillItems[0]?.id ?? null);
  const [selectedWorkbenchPath, setSelectedWorkbenchPath] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Operator</Badge>
            <Badge variant="outline">guarded writes</Badge>
            <Badge variant="outline">governance</Badge>
          </div>
          <CardTitle className="mt-2 flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" />
            Operator Backstage
          </CardTitle>
          <CardDescription>
            Operator can inspect all manifests and workbench governance docs. Built-in/community manifests and workbench docs remain read-only; only custom agent manifests can be edited through the guarded localhost manifest API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">Agent manifests</div>
              <div className="mt-1 text-xs text-muted-foreground">Source-labelled review plus guarded custom-only editing with redacted responses.</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">Skill manifests</div>
              <div className="mt-1 text-xs text-muted-foreground">Built-in / community / custom sources normalized for operator review.</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">Workbench docs</div>
              <div className="mt-1 text-xs text-muted-foreground">Read-only docs/workbench visibility with workbench source badge.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="h-4 w-4" />
            Agent manifests
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <Boxes className="h-4 w-4" />
            Skill manifests
          </TabsTrigger>
          <TabsTrigger value="workbench" className="gap-2">
            <Eye className="h-4 w-4" />
            Workbench docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <ManifestViewer
            title="Agent manifests"
            description="Read-only review of registered agent manifests via existing GET /api/agents data. Only custom manifests can be mutated below."
            items={agentItems}
            selectedId={selectedAgentId}
            onSelect={setSelectedAgentId}
          />
          <ManifestEditor agents={agents} selectedAgentId={selectedAgentId} />
        </TabsContent>

        <TabsContent value="skills">
          <ManifestViewer
            title="Skill manifests"
            description="Read-only view of registered skill manifests via existing GET /api/skills data."
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
