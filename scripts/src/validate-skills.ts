import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const defaultRoots = ["skills/builtin", "skills/community", "skills/custom"];
const workspaceRoot = process.env.INIT_CWD ?? process.cwd();

interface SkillManifestSummary {
  skillId: string;
  moduleId: string;
  name: string;
  source: string;
  project: {
    defaultSiblingPath: string;
    envPath?: string;
    repoUrl?: string;
    packageName?: string;
  };
  execution: {
    kind: string;
    adapterId: string;
    requiredEnv: string[];
    optionalEnv: string[];
  };
  ui: {
    mode: string;
    hasHtml: boolean;
    preferredRenderer: string;
  };
  permissions: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
}

interface SkillValidationSummary {
  ok: boolean;
  rootOrder: string[];
  skillCount: number;
  skills: SkillManifestSummary[];
  readiness: unknown[];
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

function summarizeSkill(manifest: any): SkillManifestSummary {
  return {
    skillId: manifest.skillId,
    moduleId: manifest.moduleId,
    name: manifest.name,
    source: manifest.project.source,
    project: {
      defaultSiblingPath: manifest.project.defaultSiblingPath,
      envPath: manifest.project.envPath,
      repoUrl: manifest.project.repoUrl,
      packageName: manifest.project.packageName,
    },
    execution: {
      kind: manifest.execution.kind,
      adapterId: manifest.execution.adapterId,
      requiredEnv: [...manifest.execution.requiredEnv],
      optionalEnv: [...manifest.execution.optionalEnv],
    },
    ui: {
      mode: manifest.ui.mode,
      hasHtml: Boolean(manifest.ui.htmlEntrypoint),
      preferredRenderer: manifest.ui.preferredRenderer,
    },
    permissions: {
      approvalRequired: manifest.permissions.approvalRequired,
      canUseNetwork: manifest.permissions.canUseNetwork,
      canWriteDatabase: manifest.permissions.canWriteDatabase,
    },
  };
}

async function loadRuntimeModules() {
  const manifestUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/skill-runtime/skill-manifest.ts",
    ),
  ).href;
  const loaderUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/skill-runtime/skill-loader.ts",
    ),
  ).href;
  const manifestModule = await import(manifestUrl);
  const loaderModule = await import(loaderUrl);
  return { ...manifestModule, ...loaderModule };
}

async function main(): Promise<void> {
  try {
    const {
      createSkillManifestRegistry,
      listSkillReadiness,
      loadSkillManifests,
    } = await loadRuntimeModules();
    const manifests = await loadSkillManifests();
    const registry = createSkillManifestRegistry(manifests);
    const summary: SkillValidationSummary = {
      ok: true,
      rootOrder: defaultRoots,
      skillCount: manifests.length,
      skills: manifests.map(summarizeSkill),
      readiness: listSkillReadiness(registry, { pathExists: () => false }),
    };

    console.log(JSON.stringify(redactSuccessJson(summary), null, 2));
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
