import { moduleRegistry, type ModuleId } from "../modules/registry";
import type { BusinessSkillSetting } from "../agent-config/agent-config-service";
import type { JsonObject } from "../modules/ingest-service";
import {
  getAdapterDefinition,
  type ToolAdapterDefinition,
} from "../tool-adapters/adapter-registry";
import {
  manifestAdapterDefinition,
  type SkillManifest,
} from "../skill-runtime/skill-manifest";

export type SkillAdapterMode = "external_api" | "external_cli_or_api";

export interface BusinessSkillDefinition {
  skillId: string;
  moduleId: ModuleId;
  displayName: string;
  description: string;
  adapter: ToolAdapterDefinition;
  adapterMode: SkillAdapterMode;
  canonicalEntrypoints: string[];
  outputContracts: string[];
  inputSchema: JsonObject;
  permissionDefaults: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
  manifest?: SkillManifest;
}

const moduleDefinitionById = new Map(
  moduleRegistry.map((definition) => [definition.moduleId, definition]),
);

function moduleDescription(moduleId: ModuleId): string {
  const definition = moduleDefinitionById.get(moduleId);
  if (!definition) {
    throw new Error(`Unknown moduleId in skill registry: ${moduleId}`);
  }
  return definition.description;
}

export const businessSkillDefinitions: BusinessSkillDefinition[] = [
  {
    skillId: "web_listening",
    moduleId: "web_listening",
    displayName: "Web Listening",
    description: moduleDescription("web_listening"),
    adapter: getAdapterDefinition("web_listening"),
    adapterMode: "external_cli_or_api",
    canonicalEntrypoints: [
      "web-listening discover",
      "web-listening classify",
      "web-listening plan-scope",
      "web-listening bootstrap-scope",
      "web-listening run-scope",
      "web-listening export-manifest",
    ],
    outputContracts: ["web-listening-manifest.v1", "document_manifest.yaml"],
    inputSchema: {
      type: "object",
      properties: {
        siteUrl: { type: "string" },
        monitoringGoal: { type: "string" },
        stage: {
          type: "string",
          enum: [
            "discover",
            "classify",
            "plan_scope",
            "bootstrap_scope",
            "run_scope",
            "export_manifest",
          ],
        },
      },
      required: ["siteUrl", "monitoringGoal"],
    },
    permissionDefaults: {
      approvalRequired: true,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  },
  {
    skillId: "doc_to_md",
    moduleId: "doc_to_md",
    displayName: "Doc to Markdown",
    description: moduleDescription("doc_to_md"),
    adapter: getAdapterDefinition("doc_to_md"),
    adapterMode: "external_api",
    canonicalEntrypoints: [
      "GET /apps/conversion/engines",
      "GET /apps/conversion/engine-readiness",
      "POST /apps/conversion/convert",
      "POST /apps/conversion/convert-inline",
    ],
    outputContracts: [
      "doc_to_md.convert.v1",
      "markdown",
      "quality",
      "trace",
      "assets",
    ],
    inputSchema: {
      type: "object",
      properties: {
        sourceArtifactIds: { type: "array", items: { type: "string" } },
        engine: { type: "string" },
        includeAssets: { type: "boolean" },
      },
      required: ["sourceArtifactIds"],
    },
    permissionDefaults: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  },
  {
    skillId: "md_to_rag",
    moduleId: "md_to_rag",
    displayName: "Markdown to RAG",
    description: moduleDescription("md_to_rag"),
    adapter: getAdapterDefinition("md_to_rag"),
    adapterMode: "external_cli_or_api",
    canonicalEntrypoints: [
      "cross2.py build-ready-data",
      "cross2.py validate-ready-data",
      "cross2.py search sections",
      "cross2.py evidence",
    ],
    outputContracts: [
      "ready_data_manifest.json",
      "rag_chunk",
      "embedding_metadata",
    ],
    inputSchema: {
      type: "object",
      properties: {
        markdownArtifactIds: { type: "array", items: { type: "string" } },
        collection: { type: "string" },
        chunkingStrategy: { type: "string" },
      },
      required: ["markdownArtifactIds", "collection"],
    },
    permissionDefaults: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  },
  {
    skillId: "rag_to_agent",
    moduleId: "rag_to_agent",
    displayName: "RAG to Agent",
    description: moduleDescription("rag_to_agent"),
    adapter: getAdapterDefinition("rag_to_agent"),
    adapterMode: "external_api",
    canonicalEntrypoints: [
      "GET /api/engine/config",
      "POST /api/engine/plan",
      "POST /api/engine/chat",
    ],
    outputContracts: ["agent_config", "agent_prompt", "agent_validation"],
    inputSchema: {
      type: "object",
      properties: {
        ragIndexArtifactId: { type: "string" },
        agentName: { type: "string" },
        publishMode: { type: "string", enum: ["draft", "validated"] },
      },
      required: ["ragIndexArtifactId", "agentName"],
    },
    permissionDefaults: {
      approvalRequired: true,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  },
];

export function businessSkillDefinitionFromManifest(
  manifest: SkillManifest,
): BusinessSkillDefinition {
  return {
    skillId: manifest.skillId,
    moduleId: manifest.moduleId,
    displayName: manifest.title ?? manifest.name,
    description: manifest.description,
    adapter: manifestAdapterDefinition(manifest),
    adapterMode:
      manifest.execution.kind === "http" ? "external_api" : "external_cli_or_api",
    canonicalEntrypoints:
      manifest.execution.allowedCommands.length > 0
        ? [...manifest.execution.allowedCommands]
        : [manifest.execution.adapterId],
    outputContracts: [...manifest.artifactKinds],
    inputSchema: manifest.inputSchema,
    permissionDefaults: {
      approvalRequired: manifest.permissions.approvalRequired,
      canUseNetwork: manifest.permissions.canUseNetwork,
      canWriteDatabase: manifest.permissions.canWriteDatabase,
    },
    manifest,
  };
}

export function getBusinessSkillDefinition(
  moduleId: ModuleId,
): BusinessSkillDefinition {
  const definition = businessSkillDefinitions.find(
    (skill) => skill.moduleId === moduleId,
  );
  if (!definition) {
    throw new Error(`Business skill is not registered: ${moduleId}`);
  }
  return definition;
}

export function listEnabledBusinessSkillDefinitions(
  settings: BusinessSkillSetting[],
): BusinessSkillDefinition[] {
  const enabledModuleIds = new Set(
    settings
      .filter((setting) => setting.enabled)
      .map((setting) => setting.moduleId),
  );

  return businessSkillDefinitions.filter((definition) =>
    enabledModuleIds.has(definition.moduleId),
  );
}

export function getBusinessSkillSetting(
  settings: BusinessSkillSetting[],
  moduleId: ModuleId,
): BusinessSkillSetting | null {
  return settings.find((setting) => setting.moduleId === moduleId) ?? null;
}
