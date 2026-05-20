import type { JsonObject } from "../modules/ingest-service";
import type { ToolAdapterDefinition } from "./adapter-registry";
import type {
  ToolAdapterExecutor,
  ToolExecutionRequest,
  ToolExecutionResult,
} from "./executor";

export interface McpToolCallRequest {
  serverUrl: string;
  toolName: string;
  input: JsonObject;
  timeoutMs: number;
  maxOutputBytes: number;
  signal: AbortSignal;
  authToken: string | null;
}

export interface McpToolCallResponse {
  content?: unknown;
  isError?: boolean;
}

export type McpToolCaller = (
  request: McpToolCallRequest,
) => Promise<McpToolCallResponse>;

class McpTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`MCP execution exceeded ${timeoutMs}ms.`);
    this.name = "McpTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function envValue(
  env: Record<string, string | undefined>,
  name: string | undefined,
): string | null {
  if (!name) return null;
  const value = env[name]?.trim();
  return value || null;
}

function jsonEscaped(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function slashEscaped(value: string): string {
  return value.split("/").join("\\/");
}

function secretVariants(value: string): string[] {
  const slashNormalized = value.split("\\").join("/");
  const candidates = [
    value,
    slashNormalized,
    slashEscaped(value),
    slashEscaped(slashNormalized),
  ];
  const withJsonEscapes = candidates.flatMap((candidate) => [
    candidate,
    jsonEscaped(candidate),
  ]);
  return Array.from(new Set(withJsonEscapes)).filter(Boolean);
}

function secretValues(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
): string[] {
  const values = [
    adapter.mcpServerEnv,
    ...adapter.requiredEnv,
    ...adapter.optionalEnv,
  ]
    .map((name) => envValue(env, name))
    .filter((value): value is string => Boolean(value));
  return values
    .flatMap((value) => secretVariants(value))
    .sort((left, right) => right.length - left.length);
}

function authorizationToken(
  adapter: ToolAdapterDefinition,
  env: Record<string, string | undefined>,
): string | null {
  const tokenEnv = adapter.optionalEnv.find((name) =>
    /(TOKEN|API_KEY|AUTHORIZATION|BEARER)/i.test(name),
  );
  return envValue(env, tokenEnv);
}

function redactHeaderLikeText(value: string): string {
  return value.replace(
    /["']?\b(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|token)\b["']?\s*[:=]\s*["']?(?:bearer\s+)?[^"',\r\n}\]]+["']?/gi,
    "[redacted-header]",
  );
}

function redactText(value: string, secrets: string[]): string {
  let redacted = redactHeaderLikeText(value);
  for (const secret of secrets) {
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted;
}

function isSensitiveKey(key: string): boolean {
  return /^(headers?|authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|token|secret)$/i.test(
    key,
  );
}

function redactJson<T>(value: T, secrets: string[]): T {
  if (typeof value === "string") {
    return redactText(value, secrets) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, secrets)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? "[redacted]" : redactJson(item, secrets),
      ]),
    ) as T;
  }
  return value;
}

function truncateText(text: string, maxBytes: number): {
  text: string;
  truncated: boolean;
} {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return { text, truncated: false };
  return {
    text: Buffer.from(text, "utf8").subarray(0, maxBytes).toString("utf8"),
    truncated: true,
  };
}

function parseJsonBody(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function captureJsonValue(
  value: unknown,
  secrets: string[],
  maxOutputBytes: number,
): { value: unknown; truncated: boolean } {
  const redacted = redactJson(value, secrets);
  const serialized = JSON.stringify(redacted);
  const truncated = truncateText(serialized, maxOutputBytes);
  return {
    value: truncated.truncated ? parseJsonBody(truncated.text) : redacted,
    truncated: truncated.truncated,
  };
}

function result(input: {
  status: ToolExecutionResult["status"];
  summary: string;
  eventType: string;
  eventSeverity: ToolExecutionResult["eventSeverity"];
  eventMessage: string;
  outputJson: JsonObject | null;
  eventPayload: JsonObject;
}): ToolExecutionResult {
  return {
    status: input.status,
    summary: input.summary,
    outputJson: input.outputJson,
    eventType: input.eventType,
    eventTitle: input.summary,
    eventMessage: input.eventMessage,
    eventSeverity: input.eventSeverity,
    eventPayload: input.eventPayload,
  };
}

function configurationFailed(input: {
  adapter: ToolAdapterDefinition;
  summary: string;
  message: string;
  missingRequiredEnv?: string[];
}): ToolExecutionResult {
  return result({
    status: "failed",
    summary: input.summary,
    eventType: "tool.execution.mcp_configuration_failed",
    eventSeverity: "error",
    eventMessage: input.message,
    outputJson: null,
    eventPayload: {
      adapterId: input.adapter.adapterId,
      moduleId: input.adapter.moduleId,
      missingRequiredEnv: input.missingRequiredEnv ?? [],
    },
  });
}

function normalizeMcpResponse(response: McpToolCallResponse): {
  content: unknown;
  isError: boolean;
} {
  return {
    content: response.content ?? [],
    isError: response.isError === true,
  };
}

async function callWithTimeout(
  caller: McpToolCaller,
  request: McpToolCallRequest,
  controller: AbortController,
): Promise<McpToolCallResponse> {
  let timeout: NodeJS.Timeout | null = null;
  const callPromise = caller(request);
  callPromise.catch(() => undefined);
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new McpTimeoutError(request.timeoutMs));
    }, request.timeoutMs);
  });

  try {
    return await Promise.race([callPromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return truncateText(await response.text(), maxBytes).text;
  }

  const chunks: Buffer[] = [];
  let capturedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = Buffer.from(value);
      const remaining = maxBytes - capturedBytes;
      if (remaining > 0) {
        const captured = chunk.subarray(0, remaining);
        chunks.push(captured);
        capturedBytes += captured.length;
      }

      if (chunk.length > remaining) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, capturedBytes).toString("utf8");
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best-effort cleanup before surfacing the protocol error.
  }
}

