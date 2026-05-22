import type { AgentManifest } from "./agent-manifest";

export interface McpToolMetadata {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: {
      message: {
        type: "string";
        description: string;
      };
      executionMode: {
        type: "string";
        enum: ["plan_only", "execute_ready"];
        description: string;
      };
    };
    required: ["message"];
    additionalProperties: false;
  };
}

const REDACTED = "[redacted]";
const unsafeTextPatterns: RegExp[] = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{8,}\b/g,
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(?::\d+)?[^\s'")<]*/gi,
  /(["'`])(?:[A-Za-z]:\\|\/(?:home|Users|var|tmp|mnt|Project|project|workspace|opt)\/)(?:(?!\1).)+\1/g,
  /\b[A-Za-z]:\\[^\s'")<]*(?:\s+[^\s'")<]*[\\/][^\s'")<]*)*/g,
  /(?<!:)\/(?:home|Users|var|tmp|mnt|Project|project|workspace|opt)\/[^\s'")<]*(?:\s+[^\s'")<]*\/[^\s'")<]*)*/g,
];

export function redactAgentInteropText(value: string): string {
  return unsafeTextPatterns.reduce(
    (redacted, pattern) => redacted.replace(pattern, REDACTED),
    value,
  );
}

function toolNameFromAgentId(agentId: string): string {
  const normalized = agentId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `run_${normalized || "agent"}`;
}

export function exportMcpToolMetadata(agent: AgentManifest): McpToolMetadata {
  return {
    name: toolNameFromAgentId(agent.agentId),
    description: `Run the ${redactAgentInteropText(agent.name)} agent through ai_interface.`,
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "User message to send to the agent.",
        },
        executionMode: {
          type: "string",
          enum: ["plan_only", "execute_ready"],
          description: "Whether to plan only or execute ready non-approval steps.",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  };
}

export function assertMcpToolMetadataContract(
  metadata: McpToolMetadata,
): McpToolMetadata {
  const { inputSchema } = metadata;
  if (
    inputSchema.required.length !== 1 ||
    inputSchema.required[0] !== "message"
  ) {
    throw new Error('MCP tool inputSchema.required must be exactly ["message"].');
  }
  if (inputSchema.additionalProperties !== false) {
    throw new Error("MCP tool inputSchema.additionalProperties must be false.");
  }
  return metadata;
}
