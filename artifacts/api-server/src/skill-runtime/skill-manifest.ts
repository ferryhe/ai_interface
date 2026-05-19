import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { JsonObject, ToolInteractionKind } from "../modules/ingest-service";
import type { ModuleId } from "../modules/registry";
import type { ToolAdapterDefinition } from "../tool-adapters/adapter-registry";

export type SkillId = string;

export type SkillCategory = "source" | "transform" | "index" | "agent";

export type SkillToolAdapterKind = "http" | "cli";

export type SkillExecutionKind = SkillToolAdapterKind | "internal" | "mcp";

export type SkillArtifactRenderer =
  | "markdown"
  | "table"
  | "json"
  | "text"
  | "image"
  | "file";

export type SkillUiMode = "html" | "renderer" | "auto";

export type SkillProjectSource = "builtin" | "external";

export type SkillProjectReadinessStatus = "ready" | "not_configured";

export interface SkillProjectMetadata {
  source: SkillProjectSource;
  defaultSiblingPath: string;
  envPath?: string;
  repoUrl?: string;
  packageName?: string;
}

export interface SkillUi {
  mode: SkillUiMode;
  htmlEntrypoint?: string;
  openOnTrigger: boolean;
  preferredRenderer: SkillArtifactRenderer;
}

export interface SkillExecution {
  kind: SkillExecutionKind;
  adapterId: string;
  requiredEnv: string[];
  optionalEnv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  allowedCommands: string[];
  supportsResume: boolean;
  readinessHint?: string;
}

export interface SkillPermissionDefaults {
  approvalRequired: boolean;
  canUseNetwork: boolean;
  canWriteDatabase: boolean;
}

export interface SkillManifest {
  skillId: SkillId;
  moduleId: ModuleId;
  name: string;
  title?: string;
  description: string;
  category: SkillCategory;
  project: SkillProjectMetadata;
  execution: SkillExecution;
  inputSchema: JsonObject;
  outputSchema: JsonObject;
  interactionKinds: ToolInteractionKind[];
  artifactKinds: string[];
  ui: SkillUi;
  permissions: SkillPermissionDefaults;
}

export interface SkillManifestRegistry {
  listSkills(): SkillManifest[];
  getSkill(skillId: string): SkillManifest | null;
  hasSkill(skillId: string): boolean;
  listSkillIds(): string[];
}

export interface SkillReadiness {
  skillId: string;
  project: {
    status: SkillProjectReadinessStatus;
    configuredBy: string | null;
    defaultSiblingPath: string;
  };
  adapter: {
    status: "ready" | "missing_required_env";
    configured: boolean;
    adapterId: string;
    missingRequiredEnv: string[];
    configuredOptionalEnv: string[];
  };
  ui: {
    mode: SkillUiMode;
    hasHtml: boolean;
    openOnTrigger: boolean;
    preferredRenderer: SkillArtifactRenderer;
  };
}

function skillExecution(input: SkillExecution): SkillExecution {
  return {
    ...input,
    requiredEnv: [...input.requiredEnv],
    optionalEnv: [...input.optionalEnv],
    allowedCommands: [...input.allowedCommands],
  };
}