function jsonRpcErrorMessage(error: unknown): string {
  if (isRecord(error) && typeof error["message"] === "string") {
    return error["message"];
  }
  return "MCP tool call returned an error.";
}

function mcpResponseFromJsonRpc(parsed: unknown): McpToolCallResponse {
  if (!isRecord(parsed)) {
    return { content: [{ type: "json", json: parsed }] };
  }
  if (parsed["error"] !== undefined) {
    throw new Error(jsonRpcErrorMessage(parsed["error"]));
  }

  const resultValue = parsed["result"] ?? parsed;
  if (!isRecord(resultValue)) {
    return { content: [{ type: "json", json: resultValue }] };
  }

  return {
    content: resultValue["content"] ?? [],
    isError: resultValue["isError"] === true,
  };
}

const defaultMcpToolCaller: McpToolCaller = async ({
  serverUrl,
  toolName,
  input,
  signal,
  authToken,
  maxOutputBytes,
}) => {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (authToken) {
    headers.authorization = /^bearer\s+/i.test(authToken)
      ? authToken
      : `Bearer ${authToken}`;
  }

  const response = await fetch(serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `ai-interface-${Date.now()}`,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: input,
      },
    }),
    signal,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new Error("MCP server redirects are not followed by the executor.");
  }
  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(`MCP server returned status ${response.status}.`);
  }

  return mcpResponseFromJsonRpc(
    parseJsonBody(await readResponseText(response, maxOutputBytes)),
  );
};

export class McpToolAdapterExecutor implements ToolAdapterExecutor {
  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
    private readonly caller: McpToolCaller = defaultMcpToolCaller,
  ) {}

  async execute({
    run,
    adapter,
  }: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const secrets = secretValues(adapter, this.env);
    if (!adapter.mcpServerEnv) {
      return configurationFailed({
        adapter,
        summary: `MCP server env is not declared for ${adapter.adapterId}.`,
        message: "MCP server env metadata is missing.",
      });
    }

    const serverUrl = envValue(this.env, adapter.mcpServerEnv);
    if (!serverUrl) {
      return configurationFailed({
        adapter,
        summary: `MCP server is not configured for ${adapter.adapterId}.`,
        message: "MCP server env is missing.",
        missingRequiredEnv: [adapter.mcpServerEnv],
      });
    }

    try {
      new URL(serverUrl);
    } catch {
      return configurationFailed({
        adapter,
        summary: `MCP server URL is invalid for ${adapter.adapterId}.`,
        message: "MCP server env is invalid.",
      });
    }

    const toolName = adapter.mcpToolName?.trim();
    if (!toolName) {
      return configurationFailed({
        adapter,
        summary: `MCP tool name is not configured for ${adapter.adapterId}.`,
        message: "MCP tool name metadata is missing.",
      });
    }

    const controller = new AbortController();
    try {
      const response = await callWithTimeout(
        this.caller,
        {
          serverUrl,
          toolName,
          input: run.inputJson ?? {},
          timeoutMs: adapter.timeoutMs,
          maxOutputBytes: adapter.maxOutputBytes,
          signal: controller.signal,
          authToken: authorizationToken(adapter, this.env),
        },
        controller,
      );
      const normalized = normalizeMcpResponse(response);
      const content = captureJsonValue(
        normalized.content,
        secrets,
        adapter.maxOutputBytes,
      );
      const outputJson: JsonObject = {
        content: content.value,
        isError: normalized.isError,
        contentTruncated: content.truncated,
      };
      const eventPayload: JsonObject = {
        adapterId: adapter.adapterId,
        moduleId: adapter.moduleId,
        externalRunId: run.externalRunId,
        toolName,
        ...outputJson,
      };

      if (normalized.isError) {
        return result({
          status: "failed",
          summary: `MCP execution failed for ${adapter.adapterId}.`,
          eventType: "tool.execution.mcp_failed",
          eventSeverity: "error",
          eventMessage: "MCP tool returned an error result.",
          outputJson,
          eventPayload,
        });
      }

      return result({
        status: "succeeded",
        summary: `MCP execution completed for ${adapter.adapterId}.`,
        eventType: "tool.execution.mcp_completed",
        eventSeverity: "info",
        eventMessage: `MCP ${adapter.moduleId} adapter execution completed.`,
        outputJson,
        eventPayload,
      });
    } catch (error) {
      const timedOut = error instanceof McpTimeoutError;
      return result({
        status: "failed",
        summary: timedOut
          ? `MCP execution timed out for ${adapter.adapterId}.`
          : `MCP execution failed for ${adapter.adapterId}.`,
        eventType: timedOut
          ? "tool.execution.mcp_timeout"
          : "tool.execution.mcp_failed",
        eventSeverity: timedOut ? "warning" : "error",
        eventMessage: redactText(
          error instanceof Error ? error.message : "MCP tool call failed.",
          secrets,
        ),
        outputJson: null,
        eventPayload: {
          adapterId: adapter.adapterId,
          moduleId: adapter.moduleId,
          externalRunId: run.externalRunId,
          toolName,
        },
      });
    }
  }
}
