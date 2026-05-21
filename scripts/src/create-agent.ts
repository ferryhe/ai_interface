import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workspaceRoot = findWorkspaceRoot(process.env.INIT_CWD ?? process.cwd());

interface AgentManifestSummary {
  agentId: string;
  name: string;
  description: string;
  source: "custom";
  instructions: string;
  skills: Array<{ skillId: string; required: boolean }>;
  planner: { mode: "linear"; failureStrategy: "fail_fast" };
  permissions: {
    approvalRequired: boolean;
    canUseNetwork: boolean;
    canWriteDatabase: boolean;
  };
  memory: { promotionMode: "run_summary" };
  handoffs: [];
  tests: [];
}

interface Args {
  agentId?: string;
  name?: string;
  skills?: string[];
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
    "Usage: corepack pnpm run agent:create -- --agent-id my_agent --name \"My Agent\" --skills doc_to_md,md_to_rag",
    "",
    "Options:",
    "  --agent-id <id>      Required custom agent id.",
    "  --name <name>        Required display name.",
    "  --skills <ids>       Required comma-separated registered skill ids.",
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
    else if (arg === "--skills") {
      args.skills = value
        .split(",")
        .map((skillId) => skillId.trim())
        .filter(Boolean);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
    index += 1;
  }
  return args;
}

function buildManifest(
  args: Required<Pick<Args, "agentId" | "name" | "skills">>,
): AgentManifestSummary {
  return {
    agentId: args.agentId,
    name: args.name,
    description: "Custom agent created from the local generator.",
    source: "custom",
    instructions:
      "Use the selected skills to complete the user's request while preserving\nintermediate artifacts for review.",
    skills: args.skills.map((skillId) => ({ skillId, required: false })),
    planner: { mode: "linear", failureStrategy: "fail_fast" },
    permissions: {
      approvalRequired: false,
      canUseNetwork: false,
      canWriteDatabase: true,
    },
    memory: { promotionMode: "run_summary" },
    handoffs: [],
    tests: [],
  };
}

async function loadWriter() {
  const writerUrl = pathToFileURL(
    resolve(
      workspaceRoot,
      "artifacts/api-server/src/agent-registry/agent-manifest-writer.ts",
    ),
  ).href;
  return import(writerUrl) as Promise<{
    writeAgentManifest: (input: {
      cwd: string;
      agentId: string;
      manifest: AgentManifestSummary;
      overwrite?: boolean;
    }) => Promise<{ manifest: AgentManifestSummary; path: string }>;
  }>;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.agentId || !args.name || !args.skills?.length) {
      throw new Error(usage());
    }

    const { writeAgentManifest } = await loadWriter();
    const result = await writeAgentManifest({
      cwd: workspaceRoot,
      agentId: args.agentId,
      manifest: buildManifest({
        agentId: args.agentId,
        name: args.name,
        skills: args.skills,
      }),
      overwrite: args.overwrite,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          agentId: result.manifest.agentId,
          path: result.path,
          skillIds: result.manifest.skills.map((binding) => binding.skillId),
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
