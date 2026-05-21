import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workspaceRoot = findWorkspaceRoot(process.env.INIT_CWD ?? process.cwd());

interface AgentManifestSummary {
  agentId: string;
  skills: Array<{ skillId: string; required: boolean }>;
}

interface Args {
  agentId?: string;
  name?: string;
  file?: string;
  overwrite?: boolean;
}

function hasWorkspaceMarkers(path: string): boolean {
  return (
    existsSync(join(path, "artifacts", "api-server", "src")) ||
    existsSync(join(path, "agents", "builtin"))
  );
}

function findWorkspaceRoot(startPath: string): string {
  let current = resolve(startPath);
  while (true) {
    if (hasWorkspaceMarkers(current)) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(startPath);
    current = parent;
  }
}

function usage(): string {
  return [
    "Usage: corepack pnpm run agent:import-vscode -- --agent-id imported_agent --name \"Imported Agent\" --file ./agent.agent.md",
    "",
    "Options:",
    "  --agent-id <id>      Required custom agent id.",
    "  --name <name>        Required display name.",
    "  --file <path>        Required VS Code .agent.md file path.",
    "  --overwrite          Replace an existing custom manifest.",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--overwrite") {
      args.overwrite = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    if (arg === "--agent-id") args.agentId = value;
    else if (arg === "--name") args.name = value;
    else if (arg === "--file") args.file = value;
    else throw new Error(`Unknown option: ${arg}`);
    index += 1;
  }
  return args;
}

async function loadRuntimeModules() {
  const importerUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/agent-registry/vscode-agent-importer.ts",
    ),
  ).href;
  const writerUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/agent-registry/agent-manifest-writer.ts",
    ),
  ).href;
  const skillRegistryUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/skill-runtime/skill-runtime-registry.ts",
    ),
  ).href;

  const [importerModule, writerModule, skillRegistryModule] =
    await Promise.all([
      import(importerUrl),
      import(writerUrl),
      import(skillRegistryUrl),
    ]);

  return {
    importVscodeAgentMarkdown: importerModule.importVscodeAgentMarkdown as (
      input: {
        agentId: string;
        name: string;
        markdown: string;
        registeredSkillIds: string[];
      },
    ) => { manifest: AgentManifestSummary; warnings: string[] },
    writeAgentManifest: writerModule.writeAgentManifest as (input: {
      cwd: string;
      agentId: string;
      manifest: AgentManifestSummary;
      overwrite?: boolean;
    }) => Promise<{ manifest: AgentManifestSummary; path: string }>,
    defaultSkillRuntimeRegistry:
      skillRegistryModule.defaultSkillRuntimeRegistry as {
        listSkillIds: () => string[];
      },
  };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.agentId || !args.name || !args.file) {
      throw new Error(usage());
    }

    const filePath = resolve(process.env.INIT_CWD ?? process.cwd(), args.file);
    const markdown = await readFile(filePath, "utf8");
    const {
      importVscodeAgentMarkdown,
      writeAgentManifest,
      defaultSkillRuntimeRegistry,
    } = await loadRuntimeModules();
    const imported = importVscodeAgentMarkdown({
      agentId: args.agentId,
      name: args.name,
      markdown,
      registeredSkillIds: defaultSkillRuntimeRegistry.listSkillIds(),
    });
    const result = await writeAgentManifest({
      cwd: workspaceRoot,
      agentId: args.agentId,
      manifest: imported.manifest,
      overwrite: args.overwrite,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          agentId: result.manifest.agentId,
          path: result.path,
          skillIds: result.manifest.skills.map((binding) => binding.skillId),
          warnings: imported.warnings,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exitCode = 1;
  }
}

await main();