export const builtinSkillManifests: SkillManifest[] = [
  {
    skillId: "web_listening",
    moduleId: "web_listening",
    name: "Web Listening",
    description:
      "Monitor web pages, create snapshots, extract text, and detect changes.",
    category: "source",
    project: {
      source: "builtin",
      defaultSiblingPath: "../web_listening",
      envPath: "WEB_LISTENING_PROJECT_PATH",
      repoUrl: "https://github.com/ferryhe/web_listening",
      packageName: "web_listening",
    },
    execution: skillExecution({
      kind: "cli",
      adapterId: "web_listening.cli.v1",
      requiredEnv: ["WEB_LISTENING_CLI_PATH"],
      optionalEnv: ["WEB_LISTENING_WORKDIR", "WEB_LISTENING_API_BASE_URL"],
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      allowedCommands: [
        "discover",
        "classify",
        "plan-scope",
        "bootstrap-scope",
        "run-scope",
        "export-manifest",
      ],
      supportsResume: true,
      readinessHint: "Set WEB_LISTENING_CLI_PATH to enable CLI handoffs.",
    }),
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
    outputSchema: {
      type: "object",
      properties: {
        manifest: { type: "object" },
        snapshots: { type: "array" },
        events: { type: "array" },
      },
    },
    interactionKinds: ["question", "approval", "blocked"],
    artifactKinds: ["web_snapshot", "extracted_text", "change_event"],
    ui: {
      mode: "html",
      htmlEntrypoint: "/skill-ui/web_listening",
      openOnTrigger: true,
      preferredRenderer: "json",
    },
    permissions: {
      approvalRequired: true,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  },
  {
    skillId: "doc_to_md",
    moduleId: "doc_to_md",
    name: "Doc to Markdown",
    description:
      "Convert source documents into Markdown with warnings and extracted assets.",
    category: "transform",
    project: {
      source: "builtin",
      defaultSiblingPath: "../doc_to_md",
      envPath: "DOC_TO_MD_PROJECT_PATH",
      repoUrl: "https://github.com/ferryhe/doc_to_md",
      packageName: "doc_to_md",
    },
    execution: skillExecution({
      kind: "http",
      adapterId: "doc_to_md.http.v1",
      requiredEnv: ["DOC_TO_MD_API_BASE_URL"],
      optionalEnv: ["DOC_TO_MD_API_TOKEN"],
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      allowedCommands: [],
      supportsResume: true,
      readinessHint: "Set DOC_TO_MD_API_BASE_URL to enable HTTP handoffs.",
    }),
    inputSchema: {
      type: "object",
      properties: {
        sourceArtifactIds: { type: "array", items: { type: "string" } },
        engine: { type: "string" },
        includeAssets: { type: "boolean" },
      },
      required: ["sourceArtifactIds"],
    },
    outputSchema: {
      type: "object",
      properties: {
        markdown: { type: "string" },
        quality: { type: "object" },
        trace: { type: "array" },
        assets: { type: "array" },
      },
    },
    interactionKinds: ["question", "data_request"],
    artifactKinds: ["markdown_document", "conversion_warning", "document_asset"],
    ui: {
      mode: "renderer",
      openOnTrigger: false,
      preferredRenderer: "markdown",
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  },
  {
    skillId: "md_to_rag",
    moduleId: "md_to_rag",
    name: "Markdown to RAG",
    description:
      "Chunk Markdown, prepare embeddings, and build RAG index records.",
    category: "index",
    project: {
      source: "builtin",
      defaultSiblingPath: "../c-ross-2",
      envPath: "CROSS2_PROJECT_PATH",
      repoUrl: "https://github.com/ferryhe/c-ross-2",
      packageName: "c-ross-2",
    },
    execution: skillExecution({
      kind: "cli",
      adapterId: "md_to_rag.cli.v1",
      requiredEnv: ["CROSS2_CLI_PATH"],
      optionalEnv: ["CROSS2_WORKDIR", "CROSS2_API_BASE_URL"],
      timeoutMs: 180000,
      maxOutputBytes: 1048576,
      allowedCommands: [
        "build-ready-data",
        "validate-ready-data",
        "search sections",
        "evidence",
      ],
      supportsResume: false,
      readinessHint: "Set CROSS2_CLI_PATH to enable CLI handoffs.",
    }),
    inputSchema: {
      type: "object",
      properties: {
        markdownArtifactIds: { type: "array", items: { type: "string" } },
        collection: { type: "string" },
        chunkingStrategy: { type: "string" },
      },
      required: ["markdownArtifactIds", "collection"],
    },
    outputSchema: {
      type: "object",
      properties: {
        manifest: { type: "object" },
        chunks: { type: "array" },
        embeddings: { type: "array" },
      },
    },
    interactionKinds: ["question", "data_request", "blocked"],
    artifactKinds: ["rag_chunk", "embedding_metadata", "rag_index"],
    ui: {
      mode: "renderer",
      openOnTrigger: false,
      preferredRenderer: "table",
    },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  },
  {
    skillId: "rag_to_agent",
    moduleId: "rag_to_agent",
    name: "RAG to Agent",
    description: "Generate agent configs, prompts, tools, and validation results.",
    category: "agent",
    project: {
      source: "builtin",
      defaultSiblingPath: "../c-ross-2",
      envPath: "CROSS2_PROJECT_PATH",
      repoUrl: "https://github.com/ferryhe/c-ross-2",
      packageName: "c-ross-2",
    },
    execution: skillExecution({
      kind: "http",
      adapterId: "rag_to_agent.http.v1",
      requiredEnv: ["RAG_TO_AGENT_API_BASE_URL"],
      optionalEnv: ["RAG_TO_AGENT_API_TOKEN"],
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      allowedCommands: [],
      supportsResume: true,
      readinessHint: "Set RAG_TO_AGENT_API_BASE_URL to enable HTTP handoffs.",
    }),
    inputSchema: {
      type: "object",
      properties: {
        ragIndexArtifactId: { type: "string" },
        agentName: { type: "string" },
        publishMode: { type: "string", enum: ["draft", "validated"] },
      },
      required: ["ragIndexArtifactId", "agentName"],
    },
    outputSchema: {
      type: "object",
      properties: {
        agentConfig: { type: "object" },
        prompt: { type: "string" },
        validation: { type: "object" },
      },
    },
    interactionKinds: ["question", "approval", "blocked"],
    artifactKinds: ["agent_config", "agent_prompt", "agent_validation"],
    ui: {
      mode: "html",
      htmlEntrypoint: "/skill-ui/rag_to_agent",
      openOnTrigger: true,
      preferredRenderer: "json",
    },
    permissions: {
      approvalRequired: true,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
  },
  {
    skillId: "climate_monitor",
    moduleId: "climate_monitor",
    name: "Climate Monitor",
    description:
      "Run the climate monitor wiki workflow and summarize report, source, and scope coverage.",
    category: "source",
    project: {
      source: "builtin",
      defaultSiblingPath: "../climate_monitor_wiki",
      envPath: "CLIMATE_MONITOR_PROJECT_PATH",
      repoUrl: "https://github.com/ferryhe/climate_monitor_wiki",
      packageName: "climate_monitor_wiki",
    },
    execution: skillExecution({
      kind: "cli",
      adapterId: "climate_monitor.cli.v1",
      requiredEnv: ["CLIMATE_MONITOR_PROJECT_PATH"],
      optionalEnv: ["CLIMATE_MONITOR_ALLOW_LIVE_RUNS"],
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      allowedCommands: ["scripts/run_climate_monitor.py"],
      supportsResume: false,
      readinessHint:
        "Set CLIMATE_MONITOR_PROJECT_PATH to enable climate monitor CLI handoffs.",
    }),
    inputSchema: {
      type: "object",
      properties: {
        dryRun: { type: "boolean" },
        date: { type: "string" },
        manifestFixture: { type: "string" },
        researchFixture: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        report_date: { type: "string" },
        report_path: { type: ["string", "null"] },
        item_count: { type: "integer" },
        items: { type: "array" },
        dedup_notes: { type: "array" },
        warnings: { type: "array" },
        synced: { type: "boolean" },
      },
    },
    interactionKinds: ["approval", "blocked"],
    artifactKinds: [
      "climate_monitor_report",
      "climate_monitor_run_json",
      "climate_monitor_scope_status",
    ],
    ui: {
      mode: "renderer",
      openOnTrigger: false,
      preferredRenderer: "json",
    },
    permissions: {
      approvalRequired: true,
      canUseNetwork: true,
      canWriteDatabase: true,
    },
  },
];

export function createSkillManifestRegistry(
  customManifests: SkillManifest[] = [],
): SkillManifestRegistry {
  const order: string[] = [];
  const byId = new Map<string, SkillManifest>();

  for (const manifest of [...builtinSkillManifests, ...customManifests]) {
    if (!byId.has(manifest.skillId)) order.push(manifest.skillId);
    byId.set(manifest.skillId, manifest);
  }

  return {
    listSkills: () =>
      order
        .map((skillId) => byId.get(skillId))
        .filter((manifest): manifest is SkillManifest => Boolean(manifest)),
    getSkill: (skillId: string) => byId.get(skillId) ?? null,
    hasSkill: (skillId: string) => byId.has(skillId),
    listSkillIds: () => order.filter((skillId) => byId.has(skillId)),
  };
}

export function manifestAdapterDefinition(
  manifest: SkillManifest,
): ToolAdapterDefinition {
  const builtinAdapterText: Record<
    string,
    { displayName: string; description: string }
  > = {
    web_listening: {
      displayName: "Web Listening CLI Adapter",
      description: "Metadata contract for the Web Listening CLI module adapter.",
    },
    doc_to_md: {
      displayName: "Doc to Markdown HTTP Adapter",
      description:
        "Metadata contract for the Doc to Markdown HTTP module adapter.",
    },
    md_to_rag: {
      displayName: "Markdown to RAG CLI Adapter",
      description:
        "Metadata contract for the Markdown to RAG CLI module adapter.",
    },
    rag_to_agent: {
      displayName: "RAG to Agent HTTP Adapter",
      description: "Metadata contract for the RAG to Agent HTTP module adapter.",
    },
    climate_monitor: {
      displayName: "Climate Monitor CLI Adapter",
      description: "Fixed CLI contract for the climate monitor wiki runner.",
    },
  };
  const adapterText = builtinAdapterText[manifest.skillId];
  return {
    adapterId: manifest.execution.adapterId,
    moduleId: manifest.moduleId,
    adapterKind:
      manifest.execution.kind === "http" || manifest.execution.kind === "cli"
        ? manifest.execution.kind
        : "cli",
    displayName:
      adapterText?.displayName ?? `${manifest.title ?? manifest.name} Adapter`,
    description: adapterText?.description ?? manifest.description,
    sourceRepo: manifest.project.repoUrl ?? manifest.project.packageName ?? "",
    requiredEnv: [...manifest.execution.requiredEnv],
    optionalEnv: [...manifest.execution.optionalEnv],
    timeoutMs: manifest.execution.timeoutMs,
    maxOutputBytes: manifest.execution.maxOutputBytes,
    allowedCommands: [...manifest.execution.allowedCommands],
    supportsResume: manifest.execution.supportsResume,
    readinessHint:
      manifest.execution.readinessHint ??
      `Configure ${manifest.execution.adapterId} to enable skill handoffs.`,
    projectFallback:
      manifest.moduleId === "climate_monitor"
        ? {
            defaultSiblingPath: manifest.project.defaultSiblingPath,
            requiredPath: "scripts/run_climate_monitor.py",
          }
        : undefined,
  };
}

function hasEnvValue(
  env: Record<string, string | undefined>,
  name: string,
): boolean {
  return Boolean(env[name]?.trim());
}

function projectCandidatePath(
  project: SkillProjectMetadata,
  env: Record<string, string | undefined>,
  pathExistsFn: (path: string) => boolean,
  cwd: string,
): { candidatePath: string; configuredBy: string | null } {
  if (project.envPath && hasEnvValue(env, project.envPath)) {
    return {
      candidatePath: env[project.envPath]!.trim(),
      configuredBy: project.envPath,
    };
  }

  const defaultCandidates = defaultProjectCandidates(
    project.defaultSiblingPath,
    cwd,
  );
  const readyDefault = defaultCandidates.find(pathExistsFn);
  return {
    candidatePath:
      readyDefault ??
      defaultCandidates[0] ??
      resolve(cwd, project.defaultSiblingPath),
    configuredBy: project.defaultSiblingPath ? "defaultSiblingPath" : null,
  };
}

function defaultProjectCandidates(
  defaultSiblingPathValue: string,
  cwd: string,
): string[] {
  return [
    resolve(cwd, defaultSiblingPathValue),
    resolve(cwd, "..", defaultSiblingPathValue),
    resolve(cwd, "..", "..", defaultSiblingPathValue),
  ].filter((path, index, paths) => paths.indexOf(path) === index);
}

function hasReadyProjectFallback(
  definition: ToolAdapterDefinition,
  options: {
    cwd: string;
    pathExists: (path: string) => boolean;
  },
): boolean {
  const fallback = definition.projectFallback;
  if (!fallback) return false;
  return defaultProjectCandidates(fallback.defaultSiblingPath, options.cwd).some(
    (candidate) => options.pathExists(join(candidate, fallback.requiredPath)),
  );
}

function adapterReadiness(
  definition: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
  options: {
    cwd: string;
    pathExists: (path: string) => boolean;
  },
): {
  status: "ready" | "missing_required_env";
  configured: boolean;
  missingRequiredEnv: string[];
  configuredOptionalEnv: string[];
} {
  let missingRequiredEnv = definition.requiredEnv.filter(
    (name) => !hasEnvValue(env, name),
  );
  if (
    missingRequiredEnv.length > 0 &&
    hasReadyProjectFallback(definition, options)
  ) {
    missingRequiredEnv = [];
  }

  const configuredOptionalEnv = definition.optionalEnv.filter((name) =>
    hasEnvValue(env, name),
  );
  const configured = missingRequiredEnv.length === 0;
  return {
    status: configured ? "ready" : "missing_required_env",
    configured,
    missingRequiredEnv,
    configuredOptionalEnv,
  };
}

export function listSkillReadiness(
  registry: SkillManifestRegistry,
  options: {
    env?: Record<string, string | undefined>;
    pathExists?: (path: string) => boolean;
    cwd?: string;
  } = {},
): SkillReadiness[] {
  const env = options.env ?? process.env;
  const pathExists = options.pathExists ?? existsSync;
  const cwd = options.cwd ?? process.cwd();

  return registry.listSkills().map((manifest) => {
    const project = projectCandidatePath(
      manifest.project,
      env,
      pathExists,
      cwd,
    );
    const adapterReadinessResult = adapterReadiness(
      manifestAdapterDefinition(manifest),
      env,
      { cwd, pathExists },
    );

    return {
      skillId: manifest.skillId,
      project: {
        status: pathExists(project.candidatePath) ? "ready" : "not_configured",
        configuredBy: project.configuredBy,
        defaultSiblingPath: manifest.project.defaultSiblingPath,
      },
      adapter: {
        status: adapterReadinessResult.status,
        configured: adapterReadinessResult.configured,
        adapterId: manifest.execution.adapterId,
        missingRequiredEnv: [...adapterReadinessResult.missingRequiredEnv],
        configuredOptionalEnv: [
          ...adapterReadinessResult.configuredOptionalEnv,
        ],
      },
      ui: {
        mode: manifest.ui.mode,
        hasHtml: Boolean(manifest.ui.htmlEntrypoint),
        openOnTrigger: manifest.ui.openOnTrigger,
        preferredRenderer: manifest.ui.preferredRenderer,
      },
    };
  });
}
