import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const defaultRoots = ["agents/builtin", "agents/community", "agents/custom"];
const workspaceRoot = process.env.INIT_CWD ?? process.cwd();

interface AgentManifestSummary {
  agentId: string;
  name: string;
  source: string;
  skillIds: string[];
  requiredSkillIds: string[];
  planner: {
    mode: string;
    failureStrategy: string;
  };
  permissions: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
  memory: {
    promotionMode: string;
  };
  missingSkillIds: string[];
}

interface AgentValidationSummary {
  ok: boolean;
  rootOrder: string[];
  agentCount: number;
  agents: AgentManifestSummary[];
}

function redactLocalPaths(value: string): string {
  const cwd = workspaceRoot;
  const escapedCwd = cwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalizedCwd = cwd.replace(/\\/g, "/");
  const escapedNormalizedCwd = normalizedCwd.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  return value
    .replace(new RegExp(escapedCwd, "gi"), "<workspace>")
    .replace(new RegExp(escapedNormalizedCwd, "gi"), "<workspace>")
    .replace(/(^|[^A-Za-z])([A-Za-z]:\\[^\s",]+)/g, "$1<redacted-path>")
    .replace(/(^|[^A-Za-z])([A-Za-z]:\/[^\s",]+)/g, "$1<redacted-path>")
    .replace(/\/(?:Users|home|tmp|var|private)\/[^\s",]+/g, "<redacted-path>");
}

function isLocalAbsolutePath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
  return (
    isAbsolute(trimmed) ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    /^\/(?:Users|home|tmp|var|private|workspace|workspaces|mnt)\//.test(trimmed)
  );
}

function redactSuccessString(value: string): string {
  const normalizedValue = value.replace(/\\/g, "/");
  const normalizedWorkspace = workspaceRoot.replace(/\\/g, "/");
  if (
    isLocalAbsolutePath(value) ||
    value.includes(workspaceRoot) ||
    normalizedValue.includes(normalizedWorkspace)
  ) {
    return "<redacted-path>";
  }
  return redactLocalPaths(value);
}

function redactSuccessJson(value: unknown): unknown {
  if (typeof value === "string") return redactSuccessString(value);
  if (Array.isArray(value)) return value.map(redactSuccessJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        redactSuccessJson(nestedValue),
      ]),
    );
  }
  return value;
}

async function loadRuntimeModules() {
  const agentLoaderUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/agent-registry/agent-loader.ts",
    ),
  ).href;
  const agentRegistryUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/agent-registry/agent-runtime-registry.ts",
    ),
  ).href;
  const skillRegistryUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/skill-runtime/skill-runtime-registry.ts",
    ),
  ).href;

  const [loaderModule, registryModule, skillRegistryModule] =
    await Promise.all([
      import(agentLoaderUrl),
      import(agentRegistryUrl),
      import(skillRegistryUrl),
    ]);
  return {
    loadAgentManifests: loaderModule.loadAgentManifests,
    createAgentRuntimeRegistry: registryModule.createAgentRuntimeRegistry,
    defaultSkillRuntimeRegistry: skillRegistryModule.defaultSkillRuntimeRegistry,
  };
}

async function main(): Promise<void> {
  try {
    const {
      loadAgentManifests,
      createAgentRuntimeRegistry,
      defaultSkillRuntimeRegistry,
    } = await loadRuntimeModules();
    const manifests = await loadAgentManifests({ cwd: workspaceRoot });
    const registry = createAgentRuntimeRegistry(
      manifests,
      defaultSkillRuntimeRegistry,
    );
    const missingByAgentId = new Map(
      registry
        .validateSkillReferences()
        .map((item: { agentId: string; missingSkillIds: string[] }) => [
          item.agentId,
          item.missingSkillIds,
        ]),
    );
    const agents: AgentManifestSummary[] = manifests.map((manifest: any) => ({
      agentId: manifest.agentId,
      name: manifest.name,
      source: manifest.source,
      skillIds: manifest.skills.map((binding: any) => binding.skillId),
      requiredSkillIds: manifest.skills
        .filter((binding: any) => binding.required)
        .map((binding: any) => binding.skillId),
      planner: {
        mode: manifest.planner.mode,
        failureStrategy: manifest.planner.failureStrategy,
      },
      permissions: {
        approvalRequired: manifest.permissions.approvalRequired,
        canUseNetwork: manifest.permissions.canUseNetwork,
        canWriteDatabase: manifest.permissions.canWriteDatabase,
      },
      memory: {
        promotionMode: manifest.memory.promotionMode,
      },
      missingSkillIds: missingByAgentId.get(manifest.agentId) ?? [],
    }));
    const summary: AgentValidationSummary = {
      ok: agents.every((agent) => agent.missingSkillIds.length === 0),
      rootOrder: defaultRoots,
      agentCount: agents.length,
      agents,
    };

    console.log(JSON.stringify(redactSuccessJson(summary), null, 2));
    if (!summary.ok) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: redactLocalPaths(message),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

await main();
