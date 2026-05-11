import type { ModuleId } from "../modules/registry";

export type ToolAdapterKind = "http" | "cli";
export type ToolAdapterReadinessStatus = "ready" | "missing_required_env";

export interface ToolAdapterDefinition {
  adapterId: string;
  moduleId: ModuleId;
  adapterKind: ToolAdapterKind;
  displayName: string;
  description: string;
  sourceRepo: string;
  requiredEnv: string[];
  optionalEnv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  allowedCommands: string[];
  supportsResume: boolean;
  readinessHint: string;
}

export interface ToolAdapterReadiness extends ToolAdapterDefinition {
  configured: boolean;
  status: ToolAdapterReadinessStatus;
  missingRequiredEnv: string[];
  configuredOptionalEnv: string[];
}

export const adapterDefinitions: ToolAdapterDefinition[] = [
  {
    adapterId: "web_listening.cli.v1",
    moduleId: "web_listening",
    adapterKind: "cli",
    displayName: "Web Listening CLI Adapter",
    description: "Metadata contract for the Web Listening CLI module adapter.",
    sourceRepo: "https://github.com/ferryhe/web_listening",
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
  },
  {
    adapterId: "doc_to_md.http.v1",
    moduleId: "doc_to_md",
    adapterKind: "http",
    displayName: "Doc to Markdown HTTP Adapter",
    description:
      "Metadata contract for the Doc to Markdown HTTP module adapter.",
    sourceRepo: "https://github.com/ferryhe/doc_to_md",
    requiredEnv: ["DOC_TO_MD_API_BASE_URL"],
    optionalEnv: ["DOC_TO_MD_API_TOKEN"],
    timeoutMs: 120000,
    maxOutputBytes: 1048576,
    allowedCommands: [],
    supportsResume: true,
    readinessHint: "Set DOC_TO_MD_API_BASE_URL to enable HTTP handoffs.",
  },
  {
    adapterId: "md_to_rag.cli.v1",
    moduleId: "md_to_rag",
    adapterKind: "cli",
    displayName: "Markdown to RAG CLI Adapter",
    description:
      "Metadata contract for the Markdown to RAG CLI module adapter.",
    sourceRepo: "https://github.com/ferryhe/c-ross-2",
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
  },
  {
    adapterId: "rag_to_agent.http.v1",
    moduleId: "rag_to_agent",
    adapterKind: "http",
    displayName: "RAG to Agent HTTP Adapter",
    description: "Metadata contract for the RAG to Agent HTTP module adapter.",
    sourceRepo: "https://github.com/ferryhe/c-ross-2",
    requiredEnv: ["RAG_TO_AGENT_API_BASE_URL"],
    optionalEnv: ["RAG_TO_AGENT_API_TOKEN"],
    timeoutMs: 120000,
    maxOutputBytes: 1048576,
    allowedCommands: [],
    supportsResume: true,
    readinessHint: "Set RAG_TO_AGENT_API_BASE_URL to enable HTTP handoffs.",
  },
];

export function getAdapterDefinition(
  moduleId: ModuleId,
): ToolAdapterDefinition {
  const definition = adapterDefinitions.find(
    (adapter) => adapter.moduleId === moduleId,
  );
  if (!definition) {
    throw new Error(`Adapter is not registered: ${String(moduleId)}`);
  }
  return definition;
}

function hasEnvValue(
  env: Record<string, string | undefined>,
  name: string,
): boolean {
  return Boolean(env[name]?.trim());
}

export function listAdapterReadiness(
  env: Record<string, string | undefined> = process.env,
): ToolAdapterReadiness[] {
  return adapterDefinitions.map((definition) => {
    const missingRequiredEnv = definition.requiredEnv.filter(
      (name) => !hasEnvValue(env, name),
    );
    const configuredOptionalEnv = definition.optionalEnv.filter((name) =>
      hasEnvValue(env, name),
    );
    const configured = missingRequiredEnv.length === 0;

    return {
      ...definition,
      requiredEnv: [...definition.requiredEnv],
      optionalEnv: [...definition.optionalEnv],
      allowedCommands: [...definition.allowedCommands],
      configured,
      status: configured ? "ready" : "missing_required_env",
      missingRequiredEnv,
      configuredOptionalEnv,
    };
  });
}
