import type { ToolAdapterDefinition } from "./adapter-registry";
import {
  FakeToolAdapterExecutor,
  type ToolAdapterExecutor,
  type ToolExecutionEngineMode,
} from "./executor";
import { CliToolAdapterExecutor } from "./cli-executor";
import { HttpToolAdapterExecutor } from "./http-executor";
import { McpToolAdapterExecutor } from "./mcp-executor";

function executionMode(
  env: Record<string, string | undefined>,
): ToolExecutionEngineMode {
  return env["AI_INTERFACE_TOOL_EXECUTION_MODE"] === "real" ? "real" : "fake";
}

export function createToolAdapterExecutor(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined> = process.env,
): ToolAdapterExecutor {
  if (executionMode(env) !== "real") {
    return new FakeToolAdapterExecutor();
  }

  if (adapter.adapterKind === "cli") {
    return new CliToolAdapterExecutor(env);
  }

  if (adapter.adapterKind === "http") {
    return new HttpToolAdapterExecutor(env);
  }

  if (adapter.adapterKind === "mcp") {
    return new McpToolAdapterExecutor(env);
  }

  return new FakeToolAdapterExecutor();
}
